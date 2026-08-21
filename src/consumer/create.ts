/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/consumer
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import type { Event, Outcome } from '../events/index';

import { compose, type Middleware } from '../middleware/index';

import type { RetryPolicy } from '../retry/index';

import type { MessageContext } from './context';

import { type HandlerResult, settle, type Settlement } from './settle';

import { applyOutcome } from './transport';

/*****************************************************************************************************************/

export interface CreateConsumerOptions<Body> {
  // The handler for one message. Returning settles it as succeeded; throwing hands the error to the retry
  // policy. The returned value is ignored.
  handle: (message: Body, context: MessageContext) => unknown;
  // What to do about a throw.
  retry: RetryPolicy;
  // The middleware chain, outermost first.
  use?: readonly Middleware<Body>[];
  // Called once per batch, before any message is handled, with the batch level facts.
  onBatch?: (facts: {
    queue: string;
    size: number;
    lagMs: number;
    backlogCount: number;
    backlogBytes: number;
  }) => unknown;
  // Called for every event emitted. A sink that throws is contained and never affects settlement.
  onEvent?: (event: Event) => unknown;
}

/*****************************************************************************************************************/

// Everything one message needs to settle, threaded once rather than captured ad hoc.
interface Tools<Body> {
  chain: Middleware<Body>;
  emit: (event: Event) => void;
  handle: (message: Body, context: MessageContext) => unknown;
  queue: string;
  retry: RetryPolicy;
  signal: AbortSignal;
}

/*****************************************************************************************************************/

// The decision event for an outcome a middleware substituted, where settle never saw the final decision.
const decisionEvent = (outcome: Outcome, id: string, startedAt: number, at: number): Event => {
  switch (outcome.type) {
    case 'succeeded': {
      return { type: 'message.succeeded', id, durationMs: Math.max(at - startedAt, 0), at };
    }
    case 'retried': {
      return { type: 'message.retried', id, delaySeconds: outcome.delaySeconds, at };
    }
    case 'discarded': {
      return { type: 'message.discarded', id, reason: outcome.reason, at };
    }
    case 'rejected': {
      return { type: 'message.rejected', id, at };
    }
    default: {
      // Unreachable for TypeScript callers, but a middleware written in JavaScript can return anything.
      throw new Error(`unrecognised outcome: ${JSON.stringify(outcome)}`);
    }
  }
};

/*****************************************************************************************************************/

// When the chain passed settle's own outcome through, its events are already the truth. When a middleware
// substituted or short-circuited, the failure fact, if any, still holds, and the decision event follows the
// outcome actually applied.
const emitSettlement = (
  emit: (event: Event) => void,
  settled: Settlement | null,
  outcome: Outcome,
  id: string,
  startedAt: number,
): void => {
  if (settled !== null && settled.outcome === outcome) {
    for (const event of settled.events) {
      emit(event);
    }

    return;
  }

  const fact = settled?.events.find(event => event.type === 'message.failed');

  if (fact !== undefined) {
    emit(fact);
  }

  emit(decisionEvent(outcome, id, startedAt, Date.now()));
};

/*****************************************************************************************************************/

const settleMessage = async <Body>(message: Message<Body>, tools: Tools<Body>): Promise<void> => {
  const { chain, emit, handle, queue, retry, signal } = tools;

  const startedAt = Date.now();

  const { id, attempts, timestamp } = message;

  const context: MessageContext = { id, attempts, timestamp, queue, signal };

  emit({ type: 'message.started', id, attempts, at: startedAt });

  let settlement: Settlement | null = null;

  const terminal = async (): Promise<Outcome> => {
    let result: HandlerResult;

    try {
      await handle(message.body, context);

      result = { threw: false };
    } catch (error) {
      result = { threw: true, error };
    }

    settlement = settle(result, { id, attempts, retry, startedAt, settledAt: Date.now() });

    return settlement.outcome;
  };

  let outcome: Outcome;

  try {
    outcome = await chain(message.body, context, terminal);
  } catch (error) {
    // A middleware that throws, or calls next() twice, settles the message through the retry policy rather
    // than crashing the batch.
    settlement = settle(
      { threw: true, error },
      { id, attempts, retry, startedAt, settledAt: Date.now() },
    );

    outcome = settlement.outcome;
  }

  emitSettlement(emit, settlement, outcome, id, startedAt);

  applyOutcome(message, outcome);
};

/*****************************************************************************************************************/

// The batch level facts: the received event first, then the observer, both contained.
const announceBatch = <Body>(
  batch: MessageBatch<Body>,
  receivedAt: number,
  emit: (event: Event) => void,
  onBatch: CreateConsumerOptions<Body>['onBatch'],
): void => {
  const oldest = batch.messages.reduce(
    (earliest, message) => Math.min(earliest, message.timestamp.getTime()),
    receivedAt,
  );

  const lagMs = Math.max(receivedAt - oldest, 0);

  const size = batch.messages.length;

  emit({ type: 'batch.received', queue: batch.queue, size, lagMs, at: receivedAt });

  if (onBatch === undefined) {
    return;
  }

  try {
    const { backlogCount, backlogBytes } = batch.metadata.metrics;

    onBatch({ queue: batch.queue, size, lagMs, backlogCount, backlogBytes });
  } catch {
    // A throwing observer must never affect settlement.
  }
};

/*****************************************************************************************************************/

// Assembles the consumer: per message isolation, the middleware chain around a settling terminal, exactly one
// transport verb per message, and an event for everything. The returned handler never rejects, because a
// rejected queue handler makes the platform retry the whole batch, acknowledged messages included, which is the
// failure mode this module exists to remove.
export const createConsumer = <Body = unknown>(options: CreateConsumerOptions<Body>) => {
  const { handle, retry, use = [], onBatch, onEvent } = options;

  const chain = compose<Body>(use);

  return async (batch: MessageBatch<Body>): Promise<void> => {
    const emit = (event: Event): void => {
      try {
        onEvent?.(event);
      } catch {
        // A throwing sink must never affect settlement.
      }
    };

    announceBatch(batch, Date.now(), emit, onBatch);

    const controller = new AbortController();

    const tools: Tools<Body> = {
      chain,
      emit,
      handle,
      queue: batch.queue,
      retry,
      signal: controller.signal,
    };

    await Promise.all(
      batch.messages.map(message =>
        settleMessage(message, tools).catch(() => {
          // The transport itself refused; the platform treats an unsettled message as a retry.
        }),
      ),
    );
  };
};

/*****************************************************************************************************************/
