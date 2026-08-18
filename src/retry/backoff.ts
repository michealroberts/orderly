/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/retry
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { MAXIMUM_DELAY_SECONDS, type RetryPolicy } from './decision';

/*****************************************************************************************************************/

export interface ExponentialRetryBackoffOptions {
  // The delay before the first retry, in seconds.
  initialDelaySeconds: number;
  // The multiplier applied to the delay on each further attempt: a factor of 2 doubles it every time.
  factor: number;
  // The delay never grows past this many seconds, however many attempts have failed. The platform ceiling of
  // 24 hours applies on top of it either way.
  maximumDelaySeconds: number;
  // Full jitter draws the delay uniformly from [0, the computed delay), which prevents a failing batch from
  // retrying in lockstep. The default is 'none': the computed delay is used as is.
  jitter?: 'full' | 'none';
  // The attempt count at which the message is discarded rather than retried. Absent means retry forever and
  // leave exhaustion to the platform's own max_retries.
  limit?: number;
  // The source of randomness for jitter. Injectable so jittered delays are deterministic under test.
  random?: () => number;
}

/*****************************************************************************************************************/

// Exponential backoff: initialDelaySeconds growing by factor per attempt, capped at maximumDelaySeconds and
// the platform ceiling, floored to the whole seconds the platform requires.
export const withExponentialRetryBackoff = (
  options: ExponentialRetryBackoffOptions,
): RetryPolicy => {
  const {
    initialDelaySeconds,
    factor,
    maximumDelaySeconds,
    jitter = 'none',
    limit,
    random = Math.random,
  } = options;

  return ({ attempts }) => {
    if (limit !== undefined && attempts >= limit) {
      return { action: 'discard', reason: `exhausted after ${limit} attempts` };
    }

    const base = Math.max(
      Math.min(
        initialDelaySeconds * factor ** (attempts - 1),
        maximumDelaySeconds,
        MAXIMUM_DELAY_SECONDS,
      ),
      0,
    );

    if (jitter === 'none') {
      return { action: 'retry', delaySeconds: Math.floor(base) };
    }

    // The draw is clamped into [0, 1) so a misbehaving random source cannot push the delay negative, to the
    // base, or past the platform ceiling.
    const draw = Math.min(Math.max(random(), 0), 1 - Number.EPSILON);

    return { action: 'retry', delaySeconds: Math.floor(draw * base) };
  };
};

/*****************************************************************************************************************/
