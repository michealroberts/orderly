/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expectTypeOf, it } from 'vitest';

import type { Outcome } from '../src/index';

/*****************************************************************************************************************/

// These are compile-time assertions: expectTypeOf does nothing at runtime, so what is being tested here is the
// published contract of the union itself. A variant gaining, losing or widening a field fails the typecheck, and
// that is the point: the four outcomes are the vocabulary everything downstream speaks, so their exact shape is
// pinned as a test rather than left to drift.
describe('outcome', () => {
  it('is a union of exactly the four terminal outcomes', () => {
    expectTypeOf<Outcome['type']>().toEqualTypeOf<
      'succeeded' | 'retried' | 'discarded' | 'rejected'
    >();
  });

  it('narrows by discriminant to the fields of each variant', () => {
    expectTypeOf<Extract<Outcome, { type: 'succeeded' }>>().toEqualTypeOf<{ type: 'succeeded' }>();

    expectTypeOf<Extract<Outcome, { type: 'retried' }>>().toEqualTypeOf<{
      type: 'retried';
      delaySeconds: number;
    }>();

    expectTypeOf<Extract<Outcome, { type: 'discarded' }>>().toEqualTypeOf<{
      type: 'discarded';
      reason: string;
    }>();

    expectTypeOf<Extract<Outcome, { type: 'rejected' }>>().toEqualTypeOf<{
      type: 'rejected';
      error: unknown;
    }>();
  });
});

/*****************************************************************************************************************/
