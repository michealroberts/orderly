/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/queues
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { type BodySchema, createConsumer, type CreateConsumerOptions } from '../consumer/index';

import { createProducer, type Producer } from './producer';

/*****************************************************************************************************************/

export interface DefineQueueOptions<Body> {
  // The queue's name as declared in the wrangler configuration. Carried as metadata on the contract; nothing
  // is enforced against it at runtime.
  name: string;
  // Validates bodies on both ends: the producer refuses to enqueue a bad one, the consumer settles one as
  // rejected. Declared once here so the two ends can never disagree about the shape.
  schema?: BodySchema<Body>;
}

/*****************************************************************************************************************/

export interface QueueContract<Body> {
  // The name the contract was defined with.
  readonly name: string;
  // The producing end, bound to this contract's schema.
  producer: (queue: Queue<Body>) => Producer<Body>;
  // The consuming end, bound to this contract's schema, which is why these options cannot carry one.
  consumer: (
    options: Omit<CreateConsumerOptions<Body>, 'schema'>,
  ) => (batch: MessageBatch) => Promise<void>;
}

/*****************************************************************************************************************/

// The shared contract: the payload type and its schema declared once, with both ends derived from it. What the
// producer sends is what the consumer's handler receives, and neither side can drift alone.
export const defineQueue = <Body>(options: DefineQueueOptions<Body>): QueueContract<Body> => {
  const { name, schema } = options;

  return {
    name,
    producer: queue => createProducer(queue, schema === undefined ? {} : { schema }),
    consumer: consumerOptions =>
      createConsumer({ ...consumerOptions, ...(schema === undefined ? {} : { schema }) }),
  };
};

/*****************************************************************************************************************/
