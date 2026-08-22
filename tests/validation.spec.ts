/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { createExecutionContext, createMessageBatch, getQueueResult } from 'cloudflare:test';

import { describe, expect, it } from 'vitest';

import {
  createConsumer,
  type CreateConsumerOptions,
  type Event,
  type StandardSchema,
  withoutRetry,
} from '../src/index';

/*****************************************************************************************************************/

// A conforming schema that parses numeric strings, standing in for zod and friends.
const decimal: StandardSchema<unknown, number> = {
  '~standard': {
    version: 1,
    vendor: 'orderly-tests',
    validate: value => {
      const parsed = Number(value);

      return Number.isFinite(parsed)
        ? { value: parsed }
        : { issues: [{ message: 'not a finite number' }] };
    },
  },
};

const parseDecimal = (value: unknown): number => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new TypeError('not a finite number');
  }

  return parsed;
};

const batchOf = (body: string) =>
  createMessageBatch<string>('orderly', [
    { id: 'm1', timestamp: new Date(1_000), body, attempts: 1 },
  ]);

const run = async (body: string, options: CreateConsumerOptions<number>) => {
  const events: Event[] = [];

  const seen: number[] = [];

  const batch = batchOf(body);

  const consumer = createConsumer<number>({
    ...options,
    handle: message => seen.push(message),
    onEvent: event => events.push(event),
  });

  await consumer(batch);

  return {
    seen,
    kinds: events.map(event => event.type),
    events,
    result: await getQueueResult(batch, createExecutionContext()),
  };
};

/*****************************************************************************************************************/

describe('createConsumer validation', () => {
  it('hands the handler the parsed value, not the raw body', async () => {
    const { seen, result } = await run('42.5', {
      handle: () => null,
      retry: withoutRetry(),
      schema: decimal,
    });

    expect(seen).toStrictEqual([42.5]);

    expect(result.explicitAcks).toStrictEqual(['m1']);
  });

  it('settles a failing body as rejected without reaching the handler', async () => {
    const { seen, kinds, result } = await run('not a number', {
      handle: () => null,
      retry: withoutRetry(),
      schema: decimal,
    });

    expect(seen).toStrictEqual([]);

    expect(kinds).toStrictEqual(['batch.received', 'message.started', 'message.rejected']);

    expect(result.explicitAcks).toStrictEqual(['m1']);
  });

  it('accepts a plain parse function that throws on a bad body', async () => {
    const passing = await run('7', {
      handle: () => null,
      retry: withoutRetry(),
      schema: parseDecimal,
    });

    expect(passing.seen).toStrictEqual([7]);

    const failing = await run('nope', {
      handle: () => null,
      retry: withoutRetry(),
      schema: parseDecimal,
    });

    expect(failing.kinds).toContain('message.rejected');
  });
});

/*****************************************************************************************************************/

describe('createConsumer rejection decisions', () => {
  it('retries a rejection when onRejected asks, with the delay clamped', async () => {
    const { kinds, events, result } = await run('nope', {
      handle: () => null,
      retry: withoutRetry(),
      schema: decimal,
      onRejected: () => ({ action: 'retry', delaySeconds: -5 }),
    });

    expect(kinds).toStrictEqual([
      'batch.received',
      'message.started',
      'message.rejected',
      'message.retried',
    ]);

    expect(events.at(-1)).toMatchObject({ type: 'message.retried', delaySeconds: 0 });

    expect(result.retryMessages).toStrictEqual([{ msgId: 'm1' }]);
  });
});

/*****************************************************************************************************************/

describe('createConsumer rejection containment', () => {
  it('converts a rejection into an explicit discard with a reason', async () => {
    const { kinds, events, result } = await run('nope', {
      handle: () => null,
      retry: withoutRetry(),
      schema: decimal,
      onRejected: () => ({ action: 'discard', reason: 'unparseable forever' }),
    });

    expect(kinds).toContain('message.discarded');

    expect(events.at(-1)).toMatchObject({ reason: 'unparseable forever' });

    expect(result.explicitAcks).toStrictEqual(['m1']);
  });

  it('stands by the default when onRejected itself throws', async () => {
    const { kinds, result } = await run('nope', {
      handle: () => null,
      retry: withoutRetry(),
      schema: decimal,
      onRejected: () => {
        throw new Error('observer exploded');
      },
    });

    expect(kinds).toStrictEqual(['batch.received', 'message.started', 'message.rejected']);

    expect(result.explicitAcks).toStrictEqual(['m1']);
  });
});

/*****************************************************************************************************************/
