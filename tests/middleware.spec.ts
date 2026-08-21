/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expectTypeOf, it } from 'vitest';

import type { MessageContext, Middleware, Outcome } from '../src/index';

/*****************************************************************************************************************/

describe('middleware', () => {
  it('is one layer around one message', () => {
    expectTypeOf<Middleware<string>>().parameters.toEqualTypeOf<
      [string, MessageContext, () => Promise<Outcome>]
    >();

    expectTypeOf<Middleware<string>>().returns.toEqualTypeOf<Outcome | Promise<Outcome>>();
  });

  it('sees the parsed body as unknown unless the consumer narrows it', () => {
    expectTypeOf<Middleware>().parameter(0).toEqualTypeOf<unknown>();
  });
});

/*****************************************************************************************************************/
