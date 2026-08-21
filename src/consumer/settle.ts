/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/consumer
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import type { Event, Outcome } from '../events/index';

import { MAXIMUM_DELAY_SECONDS, type RetryPolicy } from '../retry/index';

/*****************************************************************************************************************/

// What the handler did: it returned, or it threw this.
export type HandlerResult = { threw: false } | { threw: true; error: unknown };

/*****************************************************************************************************************/

export interface SettleOptions {
  // The platform's identifier for the message being settled.
  id: string;
  // 1-based: the delivery that just ran.
  attempts: number;
  // What to do about a throw.
  retry: RetryPolicy;
  // When handling started and when it ended, as epoch milliseconds. The duration and every event timestamp
  // derive from these two, which is what keeps settle pure.
  startedAt: number;
  settledAt: number;
}

/*****************************************************************************************************************/

// One settlement: the terminal outcome and the events recording it.
export interface Settlement {
  outcome: Outcome;
  events: Event[];
}

/*****************************************************************************************************************/

// The thrown value itself is not generally serializable, and the event log must be.
const snapshot = (error: unknown): { name: string; message: string; stack?: string } => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack === undefined ? {} : { stack: error.stack }),
    };
  }

  return { name: 'Error', message: String(error) };
};

/*****************************************************************************************************************/

// Turns what the handler did into exactly one terminal outcome and its events, purely. A throw always emits two
// events: the failure itself, then the decision taken about it. The policy's delay is floored and clamped into
// [0, the platform ceiling], and a policy that itself throws discards rather than letting the whole batch crash,
// which is the failure mode this module exists to remove.
export const settle = (result: HandlerResult, options: SettleOptions): Settlement => {
  const { id, attempts, retry, startedAt, settledAt } = options;

  if (!result.threw) {
    const durationMs = Math.max(settledAt - startedAt, 0);

    return {
      outcome: { type: 'succeeded' },
      events: [{ type: 'message.succeeded', id, durationMs, at: settledAt }],
    };
  }

  const failed: Event = {
    type: 'message.failed',
    id,
    error: snapshot(result.error),
    at: settledAt,
  };

  let decision: ReturnType<RetryPolicy>;

  try {
    decision = retry({ attempts, error: result.error });
  } catch {
    decision = { action: 'discard', reason: 'the retry policy threw' };
  }

  if (decision.action === 'discard') {
    return {
      outcome: { type: 'discarded', reason: decision.reason },
      events: [failed, { type: 'message.discarded', id, reason: decision.reason, at: settledAt }],
    };
  }

  const delaySeconds = Math.floor(
    Math.max(Math.min(decision.delaySeconds, MAXIMUM_DELAY_SECONDS), 0),
  );

  return {
    outcome: { type: 'retried', delaySeconds },
    events: [failed, { type: 'message.retried', id, delaySeconds, at: settledAt }],
  };
};

/*****************************************************************************************************************/
