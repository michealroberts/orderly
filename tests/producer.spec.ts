/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { env } from 'cloudflare:workers';

import { describe, expect, expectTypeOf, it } from 'vitest';

import { createProducer, MAXIMUM_DELAY_SECONDS, type StandardSchema } from '../src/index';

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

/*****************************************************************************************************************/

describe('createProducer', () => {
  it('sends a body through the binding', async () => {
    const producer = createProducer(env.QUEUE);

    await expect(producer.send('hello')).resolves.toBeUndefined();
  });

  it('clamps a delay past the platform ceiling instead of failing the send', async () => {
    const producer = createProducer(env.QUEUE);

    await expect(
      producer.send('hello', { delaySeconds: MAXIMUM_DELAY_SECONDS + 1_000 }),
    ).resolves.toBeUndefined();
  });

  it('clamps a negative delay to zero', async () => {
    const producer = createProducer(env.QUEUE);

    await expect(producer.send('hello', { delaySeconds: -30 })).resolves.toBeUndefined();
  });

  it('types the body through the generic', () => {
    const producer = createProducer<{ id: string }>(env.QUEUE);

    expectTypeOf(producer.send).parameter(0).toEqualTypeOf<{ id: string }>();
  });
});

/*****************************************************************************************************************/

describe('createProducer batches and validation', () => {
  it('sends many bodies in one call', async () => {
    const producer = createProducer(env.QUEUE);

    await expect(producer.sendBatch(['one', 'two', 'three'])).resolves.toBeUndefined();
  });

  it('resolves an empty batch without touching the platform', async () => {
    const producer = createProducer(env.QUEUE);

    await expect(producer.sendBatch([])).resolves.toBeUndefined();
  });

  it('refuses to enqueue a body that fails the schema', async () => {
    const producer = createProducer<number>(env.QUEUE, { schema: decimal });

    // A JavaScript caller can hand send anything; the schema is the runtime guard this asserts.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    await expect(producer.send('nope' as unknown as number)).rejects.toThrow(
      'the body failed validation and was not enqueued',
    );
  });

  it('enqueues the parsed value when the schema passes', async () => {
    const producer = createProducer<number>(env.QUEUE, { schema: decimal });

    // A JavaScript caller can hand send anything; the schema is the runtime guard this asserts.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    await expect(producer.send('42.5' as unknown as number)).resolves.toBeUndefined();
  });
});

/*****************************************************************************************************************/
