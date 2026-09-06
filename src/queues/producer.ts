/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/queues
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import type { BodySchema } from '../consumer/index';

import { parseBody } from '../consumer/validation';

import { MAXIMUM_DELAY_SECONDS } from '../retry/index';

/*****************************************************************************************************************/

export interface CreateProducerOptions<Body> {
  // Validates a body before it is enqueued: a bad body throws instead of reaching the queue, and the parsed
  // value is what gets sent, so producer and consumer see the same normalized shape.
  schema?: BodySchema<Body>;
}

/*****************************************************************************************************************/

export interface Producer<Body> {
  // Enqueues one body, optionally held back: by a delay, floored and clamped into the platform bounds, or until
  // an instant, refused rather than clamped when it lies further away than a queue holds a message back.
  send: (body: Body, options?: { delaySeconds?: number; at?: Date }) => Promise<void>;
  // Enqueues many bodies in one call, optionally all delayed. An empty list resolves without touching the
  // platform.
  sendBatch: (bodies: readonly Body[], options?: { delaySeconds?: number }) => Promise<void>;
}

/*****************************************************************************************************************/

const clamped = (delaySeconds: number | undefined): { delaySeconds: number } | undefined => {
  if (delaySeconds === undefined) {
    return undefined;
  }

  return { delaySeconds: Math.floor(Math.max(Math.min(delaySeconds, MAXIMUM_DELAY_SECONDS), 0)) };
};

/*****************************************************************************************************************/

// The instant a send is held back until, as milliseconds, or undefined when it carries a delay or nothing. Read
// before anything is awaited, so an invalid Date, or a delay given beside the instant, is refused before the
// body is parsed, and so the caller's Date is never held across that parse: a Date is mutable, and one changed
// while the body was being validated must not change what was asked for.
const instantOf = (
  options: { delaySeconds?: number; at?: Date } | undefined,
): number | undefined => {
  if (options?.at === undefined) {
    return undefined;
  }

  if (options.delaySeconds !== undefined) {
    throw new RangeError('send() takes a delay or an instant to send at, not both');
  }

  const instant = options.at.getTime();

  if (Number.isNaN(instant)) {
    throw new RangeError('send() requires a valid Date to send at');
  }

  return instant;
};

/*****************************************************************************************************************/

// The seconds until an instant, rounded up so a message is never delivered early, and zero for an instant
// already passed. An instant past the platform ceiling is refused rather than clamped, because an appointment
// quietly moved to a day from now is not the appointment that was asked for.
const secondsUntil = (instant: number): number => {
  const seconds = Math.max(Math.ceil((instant - Date.now()) / 1000), 0);

  if (seconds > MAXIMUM_DELAY_SECONDS) {
    throw new RangeError(
      `an instant to send at must lie within ${MAXIMUM_DELAY_SECONDS} seconds, ` +
        'the furthest a queue holds a message back',
    );
  }

  return seconds;
};

/*****************************************************************************************************************/

// The typed producing end. With a schema, every body is parsed before it is enqueued, which catches a bad
// producer at the source rather than as a rejection on the consuming end.
export const createProducer = <Body>(
  queue: Queue<Body>,
  options: CreateProducerOptions<Body> = {},
): Producer<Body> => {
  const { schema } = options;

  const parse = async (body: Body): Promise<Body> => {
    if (schema === undefined) {
      return body;
    }

    const attempt = await parseBody(schema, body);

    if (attempt.parsed) {
      return attempt.value;
    }

    throw new Error('the body failed validation and was not enqueued', { cause: attempt.error });
  };

  return {
    send: async (body, sendOptions) => {
      const instant = instantOf(sendOptions);

      const parsed = await parse(body);

      // The clock is read last, at the moment the message is handed over, because the delay counts from that
      // moment: read before the parse, the time the parse took would be added to it, and the message would
      // land late by exactly that long.
      await queue.send(
        parsed,
        instant === undefined
          ? clamped(sendOptions?.delaySeconds)
          : { delaySeconds: secondsUntil(instant) },
      );
    },
    sendBatch: async (bodies, sendOptions) => {
      if (bodies.length === 0) {
        return;
      }

      const parsed = await Promise.all(bodies.map(body => parse(body)));

      await queue.sendBatch(
        parsed.map(body => ({ body })),
        clamped(sendOptions?.delaySeconds),
      );
    },
  };
};

/*****************************************************************************************************************/
