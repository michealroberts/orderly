/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { env } from 'cloudflare:workers';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createProducer, MAXIMUM_DELAY_SECONDS, type StandardSchema } from '../src/index';

/*****************************************************************************************************************/

// A queue that records the batches it was handed, because a delay is not observable through the real binding.
const recording = () => {
  const batches: { bodies: unknown[]; options: QueueSendBatchOptions | undefined }[] = [];

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const queue = {
    send: () => Promise.resolve(),
    sendBatch: (
      messages: Iterable<Readonly<MessageSendRequest>>,
      options?: Readonly<QueueSendBatchOptions>,
    ) => {
      batches.push({ bodies: [...messages].map(message => message.body), options });

      return Promise.resolve();
    },
  } as unknown as Queue<string>;

  return { queue, batches };
};

/*****************************************************************************************************************/

// The instant the clock is frozen at while a batch is measured, so the delay it computes is exact rather than
// a second short whenever the runner is slow between the test's reading of the clock and the producer's.
const NOW = new Date('2026-01-15T09:00:00Z');

/*****************************************************************************************************************/

describe('createProducer sends a batch at an instant', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds every body back until the instant, rounding the delay up so none arrives early', async () => {
    const { queue, batches } = recording();

    await createProducer(queue).sendBatch(['one', 'two'], {
      at: new Date(NOW.getTime() + 3_600_500),
    });

    expect(batches).toStrictEqual([{ bodies: ['one', 'two'], options: { delaySeconds: 3601 } }]);
  });

  it('sends at once for an instant already passed', async () => {
    const { queue, batches } = recording();

    await createProducer(queue).sendBatch(['one'], { at: new Date(NOW.getTime() - 5_000) });

    expect(batches).toStrictEqual([{ bodies: ['one'], options: { delaySeconds: 0 } }]);
  });

  it('accepts an instant exactly as far away as a queue holds a message back', async () => {
    const { queue, batches } = recording();

    await createProducer(queue).sendBatch(['one'], {
      at: new Date(NOW.getTime() + MAXIMUM_DELAY_SECONDS * 1000),
    });

    expect(batches).toStrictEqual([
      { bodies: ['one'], options: { delaySeconds: MAXIMUM_DELAY_SECONDS } },
    ]);
  });

  it('reaches the real binding with an instant', async () => {
    const producer = createProducer(env.QUEUE);

    await expect(
      producer.sendBatch(['one', 'two'], { at: new Date(NOW.getTime() + 60_000) }),
    ).resolves.toBeUndefined();
  });
});

/*****************************************************************************************************************/

describe('createProducer refusal of an instant a batch cannot honour', () => {
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
      producer.sendBatch(['one'], {
        at: new Date(NOW.getTime() + (MAXIMUM_DELAY_SECONDS + 1) * 1000),
      }),
    ).rejects.toThrow('the furthest a queue holds a message back');
  });

  it('refuses a delay and an instant together', async () => {
    const producer = createProducer(env.QUEUE);

    await expect(producer.sendBatch(['one'], { delaySeconds: 60, at: NOW })).rejects.toThrow(
      'sendBatch() takes a delay or an instant to send at, not both',
    );
  });

  it('refuses an invalid Date even when there is nothing to send', async () => {
    const producer = createProducer(env.QUEUE);

    await expect(producer.sendBatch([], { at: new Date(Number.NaN) })).rejects.toThrow(
      'sendBatch() requires a valid Date to send at',
    );
  });

  it('still resolves an empty batch without touching the platform when its instant is sound', async () => {
    const { queue, batches } = recording();

    await createProducer(queue).sendBatch([], { at: new Date(NOW.getTime() + 60_000) });

    expect(batches).toStrictEqual([]);
  });
});

/*****************************************************************************************************************/

describe('createProducer reads the clock as the batch is handed over', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the clock after the bodies are parsed, so a slow schema cannot land the batch late', async () => {
    const { queue, batches } = recording();

    // A schema that takes a second per body, moving the frozen clock on as it validates each one.
    const slow: StandardSchema<unknown, string> = {
      '~standard': {
        version: 1,
        vendor: 'orderly-tests',
        validate: value => {
          vi.setSystemTime(new Date(Date.now() + 1_000));

          return { value: String(value) };
        },
      },
    };

    await createProducer(queue, { schema: slow }).sendBatch(['one', 'two'], {
      at: new Date(NOW.getTime() + 3_600_000),
    });

    expect(batches).toStrictEqual([{ bodies: ['one', 'two'], options: { delaySeconds: 3598 } }]);
  });
});

/*****************************************************************************************************************/

describe('createProducer purity with the Date a batch was given', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is unaffected by mutation of the Date it was given while the bodies are parsed', async () => {
    const { queue, batches } = recording();

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

    await createProducer(queue, { schema: spoiling }).sendBatch(['one'], { at });

    expect(batches).toStrictEqual([{ bodies: ['one'], options: { delaySeconds: 3600 } }]);
  });
});

/*****************************************************************************************************************/
