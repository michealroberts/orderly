/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, expectTypeOf, it } from 'vitest';

import type { StandardSchema, StandardSchemaResult } from '../src/index';

/*****************************************************************************************************************/

// A hand-rolled conforming schema, standing in for zod, valibot or arktype: if this satisfies the interface
// structurally, any conforming library does.
const decimal: StandardSchema<unknown, number> = {
  '~standard': {
    version: 1,
    vendor: 'orderly-tests',
    validate: value => {
      const parsed = Number(value);

      return Number.isFinite(parsed)
        ? { value: parsed }
        : { issues: [{ message: 'not a finite number' }] };
    },
  },
};

/*****************************************************************************************************************/

describe('standard schema', () => {
  it('accepts a structurally conforming schema and parses through it', async () => {
    const parsed = await decimal['~standard'].validate('42.5');

    expect(parsed).toStrictEqual({ value: 42.5 });
  });

  it('reports issues instead of throwing', async () => {
    const failed = await decimal['~standard'].validate('not a number');

    expect(failed).toStrictEqual({ issues: [{ message: 'not a finite number' }] });
  });

  it('narrows a result by the presence of issues', () => {
    expectTypeOf<Extract<StandardSchemaResult<number>, { issues?: undefined }>>().toEqualTypeOf<{
      readonly value: number;
      readonly issues?: undefined;
    }>();
  });

  it('carries the output type through the interface', () => {
    expectTypeOf(decimal['~standard'].validate)
      .returns.resolves.extract<{ value: number }>()
      .toEqualTypeOf<{ readonly value: number; readonly issues?: undefined }>();
  });
});

/*****************************************************************************************************************/
