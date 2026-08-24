/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

export { applyOutcome, createConsumer, settle } from './consumer/index';

export type {
  BodySchema,
  CreateConsumerOptions,
  HandlerResult,
  MessageContext,
  SettleOptions,
  Settlement,
} from './consumer/index';

export { statusOf } from './events/index';

export type { Event, Outcome, Status } from './events/index';

export { compose } from './middleware/index';

export type { Middleware } from './middleware/index';

export { add, at, durationInMilliseconds, every, preview, subtract } from './schedules/index';

export type { Anchor, Duration, Interval, PreviewOptions, Schedule } from './schedules/index';

export { createProducer, defineQueue } from './queues/index';

export type {
  CreateProducerOptions,
  DefineQueueOptions,
  Producer,
  QueueContract,
} from './queues/index';

export type {
  StandardSchema,
  StandardSchemaIssue,
  StandardSchemaProperties,
  StandardSchemaResult,
} from './schema/index';

export {
  MAXIMUM_DELAY_SECONDS,
  withExponentialRetryBackoff,
  withFixedRetryBackoff,
  withImmediateRetry,
  withoutRetry,
} from './retry/index';

export type {
  ExponentialRetryBackoffOptions,
  FixedRetryBackoffOptions,
  ImmediateRetryOptions,
  RetryDecision,
  RetryPolicy,
} from './retry/index';

/*****************************************************************************************************************/
