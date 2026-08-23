/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, expectTypeOf, it } from 'vitest';

import type { Schedule } from '../src/index';

/*****************************************************************************************************************/

// A hand-rolled conforming schedule over a fixed list of instants, standing in for every constructor to come:
// if this satisfies the contract structurally, cron, rrule and the builders do too.
const listed = (...instants: number[]): Schedule => {
  return {
    next: after => {
      const found = instants.find(instant => instant > after.getTime());

      return found === undefined ? null : new Date(found);
    },
  };
};

/*****************************************************************************************************************/

describe('schedule contract', () => {
  it('is one method from an instant to the next occurrence or null', () => {
    expectTypeOf<Schedule['next']>().toEqualTypeOf<(after: Date) => Date | null>();
  });

  it('walks occurrences strictly after the instant given', () => {
    const schedule = listed(1_000, 2_000);

    expect(schedule.next(new Date(0))).toStrictEqual(new Date(1_000));

    // Strictly after: asking from an occurrence never returns that occurrence again.
    expect(schedule.next(new Date(1_000))).toStrictEqual(new Date(2_000));
  });

  it('exhausts with null, after which nothing should re-arm', () => {
    const schedule = listed(1_000);

    expect(schedule.next(new Date(1_000))).toBeNull();

    expect(schedule.next(new Date(999_999))).toBeNull();
  });

  it('is pure: the same instant in always yields the same answer out', () => {
    const schedule = listed(1_000, 2_000);

    expect(schedule.next(new Date(500))).toStrictEqual(schedule.next(new Date(500)));
  });
});

/*****************************************************************************************************************/
