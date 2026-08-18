/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { env } from 'cloudflare:workers';

import { describe, expect, expectTypeOf, it } from 'vitest';

import { MAXIMUM_DELAY_SECONDS, type RetryDecision, type RetryPolicy } from '../src/index';

/*****************************************************************************************************************/

describe('retry decision', () => {
  it('is a union of exactly the two actions', () => {
    expectTypeOf<RetryDecision['action']>().toEqualTypeOf<'retry' | 'discard'>();
  });

  it('narrows by action to the fields of each variant', () => {
    expectTypeOf<Extract<RetryDecision, { action: 'retry' }>>().toEqualTypeOf<{
      action: 'retry';
      delaySeconds: number;
    }>();

    expectTypeOf<Extract<RetryDecision, { action: 'discard' }>>().toEqualTypeOf<{
      action: 'discard';
      reason: string;
    }>();
  });

  it('is decided from the attempt count and the thrown error', () => {
    expectTypeOf<RetryPolicy>().parameters.toEqualTypeOf<[{ attempts: number; error: unknown }]>();

    expectTypeOf<RetryPolicy>().returns.toEqualTypeOf<RetryDecision>();
  });
});

/*****************************************************************************************************************/

// Pinned against the runtime rather than the documentation: the queue accepts a delay at the ceiling and
// refuses one a second past it.
describe('maximum delay seconds', () => {
  it('is accepted by the platform at the ceiling', async () => {
    await expect(
      env.QUEUE.send('probe', { delaySeconds: MAXIMUM_DELAY_SECONDS }),
    ).resolves.toBeDefined();
  });

  it('is refused by the platform one second past the ceiling', async () => {
    await expect(
      env.QUEUE.send('probe', { delaySeconds: MAXIMUM_DELAY_SECONDS + 1 }),
    ).rejects.toBeInstanceOf(Error);
  });
});

/*****************************************************************************************************************/
