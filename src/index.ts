/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

export { statusOf } from './events/index';

export type { Event, Outcome, Status } from './events/index';

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
