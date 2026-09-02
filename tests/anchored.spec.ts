/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, expectTypeOf, it } from 'vitest';

import { at, type AnchoredInterval, every, preview } from '../src/index';

/*****************************************************************************************************************/

// An anchor that sits nowhere near an epoch boundary, so a tick aligned to the epoch would be told apart.
const ANCHOR = new Date('2026-01-15T12:03:21.123Z');

/*****************************************************************************************************************/

const MAXIMUM_INSTANT = 8_640_000_000_000_000;

/*****************************************************************************************************************/

describe('at().every() in minutes', () => {
  it('fires the anchor itself first, from anywhere before it', () => {
    const schedule = at(ANCHOR).every(5).minutes();

    expect(schedule.next(new Date(0))).toStrictEqual(ANCHOR);

    expect(schedule.next(new Date(ANCHOR.getTime() - 1))).toStrictEqual(ANCHOR);
  });

  it('counts the cadence from the anchor rather than the epoch', () => {
    const after = new Date('2026-01-15T12:05:00Z');

    expect(at(ANCHOR).every(5).minutes().next(after)).toStrictEqual(
      new Date('2026-01-15T12:08:21.123Z'),
    );

    expect(every(5).minutes().next(after)).toStrictEqual(new Date('2026-01-15T12:10:00Z'));
  });

  it('advances strictly past an instant already on a tick', () => {
    expect(at(ANCHOR).every(5).minutes().next(ANCHOR)).toStrictEqual(
      new Date('2026-01-15T12:08:21.123Z'),
    );

    expect(at(ANCHOR).every(5).minutes().next(new Date('2026-01-15T12:08:21.123Z'))).toStrictEqual(
      new Date('2026-01-15T12:13:21.123Z'),
    );
  });

  it('computes the same series from independent constructions', () => {
    const after = new Date('2026-06-01T09:17:43Z');

    expect(at(ANCHOR).every(15).minutes().next(after)).toStrictEqual(
      at(ANCHOR).every(15).minutes().next(after),
    );
  });
});

/*****************************************************************************************************************/

describe('at().every() in hours', () => {
  it("keeps the anchor's minute, second and millisecond on every tick", () => {
    expect(at(ANCHOR).every(6).hours().next(ANCHOR)).toStrictEqual(
      new Date('2026-01-15T18:03:21.123Z'),
    );
  });

  it("lands its ticks on the anchor's boundaries, not the epoch's", () => {
    expect(at(ANCHOR).every(6).hours().next(new Date('2026-01-16T00:00:00Z'))).toStrictEqual(
      new Date('2026-01-16T00:03:21.123Z'),
    );
  });
});

/*****************************************************************************************************************/

describe('at().every() with fractional counts', () => {
  it('reads half a minute as a thirty second cadence', () => {
    expect(at(ANCHOR).every(0.5).minutes().next(ANCHOR)).toStrictEqual(
      new Date('2026-01-15T12:03:51.123Z'),
    );
  });

  it('reads one and a half hours as ninety minutes', () => {
    expect(at(ANCHOR).every(1.5).hours().next(ANCHOR)).toStrictEqual(
      at(ANCHOR).every(90).minutes().next(ANCHOR),
    );
  });
});

/*****************************************************************************************************************/

describe('at().every() under preview', () => {
  it('walks the anchor and then successive ticks, each strictly after the one before', () => {
    expect(
      preview(at(ANCHOR).every(15).minutes(), {
        after: new Date('2026-01-15T00:00:00Z'),
        take: 3,
      }),
    ).toStrictEqual([
      ANCHOR,
      new Date('2026-01-15T12:18:21.123Z'),
      new Date('2026-01-15T12:33:21.123Z'),
    ]);
  });
});

/*****************************************************************************************************************/

describe('at().every() at the end of time', () => {
  it('counts exactly across the whole range a Date can hold', () => {
    // Every minute from the earliest instant a Date can hold: the last tick is the end of time itself, because
    // the range is a whole number of minutes wide. The distance between the two ends is past what a number
    // counts exactly, and arithmetic in numbers alone rounds it up and answers with exhaustion instead.
    const schedule = at(new Date(-MAXIMUM_INSTANT)).every(1).minutes();

    expect(schedule.next(new Date(MAXIMUM_INSTANT - 1))).toStrictEqual(new Date(MAXIMUM_INSTANT));
  });

  it('still fires an anchor at the last instant a Date can hold', () => {
    expect(at(new Date(MAXIMUM_INSTANT)).every(5).minutes().next(new Date(0))).toStrictEqual(
      new Date(MAXIMUM_INSTANT),
    );
  });

  it('exhausts once the next tick would leave the range a Date can hold', () => {
    expect(
      at(new Date(MAXIMUM_INSTANT)).every(5).minutes().next(new Date(MAXIMUM_INSTANT)),
    ).toBeNull();
  });
});

/*****************************************************************************************************************/

describe('at().every() defensiveness', () => {
  it.each([[0], [-5], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    'refuses a count of %p loudly',
    count => {
      // The verb is taken off the anchor first, because a linter reads .every(count) as an array callback.
      const { every: anchoredEvery } = at(ANCHOR);

      expect(() => anchoredEvery(count)).toThrow(RangeError);
    },
  );

  it('refuses a period that floors to nothing', () => {
    expect(() => at(ANCHOR).every(0.000_000_1).minutes()).toThrow(RangeError);
  });

  it('refuses a period past what a number can count exactly', () => {
    // Two to the fifty third, written out: a linter reads an expression inside .every() as an array callback.
    expect(() => at(ANCHOR).every(9_007_199_254_740_992).minutes()).toThrow(RangeError);
  });

  it('refuses to advance from an invalid Date', () => {
    expect(() => at(ANCHOR).every(5).minutes().next(new Date(Number.NaN))).toThrow(RangeError);
  });

  it('is an interval, not a schedule: the sentence must be finished', () => {
    expectTypeOf<AnchoredInterval>().not.toHaveProperty('next');

    expectTypeOf(at(ANCHOR).every(5).minutes().next).toBeFunction();
  });

  it('carries the clock units only, the calendar ones being a recurrence rule anchored there', () => {
    expectTypeOf<AnchoredInterval>().not.toHaveProperty('days');

    expectTypeOf<AnchoredInterval>().not.toHaveProperty('weeks');

    expectTypeOf<AnchoredInterval>().not.toHaveProperty('months');
  });
});

/*****************************************************************************************************************/

describe('at().every() immutability', () => {
  it('is unaffected by mutation of the Date it was given', () => {
    const date = new Date(ANCHOR);

    const schedule = at(date).every(5).minutes();

    date.setTime(0);

    expect(schedule.next(new Date(0))).toStrictEqual(ANCHOR);
  });

  it('is unaffected by mutation of a Date it returned', () => {
    const schedule = at(ANCHOR).every(5).minutes();

    const first = schedule.next(new Date(0));

    first?.setTime(0);

    expect(schedule.next(new Date(0))).toStrictEqual(ANCHOR);
  });
});

/*****************************************************************************************************************/
