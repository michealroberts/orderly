/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { withImmediateRetry } from '../src/index';

/*****************************************************************************************************************/

const error = new Error('boom');

/*****************************************************************************************************************/

describe('withImmediateRetry', () => {
  it('retries with no delay on every attempt', () => {
    const policy = withImmediateRetry();

    expect(policy({ attempts: 1, error })).toStrictEqual({ action: 'retry', delaySeconds: 0 });
    expect(policy({ attempts: 1_000, error })).toStrictEqual({ action: 'retry', delaySeconds: 0 });
  });

  it('discards once the attempt count reaches the limit', () => {
    const policy = withImmediateRetry({ limit: 3 });

    expect(policy({ attempts: 2, error }).action).toBe('retry');
    expect(policy({ attempts: 3, error })).toStrictEqual({
      action: 'discard',
      reason: 'exhausted after 3 attempts',
    });
  });

  it('retries forever without a limit', () => {
    const policy = withImmediateRetry({});

    expect(policy({ attempts: 1_000, error }).action).toBe('retry');
  });
});

/*****************************************************************************************************************/
