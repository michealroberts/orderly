/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { withExponentialRetryBackoff, MAXIMUM_DELAY_SECONDS } from '../src/index';

/*****************************************************************************************************************/

const error = new Error('boom');

/*****************************************************************************************************************/

describe('withExponentialRetryBackoff backoff', () => {
  it('grows the delay by the factor per attempt', () => {
    const policy = withExponentialRetryBackoff({
      initialDelaySeconds: 1,
      factor: 2,
      maximumDelaySeconds: 300,
    });

    expect(policy({ attempts: 1, error })).toStrictEqual({ action: 'retry', delaySeconds: 1 });
    expect(policy({ attempts: 2, error })).toStrictEqual({ action: 'retry', delaySeconds: 2 });
    expect(policy({ attempts: 3, error })).toStrictEqual({ action: 'retry', delaySeconds: 4 });
    expect(policy({ attempts: 4, error })).toStrictEqual({ action: 'retry', delaySeconds: 8 });
  });

  it('caps the delay at maximumDelaySeconds', () => {
    const policy = withExponentialRetryBackoff({
      initialDelaySeconds: 1,
      factor: 2,
      maximumDelaySeconds: 5,
    });

    expect(policy({ attempts: 4, error })).toStrictEqual({ action: 'retry', delaySeconds: 5 });
  });

  it('caps the delay at the platform ceiling whatever maximumDelaySeconds says', () => {
    const policy = withExponentialRetryBackoff({
      initialDelaySeconds: 1,
      factor: 10,
      maximumDelaySeconds: 1_000_000,
    });

    expect(policy({ attempts: 10, error })).toStrictEqual({
      action: 'retry',
      delaySeconds: MAXIMUM_DELAY_SECONDS,
    });
  });

  it('floors fractional delays to whole seconds', () => {
    const policy = withExponentialRetryBackoff({
      initialDelaySeconds: 1.5,
      factor: 1,
      maximumDelaySeconds: 300,
    });

    expect(policy({ attempts: 1, error })).toStrictEqual({ action: 'retry', delaySeconds: 1 });
  });
});

/*****************************************************************************************************************/

describe('withExponentialRetryBackoff jitter and exhaustion', () => {
  it('draws a full jitter delay from [0, base) with the injected random', () => {
    const policy = withExponentialRetryBackoff({
      initialDelaySeconds: 8,
      factor: 1,
      maximumDelaySeconds: 300,
      jitter: 'full',
      random: () => 0.5,
    });

    expect(policy({ attempts: 1, error })).toStrictEqual({ action: 'retry', delaySeconds: 4 });
  });

  it('can draw a zero delay under full jitter', () => {
    const policy = withExponentialRetryBackoff({
      initialDelaySeconds: 8,
      factor: 1,
      maximumDelaySeconds: 300,
      jitter: 'full',
      random: () => 0,
    });

    expect(policy({ attempts: 1, error })).toStrictEqual({ action: 'retry', delaySeconds: 0 });
  });

  it('discards once the attempt count reaches the limit', () => {
    const policy = withExponentialRetryBackoff({
      initialDelaySeconds: 1,
      factor: 2,
      maximumDelaySeconds: 300,
      limit: 3,
    });

    expect(policy({ attempts: 2, error }).action).toBe('retry');
    expect(policy({ attempts: 3, error })).toStrictEqual({
      action: 'discard',
      reason: 'exhausted after 3 attempts',
    });
  });

  it('retries forever without a limit', () => {
    const policy = withExponentialRetryBackoff({
      initialDelaySeconds: 1,
      factor: 2,
      maximumDelaySeconds: 300,
    });

    expect(policy({ attempts: 1_000, error }).action).toBe('retry');
  });
});

/*****************************************************************************************************************/

const jittered = (random: () => number) =>
  withExponentialRetryBackoff({
    initialDelaySeconds: 8,
    factor: 1,
    maximumDelaySeconds: 300,
    jitter: 'full',
    random,
  });

/*****************************************************************************************************************/

// A misbehaving random source must never break the documented [0, base) interval, whatever it returns.
describe('withExponentialRetryBackoff jitter clamping', () => {
  it('stays exclusive of the base when random returns exactly 1', () => {
    expect(jittered(() => 1)({ attempts: 1, error })).toStrictEqual({
      action: 'retry',
      delaySeconds: 7,
    });
  });

  it('stays exclusive of the base when random returns more than 1', () => {
    expect(jittered(() => 2)({ attempts: 1, error })).toStrictEqual({
      action: 'retry',
      delaySeconds: 7,
    });
  });

  it('never goes negative when random returns less than 0', () => {
    expect(jittered(() => -1)({ attempts: 1, error })).toStrictEqual({
      action: 'retry',
      delaySeconds: 0,
    });
  });

  it('never goes negative when the configured delays are negative', () => {
    const policy = withExponentialRetryBackoff({
      initialDelaySeconds: -5,
      factor: 2,
      maximumDelaySeconds: 300,
    });

    expect(policy({ attempts: 1, error })).toStrictEqual({ action: 'retry', delaySeconds: 0 });
  });
});

/*****************************************************************************************************************/
