/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { createExecutionContext, createMessageBatch, getQueueResult } from 'cloudflare:test';

import { describe, expect, it } from 'vitest';

import { applyOutcome } from '../src/index';

/*****************************************************************************************************************/

// The real transport: a platform batch, with the settlement read back through the harness.
const applied = async (outcome: Parameters<typeof applyOutcome>[1]) => {
  const batch = createMessageBatch('orderly', [
    { id: 'm1', timestamp: new Date(1_000), body: 'x', attempts: 1 },
  ]);

  const message = batch.messages[0];

  if (message === undefined) {
    throw new Error('the batch lost its only message');
  }

  applyOutcome(message, outcome);

  return await getQueueResult(batch, createExecutionContext());
};

// A recording stub, for the one fact the harness cannot observe: the delay handed to retry().
const recorded = () => {
  const calls: string[] = [];

  const message: Message = {
    id: 'm1',
    timestamp: new Date(1_000),
    body: null,
    attempts: 1,
    ack: () => {
      calls.push('ack');
    },
    retry: options => {
      calls.push(`retry delaySeconds=${String(options?.delaySeconds)}`);
    },
  };

  return { message, calls };
};

/*****************************************************************************************************************/

describe('applyOutcome against the platform', () => {
  it('acknowledges a succeeded message', async () => {
    const result = await applied({ type: 'succeeded' });

    expect(result.explicitAcks).toStrictEqual(['m1']);

    expect(result.retryMessages).toStrictEqual([]);
  });

  it('acknowledges a discarded message, deliberately', async () => {
    const result = await applied({ type: 'discarded', reason: 'exhausted' });

    expect(result.explicitAcks).toStrictEqual(['m1']);
  });

  it('acknowledges a rejected message', async () => {
    const result = await applied({ type: 'rejected', error: 'unparseable' });

    expect(result.explicitAcks).toStrictEqual(['m1']);
  });

  it('retries a retried message', async () => {
    const result = await applied({ type: 'retried', delaySeconds: 42 });

    expect(result.retryMessages).toStrictEqual([{ msgId: 'm1' }]);

    expect(result.explicitAcks).toStrictEqual([]);
  });
});

/*****************************************************************************************************************/

describe('applyOutcome verb discipline', () => {
  it('calls exactly one verb for every outcome', () => {
    const outcomes = [
      { type: 'succeeded' },
      { type: 'retried', delaySeconds: 5 },
      { type: 'discarded', reason: 'exhausted' },
      { type: 'rejected', error: 'unparseable' },
    ] as const;

    for (const outcome of outcomes) {
      const { message, calls } = recorded();

      applyOutcome(message, outcome);

      expect(calls).toHaveLength(1);
    }
  });

  it('forwards the decided delay to retry, zero included', () => {
    for (const delaySeconds of [42, 0]) {
      const { message, calls } = recorded();

      applyOutcome(message, { type: 'retried', delaySeconds });

      expect(calls).toStrictEqual([`retry delaySeconds=${String(delaySeconds)}`]);
    }
  });
});

/*****************************************************************************************************************/
