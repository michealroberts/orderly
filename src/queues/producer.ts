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
  // Enqueues one body, optionally delayed. Delays are floored and clamped into the platform bounds.
  send: (body: Body, options?: { delaySeconds?: number }) => Promise<void>;
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
      await queue.send(await parse(body), clamped(sendOptions?.delaySeconds));
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
