/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { MAXIMUM_DELAY_SECONDS, withFixedRetryBackoff } from '../src/index';

/*****************************************************************************************************************/

const error = new Error('boom');

/*****************************************************************************************************************/

describe('withFixedRetryBackoff', () => {
  it('returns the same delay for every attempt', () => {
    const policy = withFixedRetryBackoff({ delaySeconds: 30 });

    expect(policy({ attempts: 1, error })).toStrictEqual({ action: 'retry', delaySeconds: 30 });
    expect(policy({ attempts: 2, error })).toStrictEqual({ action: 'retry', delaySeconds: 30 });
    expect(policy({ attempts: 50, error })).toStrictEqual({ action: 'retry', delaySeconds: 30 });
  });

  it('floors fractional delays to whole seconds', () => {
    const policy = withFixedRetryBackoff({ delaySeconds: 4.9 });

    expect(policy({ attempts: 1, error })).toStrictEqual({ action: 'retry', delaySeconds: 4 });
  });

  it('clamps the delay at the platform ceiling', () => {
    const policy = withFixedRetryBackoff({ delaySeconds: 1_000_000 });

    expect(policy({ attempts: 1, error })).toStrictEqual({
      action: 'retry',
      delaySeconds: MAXIMUM_DELAY_SECONDS,
    });
  });

  it('never goes negative when the configured delay is negative', () => {
    const policy = withFixedRetryBackoff({ delaySeconds: -30 });

    expect(policy({ attempts: 1, error })).toStrictEqual({ action: 'retry', delaySeconds: 0 });
  });
});

/*****************************************************************************************************************/

describe('withFixedRetryBackoff exhaustion', () => {
  it('discards once the attempt count reaches the limit', () => {
    const policy = withFixedRetryBackoff({ delaySeconds: 30, limit: 5 });

    expect(policy({ attempts: 4, error }).action).toBe('retry');
    expect(policy({ attempts: 5, error })).toStrictEqual({
      action: 'discard',
      reason: 'exhausted after 5 attempts',
    });
  });

  it('retries forever without a limit', () => {
    const policy = withFixedRetryBackoff({ delaySeconds: 30 });

    expect(policy({ attempts: 1_000, error }).action).toBe('retry');
  });
});

/*****************************************************************************************************************/
