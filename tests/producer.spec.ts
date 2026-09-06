/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { env } from 'cloudflare:workers';

import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

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

// The instant the clock is frozen at while a send is measured, so the delay it computes is exact rather than
// a second short whenever the runner is slow between the test's reading of the clock and the producer's.
const NOW = new Date('2026-01-15T09:00:00Z');

/*****************************************************************************************************************/

describe('createProducer sends at an instant', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds the message back until the instant, rounding the delay up so it never arrives early', async () => {
    const { queue, sends } = recording();

    await createProducer(queue).send('hello', { at: new Date(NOW.getTime() + 3_600_500) });

    expect(sends).toStrictEqual([{ body: 'hello', options: { delaySeconds: 3601 } }]);
  });

  it('sends at once for an instant already passed', async () => {
    const { queue, sends } = recording();

    await createProducer(queue).send('hello', { at: new Date(NOW.getTime() - 5_000) });

    expect(sends).toStrictEqual([{ body: 'hello', options: { delaySeconds: 0 } }]);
  });

  it('accepts an instant exactly as far away as a queue holds a message back', async () => {
    const { queue, sends } = recording();

    await createProducer(queue).send('hello', {
      at: new Date(NOW.getTime() + MAXIMUM_DELAY_SECONDS * 1000),
    });

    expect(sends).toStrictEqual([
      { body: 'hello', options: { delaySeconds: MAXIMUM_DELAY_SECONDS } },
    ]);
  });

  it('reaches the real binding with an instant', async () => {
    const producer = createProducer(env.QUEUE);

    await expect(
      producer.send('hello', { at: new Date(NOW.getTime() + 60_000) }),
    ).resolves.toBeUndefined();
  });
});

/*****************************************************************************************************************/

describe('createProducer reads the clock as the message is handed over', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the clock after the body is parsed, so a slow schema cannot land the message late', async () => {
    const { queue, sends } = recording();

    // A schema that takes two seconds, moving the frozen clock on as it validates. The delay counts from the
    // moment the message is handed over, so it must be two seconds shorter, not the same as before the parse.
    const slow: StandardSchema<unknown, string> = {
      '~standard': {
        version: 1,
        vendor: 'orderly-tests',
        validate: value => {
          vi.setSystemTime(new Date(NOW.getTime() + 2_000));

          return { value: String(value) };
        },
      },
    };

    await createProducer(queue, { schema: slow }).send('hello', {
      at: new Date(NOW.getTime() + 3_600_000),
    });

    expect(sends).toStrictEqual([{ body: 'hello', options: { delaySeconds: 3598 } }]);
  });
});

/*****************************************************************************************************************/

describe('createProducer purity with the Date it was given', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is unaffected by mutation of the Date it was given while the body is parsed', async () => {
    const { queue, sends } = recording();

    const at = new Date(NOW.getTime() + 3_600_000);

    // A schema that reaches back and spoils the Date mid-parse: the instant was read before the parse began.
    const spoiling: StandardSchema<unknown, string> = {
      '~standard': {
        version: 1,
        vendor: 'orderly-tests',
        validate: value => {
          at.setTime(Number.NaN);

          return { value: String(value) };
        },
      },
    };

    await createProducer(queue, { schema: spoiling }).send('hello', { at });

    expect(sends).toStrictEqual([{ body: 'hello', options: { delaySeconds: 3600 } }]);
  });
});

/*****************************************************************************************************************/

describe('createProducer refusal of an instant it cannot honour', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refuses an instant a second past what a queue holds back, rather than clamping it', async () => {
    const producer = createProducer(env.QUEUE);

    await expect(
      producer.send('hello', { at: new Date(NOW.getTime() + (MAXIMUM_DELAY_SECONDS + 1) * 1000) }),
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
