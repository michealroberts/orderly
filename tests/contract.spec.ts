/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { createExecutionContext, createMessageBatch, getQueueResult } from 'cloudflare:test';

import { env } from 'cloudflare:workers';

import { describe, expect, expectTypeOf, it } from 'vitest';

import { defineQueue, type Event, type StandardSchema, withoutRetry } from '../src/index';

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

const contract = defineQueue<number>({ name: 'orderly', schema: decimal });

const batchOf = (body: string) =>
  createMessageBatch<string>('orderly', [
    { id: 'm1', timestamp: new Date(1_000), body, attempts: 1 },
  ]);

/*****************************************************************************************************************/

describe('defineQueue', () => {
  it('carries the name it was defined with', () => {
    expect(contract.name).toBe('orderly');
  });

  it('binds the schema to the producing end', async () => {
    const producer = contract.producer(env.QUEUE);

    // A JavaScript caller can hand send anything; the schema is the runtime guard this asserts.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    await expect(producer.send('nope' as unknown as number)).rejects.toThrow(
      'the body failed validation and was not enqueued',
    );

    await expect(producer.send(42)).resolves.toBeUndefined();
  });

  it('binds the schema to the consuming end and hands the handler the parsed value', async () => {
    const seen: number[] = [];

    const consumer = contract.consumer({
      retry: withoutRetry(),
      handle: message => seen.push(message),
    });

    const batch = batchOf('42.5');

    await consumer(batch);

    expect(seen).toStrictEqual([42.5]);

    const result = await getQueueResult(batch, createExecutionContext());

    expect(result.explicitAcks).toStrictEqual(['m1']);
  });
});

/*****************************************************************************************************************/

describe('defineQueue rejection and typing', () => {
  it('settles a body that fails the contract as rejected', async () => {
    const events: Event[] = [];

    const consumer = contract.consumer({
      retry: withoutRetry(),
      handle: () => null,
      onEvent: event => events.push(event),
    });

    await consumer(batchOf('not a number'));

    expect(events.map(event => event.type)).toContain('message.rejected');
  });

  it('offers no schema slot on the consuming options: the contract owns it', () => {
    expectTypeOf<Parameters<typeof contract.consumer>[0]>().not.toHaveProperty('schema');
  });
});

/*****************************************************************************************************************/
