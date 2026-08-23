/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, expectTypeOf, it } from 'vitest';

import { durationInMilliseconds, type Duration } from '../src/index';

/*****************************************************************************************************************/

describe('duration', () => {
  it('carries exactly the five optional parts', () => {
    expectTypeOf<Duration>().toEqualTypeOf<{
      days?: number;
      hours?: number;
      minutes?: number;
      seconds?: number;
      milliseconds?: number;
    }>();

    expectTypeOf<keyof Duration>().toEqualTypeOf<
      'days' | 'hours' | 'minutes' | 'seconds' | 'milliseconds'
    >();
  });

  it.each([
    [{ days: 1 }, 86_400_000],
    [{ hours: 1 }, 3_600_000],
    [{ minutes: 1 }, 60_000],
    [{ seconds: 1 }, 1_000],
    [{ milliseconds: 250 }, 250],
  ])('normalizes %o to %d milliseconds', (duration, expected) => {
    expect(durationInMilliseconds(duration)).toBe(expected);
  });

  it('sums parts additively', () => {
    expect(
      durationInMilliseconds({ days: 1, hours: 2, minutes: 3, seconds: 4, milliseconds: 5 }),
    ).toBe(86_400_000 + 7_200_000 + 180_000 + 4_000 + 5);
  });

  it('accepts fractional parts: half a day is twelve hours', () => {
    expect(durationInMilliseconds({ days: 0.5 })).toBe(43_200_000);

    expect(durationInMilliseconds({ seconds: 1.5 })).toBe(1_500);
  });

  it('normalizes an empty span to zero', () => {
    expect(durationInMilliseconds({})).toBe(0);
  });
});

/*****************************************************************************************************************/

describe('duration defensiveness', () => {
  it('floors the total to whole milliseconds', () => {
    expect(durationInMilliseconds({ milliseconds: 2.9 })).toBe(2);
  });

  it('never goes negative', () => {
    expect(durationInMilliseconds({ minutes: -5 })).toBe(0);

    expect(durationInMilliseconds({ hours: 1, minutes: -120 })).toBe(0);
  });

  it('normalizes a finite span that overflows during conversion to zero', () => {
    expect(durationInMilliseconds({ days: Number.MAX_VALUE })).toBe(0);
  });

  it('counts a part that is not finite as zero rather than poisoning the span', () => {
    expect(durationInMilliseconds({ days: Number.NaN, minutes: 1 })).toBe(60_000);

    expect(durationInMilliseconds({ hours: Number.POSITIVE_INFINITY, seconds: 1 })).toBe(1_000);
  });
});

/*****************************************************************************************************************/
