/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

export { statusOf } from './events/index';

export type { Event, Outcome, Status } from './events/index';

export { MAXIMUM_DELAY_SECONDS, withExponentialRetryBackoff } from './retry/index';

export type { ExponentialRetryBackoffOptions, RetryDecision, RetryPolicy } from './retry/index';

/*****************************************************************************************************************/
