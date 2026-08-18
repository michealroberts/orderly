/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/retry
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import type { RetryPolicy } from './decision';

/*****************************************************************************************************************/

export interface ImmediateRetryOptions {
  // The attempt count at which the message is discarded rather than retried. Absent means retry forever and
  // leave exhaustion to the platform's own max_retries.
  limit?: number;
}

/*****************************************************************************************************************/

// Immediate retry: redelivery as soon as the platform allows, with no backoff at all.
export const withImmediateRetry = (options: ImmediateRetryOptions = {}): RetryPolicy => {
  const { limit } = options;

  return ({ attempts }) => {
    if (limit !== undefined && attempts >= limit) {
      return { action: 'discard', reason: `exhausted after ${limit} attempts` };
    }

    return { action: 'retry', delaySeconds: 0 };
  };
};

/*****************************************************************************************************************/
