/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

export type { MessageContext } from './consumer/index';

export { statusOf } from './events/index';

export type { Event, Outcome, Status } from './events/index';

export { compose } from './middleware/index';

export type { Middleware } from './middleware/index';

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
