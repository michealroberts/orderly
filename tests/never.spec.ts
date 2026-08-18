/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { withoutRetry } from '../src/index';

/*****************************************************************************************************************/

const error = new Error('boom');

/*****************************************************************************************************************/

describe('withoutRetry', () => {
  it('discards on the first attempt', () => {
    const policy = withoutRetry();

    expect(policy({ attempts: 1, error })).toStrictEqual({
      action: 'discard',
      reason: 'retries are disabled',
    });
  });

  it('discards on every attempt, whatever the count', () => {
    const policy = withoutRetry();

    expect(policy({ attempts: 1_000, error })).toStrictEqual({
      action: 'discard',
      reason: 'retries are disabled',
    });
  });
});

/*****************************************************************************************************************/
