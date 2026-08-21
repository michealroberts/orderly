/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { createExecutionContext, createMessageBatch, getQueueResult } from 'cloudflare:test';

import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  createConsumer,
  type CreateConsumerOptions,
  type Event,
  type Middleware,
  withFixedRetryBackoff,
  withoutRetry,
} from '../src/index';

/*****************************************************************************************************************/

const batchOf = (bodies: Record<string, string>) =>
  createMessageBatch<string>(
    'orderly',
    Object.entries(bodies).map(([id, body], index) => ({
      id,
      timestamp: new Date(1_000 + index),
      body,
      attempts: 1,
    })),
  );

const run = async (
  batch: ReturnType<typeof batchOf>,
  options: CreateConsumerOptions<string>,
): Promise<{ events: Event[]; result: Awaited<ReturnType<typeof getQueueResult>> }> => {
  const events: Event[] = [];

  const consumer = createConsumer<string>({
    ...options,
    onEvent: event => {
      events.push(event);

      options.onEvent?.(event);
    },
  });

  await consumer(batch);

  return { events, result: await getQueueResult(batch, createExecutionContext()) };
};

const kinds = (events: Event[]) => events.map(event => event.type);

const succeed = (): null => null;

const explode = (): never => {
  throw new Error('boom');
};

const explodeOn = (target: string) => {
  return (message: string): null => (message === target ? explode() : null);
};

const substitute: Middleware<string> = async (_message, _context, next) => {
  await next();

  return { type: 'retried', delaySeconds: 60 };
};

const broken: Middleware<string> = () => {
  throw new Error('layer exploded');
};

/*****************************************************************************************************************/

describe('createConsumer settlement', () => {
  it('acknowledges a returning handler and logs the whole story', async () => {
    const { events, result } = await run(batchOf({ m1: 'hello' }), {
      handle: succeed,
      retry: withoutRetry(),
    });

    expect(result.explicitAcks).toStrictEqual(['m1']);

    expect(kinds(events)).toStrictEqual(['batch.received', 'message.started', 'message.succeeded']);
  });

  it('retries a throwing handler with the policy delay and logs fact then decision', async () => {
    const { events, result } = await run(batchOf({ m1: 'hello' }), {
      handle: explode,
      retry: withFixedRetryBackoff({ delaySeconds: 30 }),
    });

    expect(result.retryMessages).toStrictEqual([{ msgId: 'm1' }]);

    expect(kinds(events)).toStrictEqual([
      'batch.received',
      'message.started',
      'message.failed',
      'message.retried',
    ]);
  });
});

/*****************************************************************************************************************/

describe('createConsumer discard and isolation', () => {
  it('acknowledges a discarded message, deliberately', async () => {
    const { events, result } = await run(batchOf({ m1: 'hello' }), {
      handle: explode,
      retry: withoutRetry(),
    });

    expect(result.explicitAcks).toStrictEqual(['m1']);

    expect(kinds(events)).toContain('message.discarded');
  });

  it('settles every message independently', async () => {
    const { result } = await run(batchOf({ m1: 'succeed', m2: 'fail' }), {
      handle: explodeOn('fail'),
      retry: withFixedRetryBackoff({ delaySeconds: 5 }),
    });

    expect(result.explicitAcks).toStrictEqual(['m1']);

    expect(result.retryMessages).toStrictEqual([{ msgId: 'm2' }]);
  });
});

/*****************************************************************************************************************/

describe('createConsumer middleware', () => {
  it('runs the chain around the handler and passes the outcome through', async () => {
    const order: string[] = [];

    const layer: Middleware<string> = async (_message, _context, next) => {
      order.push('before');

      const outcome = await next();

      order.push('after');

      return outcome;
    };

    const { result } = await run(batchOf({ m1: 'hello' }), {
      handle: () => order.push('handle'),
      retry: withoutRetry(),
      use: [layer],
    });

    expect(order).toStrictEqual(['before', 'handle', 'after']);

    expect(result.explicitAcks).toStrictEqual(['m1']);
  });

  it('applies a substituted outcome and logs the decision that was applied', async () => {
    const { events, result } = await run(batchOf({ m1: 'hello' }), {
      handle: succeed,
      retry: withoutRetry(),
      use: [substitute],
    });

    expect(result.retryMessages).toStrictEqual([{ msgId: 'm1' }]);

    expect(kinds(events)).toStrictEqual(['batch.received', 'message.started', 'message.retried']);
  });
});

/*****************************************************************************************************************/

describe('createConsumer middleware failure', () => {
  it('settles through the retry policy when a middleware throws', async () => {
    const { events, result } = await run(batchOf({ m1: 'hello' }), {
      handle: succeed,
      retry: withFixedRetryBackoff({ delaySeconds: 10 }),
      use: [broken],
    });

    expect(result.retryMessages).toStrictEqual([{ msgId: 'm1' }]);

    expect(kinds(events)).toContain('message.failed');
  });
});

/*****************************************************************************************************************/

describe('createConsumer observers', () => {
  it('hands onBatch the batch facts before any message', async () => {
    const facts: unknown[] = [];

    await run(batchOf({ m1: 'hello', m2: 'world' }), {
      handle: succeed,
      retry: withoutRetry(),
      onBatch: received => facts.push(received),
    });

    expect(facts).toHaveLength(1);

    expect(facts[0]).toMatchObject({ queue: 'orderly', size: 2 });
  });

  it('contains a throwing onBatch and a throwing onEvent', async () => {
    const { result } = await run(batchOf({ m1: 'hello' }), {
      handle: succeed,
      retry: withoutRetry(),
      onBatch: () => {
        throw new Error('observer exploded');
      },
      onEvent: () => {
        throw new Error('sink exploded');
      },
    });

    expect(result.explicitAcks).toStrictEqual(['m1']);
  });

  it('is assignable to the queue slot of an exported handler', () => {
    const consumer = createConsumer<string>({ handle: succeed, retry: withoutRetry() });

    expectTypeOf(consumer).toExtend<
      NonNullable<ExportedHandler<Cloudflare.Env, string>['queue']>
    >();
  });
});

/*****************************************************************************************************************/
