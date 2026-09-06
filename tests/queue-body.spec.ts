/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expectTypeOf, it } from 'vitest';

import { defineQueue, type QueueBody, type StandardSchema } from '../src/index';

/*****************************************************************************************************************/

type Plan = { id: string; exposures: number };

/*****************************************************************************************************************/

// A conforming schema whose output is a Plan, standing in for zod and friends.
const plan: StandardSchema<unknown, Plan> = {
  '~standard': {
    version: 1,
    vendor: 'orderly-tests',
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    validate: value => ({ value: value as Plan }),
  },
};

/*****************************************************************************************************************/

describe('QueueBody', () => {
  it('reads the body from a contract defined with a schema, with no type argument given', () => {
    const plans = defineQueue({ name: 'plans', schema: plan });

    expectTypeOf<QueueBody<typeof plans>>().toEqualTypeOf<Plan>();
  });

  it('reads the body from a contract defined with a parse function', () => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const plans = defineQueue({ name: 'plans', schema: (value: unknown) => value as Plan });

    expectTypeOf<QueueBody<typeof plans>>().toEqualTypeOf<Plan>();
  });

  it('reads the body from a contract given its type argument outright', () => {
    const plans = defineQueue<Plan>({ name: 'plans' });

    expectTypeOf<QueueBody<typeof plans>>().toEqualTypeOf<Plan>();
  });

  it('is unknown for a contract that names no body at all', () => {
    const anything = defineQueue({ name: 'anything' });

    expectTypeOf<QueueBody<typeof anything>>().toEqualTypeOf<unknown>();
  });

  it('agrees with what the consumer hands its handler', () => {
    const plans = defineQueue({ name: 'plans', schema: plan });

    plans.consumer({
      retry: () => ({ action: 'discard', reason: 'unused' }),
      handle: message => {
        expectTypeOf(message).toEqualTypeOf<QueueBody<typeof plans>>();
      },
    });
  });
});

/*****************************************************************************************************************/

describe('QueueBody refusal of what is not one contract', () => {
  it('is never for anything that is not a contract', () => {
    expectTypeOf<QueueBody<{ name: string }>>().toEqualTypeOf<never>();

    expectTypeOf<QueueBody<Plan>>().toEqualTypeOf<never>();
  });

  it('is never for a contract joined with something that is not one, rather than the body', () => {
    // A conditional that distributed over the union would answer Plan here and let an optional contract
    // through unnoticed; the tuple in the definition keeps it from doing so.
    const plans = defineQueue({ name: 'plans', schema: plan });

    expectTypeOf<QueueBody<typeof plans | undefined>>().toEqualTypeOf<never>();

    expectTypeOf<QueueBody<typeof plans | null>>().toEqualTypeOf<never>();
  });

  it('is never for a union of contracts, one contract being one body', () => {
    const plans = defineQueue({ name: 'plans', schema: plan });

    const names = defineQueue<string>({ name: 'names' });

    expectTypeOf<QueueBody<typeof plans | typeof names>>().toEqualTypeOf<never>();
  });
});

/*****************************************************************************************************************/
