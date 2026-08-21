/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expectTypeOf, it } from 'vitest';

import type { MessageContext } from '../src/index';

/*****************************************************************************************************************/

describe('message context', () => {
  it('exposes exactly the delivery facts, every one read only', () => {
    expectTypeOf<MessageContext>().toEqualTypeOf<{
      readonly id: string;
      readonly attempts: number;
      readonly timestamp: Date;
      readonly queue: string;
      readonly signal: AbortSignal;
    }>();
  });

  // The design's load-bearing absence: settling is the consumer's job, exactly once, never the handler's.
  it('exposes no transport verbs', () => {
    expectTypeOf<MessageContext>().not.toHaveProperty('ack');

    expectTypeOf<MessageContext>().not.toHaveProperty('retry');
  });
});

/*****************************************************************************************************************/
