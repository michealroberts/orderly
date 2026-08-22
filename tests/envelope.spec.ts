/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expectTypeOf, it } from 'vitest';

import type { Event } from '../src/index';

/*****************************************************************************************************************/

// Compile-time assertions, as in outcome.spec.ts: the envelope is the closed vocabulary every sink and every
// status inference reads, so the discriminant set and the exact fields of each variant are pinned here. A new
// event kind, a renamed field or a widened type fails the typecheck rather than drifting silently.
describe('envelope', () => {
  it('is a union of exactly the seven event kinds', () => {
    expectTypeOf<Event['type']>().toEqualTypeOf<
      | 'batch.received'
      | 'message.started'
      | 'message.succeeded'
      | 'message.failed'
      | 'message.retried'
      | 'message.discarded'
      | 'message.rejected'
    >();
  });

  it('narrows by discriminant to the fields of each progress variant', () => {
    expectTypeOf<Extract<Event, { type: 'batch.received' }>>().toEqualTypeOf<{
      type: 'batch.received';
      queue: string;
      size: number;
      lagInMilliseconds: number;
      at: number;
    }>();

    expectTypeOf<Extract<Event, { type: 'message.started' }>>().toEqualTypeOf<{
      type: 'message.started';
      id: string;
      attempts: number;
      at: number;
    }>();
  });
});

/*****************************************************************************************************************/

describe('envelope terminal events', () => {
  it('narrows by discriminant to the fields of each terminal variant', () => {
    expectTypeOf<Extract<Event, { type: 'message.succeeded' }>>().toEqualTypeOf<{
      type: 'message.succeeded';
      id: string;
      durationInMilliseconds: number;
      at: number;
    }>();

    expectTypeOf<Extract<Event, { type: 'message.failed' }>>().toEqualTypeOf<{
      type: 'message.failed';
      id: string;
      error: { name: string; message: string; stack?: string };
      at: number;
    }>();

    expectTypeOf<Extract<Event, { type: 'message.retried' }>>().toEqualTypeOf<{
      type: 'message.retried';
      id: string;
      delaySeconds: number;
      at: number;
    }>();

    expectTypeOf<Extract<Event, { type: 'message.discarded' }>>().toEqualTypeOf<{
      type: 'message.discarded';
      id: string;
      reason: string;
      at: number;
    }>();

    expectTypeOf<Extract<Event, { type: 'message.rejected' }>>().toEqualTypeOf<{
      type: 'message.rejected';
      id: string;
      at: number;
    }>();
  });
});

/*****************************************************************************************************************/
