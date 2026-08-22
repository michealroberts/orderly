/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { createExecutionContext, createMessageBatch, getQueueResult } from 'cloudflare:test';

import { describe, expect, it } from 'vitest';

import { createConsumer, withoutRetry } from '../src/index';

import { forEachConcurrently } from '../src/consumer/concurrency';

/*****************************************************************************************************************/

// Tracks how many work items are in flight at once, yielding a microtask so workers interleave.
const gauge = () => {
  let active = 0;

  let peak = 0;

  const work = async (): Promise<void> => {
    active += 1;

    peak = Math.max(peak, active);

    await Promise.resolve();

    active -= 1;
  };

  return { work, peak: () => peak };
};

const batchOf = (ids: string[]) =>
  createMessageBatch<string>(
    'orderly',
    ids.map((id, index) => ({ id, timestamp: new Date(1_000 + index), body: id, attempts: 1 })),
  );

/*****************************************************************************************************************/

describe('forEachConcurrently', () => {
  it('processes every item and never exceeds the limit', async () => {
    const { work, peak } = gauge();

    const seen: number[] = [];

    await forEachConcurrently([1, 2, 3, 4, 5], 2, async item => {
      seen.push(item);

      await work();
    });

    expect(seen).toStrictEqual([1, 2, 3, 4, 5]);

    expect(peak()).toBeLessThanOrEqual(2);
  });

  it('is strictly serial with a limit of one', async () => {
    const { work, peak } = gauge();

    await forEachConcurrently([1, 2, 3], 1, work);

    expect(peak()).toBe(1);
  });

  it('runs everything at once when the limit exceeds the item count', async () => {
    const { work, peak } = gauge();

    await forEachConcurrently([1, 2, 3], 100, work);

    expect(peak()).toBe(3);
  });

  it('resolves immediately for no items', async () => {
    await expect(forEachConcurrently([], 4, () => Promise.resolve())).resolves.toBeUndefined();
  });
});

/*****************************************************************************************************************/

describe('forEachConcurrently sloppy limits', () => {
  it.each([
    [0, 1],
    [-5, 1],
    [2.9, 2],
  ])('clamps a limit of %d to %d workers', async (limit, expected) => {
    const { work, peak } = gauge();

    await forEachConcurrently([1, 2, 3, 4], limit, work);

    expect(peak()).toBeLessThanOrEqual(expected);
  });

  it('treats a limit that is not finite as everything at once', async () => {
    const { work, peak } = gauge();

    await forEachConcurrently([1, 2, 3], Number.POSITIVE_INFINITY, work);

    expect(peak()).toBe(3);
  });
});

/*****************************************************************************************************************/

describe('createConsumer concurrency', () => {
  it('settles one message at a time with a concurrency of one', async () => {
    const order: string[] = [];

    const consumer = createConsumer<string>({
      concurrency: 1,
      retry: withoutRetry(),
      handle: async message => {
        order.push(`${message} started`);

        await Promise.resolve();

        order.push(`${message} finished`);
      },
    });

    const batch = batchOf(['m1', 'm2']);

    await consumer(batch);

    expect(order).toStrictEqual(['m1 started', 'm1 finished', 'm2 started', 'm2 finished']);

    const result = await getQueueResult(batch, createExecutionContext());

    expect(result.explicitAcks).toStrictEqual(['m1', 'm2']);
  });

  it('settles the whole batch together by default', async () => {
    const order: string[] = [];

    const consumer = createConsumer<string>({
      retry: withoutRetry(),
      handle: async message => {
        order.push(`${message} started`);

        await Promise.resolve();

        order.push(`${message} finished`);
      },
    });

    await consumer(batchOf(['m1', 'm2']));

    expect(order.slice(0, 2)).toStrictEqual(['m1 started', 'm2 started']);
  });
});

/*****************************************************************************************************************/
