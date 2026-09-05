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

// A queue that records what it was handed, because a delay is not observable through the real binding.
const recording = () => {
  const sends: { body: unknown; options: QueueSendOptions | undefined }[] = [];

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const queue = {
    send: (body: unknown, options?: Readonly<QueueSendOptions>) => {
      sends.push({ body, options });

      return Promise.resolve();
    },
    sendBatch: () => Promise.resolve(),
  } as unknown as Queue<string>;

  return { queue, sends };
};

/*****************************************************************************************************************/

describe('createProducer sends at an instant', () => {
  it('holds the message back until the instant, rounding the delay up so it never arrives early', async () => {
    const { queue, sends } = recording();

    await createProducer(queue).send('hello', { at: new Date(Date.now() + 3_600_000) });

    expect(sends).toStrictEqual([{ body: 'hello', options: { delaySeconds: 3600 } }]);
  });

  it('sends at once for an instant already passed', async () => {
    const { queue, sends } = recording();

    await createProducer(queue).send('hello', { at: new Date(Date.now() - 5_000) });

    expect(sends).toStrictEqual([{ body: 'hello', options: { delaySeconds: 0 } }]);
  });

  it('accepts an instant exactly as far away as a queue holds a message back', async () => {
    const { queue, sends } = recording();

    await createProducer(queue).send('hello', {
      at: new Date(Date.now() + MAXIMUM_DELAY_SECONDS * 1000),
    });

    expect(sends).toStrictEqual([
      { body: 'hello', options: { delaySeconds: MAXIMUM_DELAY_SECONDS } },
    ]);
  });

  it('reaches the real binding with an instant', async () => {
    const producer = createProducer(env.QUEUE);

    await expect(
      producer.send('hello', { at: new Date(Date.now() + 60_000) }),
    ).resolves.toBeUndefined();
  });
});

/*****************************************************************************************************************/

describe('createProducer refusal of an instant it cannot honour', () => {
  it('refuses an instant further away than a queue holds a message back, rather than clamping it', async () => {
    const producer = createProducer(env.QUEUE);

    await expect(
      producer.send('hello', { at: new Date(Date.now() + (MAXIMUM_DELAY_SECONDS + 1) * 1000) }),
    ).rejects.toThrow('the furthest a queue holds a message back');
  });

  it('refuses a delay and an instant together', async () => {
    const producer = createProducer(env.QUEUE);

    await expect(producer.send('hello', { delaySeconds: 60, at: new Date() })).rejects.toThrow(
      'send() takes a delay or an instant to send at, not both',
    );
  });

  it('refuses an invalid Date', async () => {
    const producer = createProducer(env.QUEUE);

    await expect(producer.send('hello', { at: new Date(Number.NaN) })).rejects.toThrow(
      'send() requires a valid Date to send at',
    );
  });
});

/*****************************************************************************************************************/
