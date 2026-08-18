/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/retry
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { MAXIMUM_DELAY_SECONDS, type RetryPolicy } from './decision';

/*****************************************************************************************************************/

export interface FixedRetryBackoffOptions {
  // The delay before every retry, in seconds. It is floored to the whole seconds the platform requires,
  // clamped to the platform ceiling of 24 hours, and never allowed below zero.
  delaySeconds: number;
  // The attempt count at which the message is discarded rather than retried. Absent means retry forever and
  // leave exhaustion to the platform's own max_retries.
  limit?: number;
}

/*****************************************************************************************************************/

// Fixed backoff: the same delay before every retry, however many attempts have failed.
export const withFixedRetryBackoff = (options: FixedRetryBackoffOptions): RetryPolicy => {
  const { delaySeconds, limit } = options;

  const clamped = Math.floor(Math.max(Math.min(delaySeconds, MAXIMUM_DELAY_SECONDS), 0));

  return ({ attempts }) => {
    if (limit !== undefined && attempts >= limit) {
      return { action: 'discard', reason: `exhausted after ${limit} attempts` };
    }

    return { action: 'retry', delaySeconds: clamped };
  };
};

/*****************************************************************************************************************/
