/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { MAXIMUM_DELAY_SECONDS, settle, withFixedRetryBackoff, withoutRetry } from '../src/index';

import type { RetryPolicy } from '../src/index';

/*****************************************************************************************************************/

const base = { id: 'm1', attempts: 1, startedAt: 1_000, settledAt: 1_250 };

const throwing: RetryPolicy = () => {
  throw new Error('policy exploded');
};

const sloppy = (delaySeconds: number): RetryPolicy => {
  return () => ({ action: 'retry', delaySeconds });
};

/*****************************************************************************************************************/

describe('settle on success', () => {
  it('acknowledges with a single succeeded event carrying the duration', () => {
    expect(settle({ threw: false }, { ...base, retry: withoutRetry() })).toStrictEqual({
      outcome: { type: 'succeeded' },
      events: [{ type: 'message.succeeded', id: 'm1', durationMs: 250, at: 1_250 }],
    });
  });

  it('never reports a negative duration', () => {
    const settlement = settle(
      { threw: false },
      { ...base, startedAt: 2_000, settledAt: 1_000, retry: withoutRetry() },
    );

    expect(settlement.events).toStrictEqual([
      { type: 'message.succeeded', id: 'm1', durationMs: 0, at: 1_000 },
    ]);
  });
});

/*****************************************************************************************************************/

describe('settle on failure', () => {
  it('emits the failure and the retry decided about it', () => {
    const error = new TypeError('boom');

    const settlement = settle(
      { threw: true, error },
      { ...base, retry: withFixedRetryBackoff({ delaySeconds: 30 }) },
    );

    expect(settlement.outcome).toStrictEqual({ type: 'retried', delaySeconds: 30 });

    expect(settlement.events).toHaveLength(2);

    expect(settlement.events[0]).toMatchObject({
      type: 'message.failed',
      id: 'm1',
      error: { name: 'TypeError', message: 'boom' },
      at: 1_250,
    });

    expect(settlement.events[1]).toStrictEqual({
      type: 'message.retried',
      id: 'm1',
      delaySeconds: 30,
      at: 1_250,
    });
  });

  it('emits the failure and the discard decided about it', () => {
    const settlement = settle(
      { threw: true, error: new Error('boom') },
      { ...base, retry: withoutRetry() },
    );

    expect(settlement.outcome).toStrictEqual({ type: 'discarded', reason: 'retries are disabled' });

    expect(settlement.events[1]).toStrictEqual({
      type: 'message.discarded',
      id: 'm1',
      reason: 'retries are disabled',
      at: 1_250,
    });
  });
});

/*****************************************************************************************************************/

describe('settle error snapshots and policy input', () => {
  it('snapshots a thrown value that is not an Error without a stack', () => {
    const settlement = settle({ threw: true, error: 'boom' }, { ...base, retry: withoutRetry() });

    expect(settlement.events[0]).toStrictEqual({
      type: 'message.failed',
      id: 'm1',
      error: { name: 'Error', message: 'boom' },
      at: 1_250,
    });
  });

  it('hands the policy the attempt count and the thrown error', () => {
    const seen: unknown[] = [];

    const policy: RetryPolicy = context => {
      seen.push(context);

      return { action: 'discard', reason: 'seen' };
    };

    const error = new Error('boom');

    settle({ threw: true, error }, { ...base, attempts: 7, retry: policy });

    expect(seen).toStrictEqual([{ attempts: 7, error }]);
  });
});

/*****************************************************************************************************************/

describe('settle defensiveness', () => {
  it('discards rather than crashing when the policy itself throws', () => {
    const settlement = settle(
      { threw: true, error: new Error('boom') },
      { ...base, retry: throwing },
    );

    expect(settlement.outcome).toStrictEqual({
      type: 'discarded',
      reason: 'the retry policy threw',
    });
  });

  it('floors and clamps a sloppy custom delay into the platform bounds', () => {
    const outcomeOf = (policy: RetryPolicy) =>
      settle({ threw: true, error: new Error('boom') }, { ...base, retry: policy }).outcome;

    expect(outcomeOf(sloppy(2.9))).toStrictEqual({ type: 'retried', delaySeconds: 2 });

    expect(outcomeOf(sloppy(-10))).toStrictEqual({ type: 'retried', delaySeconds: 0 });

    expect(outcomeOf(sloppy(1_000_000))).toStrictEqual({
      type: 'retried',
      delaySeconds: MAXIMUM_DELAY_SECONDS,
    });
  });
});

/*****************************************************************************************************************/
