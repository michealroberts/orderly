/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { every, preview } from '../src/index';

import { calendarDays } from '../src/schedules/calendar';

import { monthly, weekly } from '../src/schedules/candidates';

/*****************************************************************************************************************/

describe('every in days', () => {
  it('lands on the next midnight in UTC by default', () => {
    expect(every(1).days().next(new Date('2026-01-15T05:00:00Z'))).toStrictEqual(
      new Date('2026-01-16T00:00:00Z'),
    );
  });

  it('advances strictly past an occurrence it lands on', () => {
    expect(every(1).days().next(new Date('2026-01-16T00:00:00Z'))).toStrictEqual(
      new Date('2026-01-17T00:00:00Z'),
    );
  });

  it('stays on the same day when its wall time is still ahead', () => {
    expect(
      every(1)
        .days({ at: { hour: 9, minute: 0 } })
        .next(new Date('2026-01-15T03:00:00Z')),
    ).toStrictEqual(new Date('2026-01-15T09:00:00Z'));
  });

  it('lands on the wall time of the timezone given', () => {
    expect(
      every(1)
        .days({ at: { hour: 9, minute: 0 }, timezone: 'Asia/Tokyo' })
        .next(new Date('2026-01-15T12:00:00Z')),
    ).toStrictEqual(new Date('2026-01-16T00:00:00Z'));
  });

  it('aligns alternate days to the epoch, not to the schedule', () => {
    // 2026-01-15 is day 20468 since the epoch, so alternate days land on the fifteenth, never the sixteenth.
    expect(every(2).days().next(new Date('2026-01-14T00:00:00Z'))).toStrictEqual(
      new Date('2026-01-15T00:00:00Z'),
    );

    expect(every(2).days().next(new Date('2026-01-15T00:00:00Z'))).toStrictEqual(
      new Date('2026-01-17T00:00:00Z'),
    );
  });
});

/*****************************************************************************************************************/

describe('every in days across daylight saving', () => {
  it('shifts a wall time a spring forward gap swallows by the span of the gap', () => {
    // London jumps 01:00 to 02:00 on 2026-03-29, so 01:30 fires at 02:30 BST, which is 01:30Z.
    expect(
      every(1)
        .days({ at: { hour: 1, minute: 30 }, timezone: 'Europe/London' })
        .next(new Date('2026-03-28T12:00:00Z')),
    ).toStrictEqual(new Date('2026-03-29T01:30:00Z'));
  });

  it('fires a wall time a fall back repeats at its first occurrence', () => {
    // New York falls 02:00 back to 01:00 on 2026-11-01, so 01:30 happens twice; the earlier is EDT.
    expect(
      every(1)
        .days({ at: { hour: 1, minute: 30 }, timezone: 'America/New_York' })
        .next(new Date('2026-10-31T12:00:00Z')),
    ).toStrictEqual(new Date('2026-11-01T05:30:00Z'));
  });

  it('keeps the wall time as the clocks change, so the spans between occurrences flex', () => {
    // Nine in the morning in London holds at 09:00Z under GMT and 08:00Z once BST begins on 2026-03-29.
    expect(
      preview(every(1).days({ at: { hour: 9, minute: 0 }, timezone: 'Europe/London' }), {
        after: new Date('2026-03-27T12:00:00Z'),
        take: 3,
      }),
    ).toStrictEqual([
      new Date('2026-03-28T09:00:00Z'),
      new Date('2026-03-29T08:00:00Z'),
      new Date('2026-03-30T08:00:00Z'),
    ]);
  });
});

/*****************************************************************************************************************/

describe('every in weeks', () => {
  it('lands on Monday at midnight in UTC by default', () => {
    expect(every(1).weeks().next(new Date('2026-01-15T00:00:00Z'))).toStrictEqual(
      new Date('2026-01-19T00:00:00Z'),
    );
  });

  it('lands on the weekday requested', () => {
    expect(every(1).weeks({ on: 'friday' }).next(new Date('2026-01-15T00:00:00Z'))).toStrictEqual(
      new Date('2026-01-16T00:00:00Z'),
    );
  });

  it('waits for the following week when the weekday has already passed', () => {
    expect(
      every(1).weeks({ on: 'wednesday' }).next(new Date('2026-01-15T00:00:00Z')),
    ).toStrictEqual(new Date('2026-01-21T00:00:00Z'));
  });

  it('aligns alternate weeks to the week of the epoch', () => {
    // The week of 2026-01-12 is week 2924 since the epoch's, so the week of the nineteenth is skipped.
    expect(every(2).weeks().next(new Date('2026-01-15T00:00:00Z'))).toStrictEqual(
      new Date('2026-01-26T00:00:00Z'),
    );
  });

  it('lands weekday wall times in the timezone given', () => {
    expect(
      every(1)
        .weeks({ on: 'monday', at: { hour: 9, minute: 0 }, timezone: 'Asia/Tokyo' })
        .next(new Date('2026-01-15T00:00:00Z')),
    ).toStrictEqual(new Date('2026-01-19T00:00:00Z'));
  });
});

/*****************************************************************************************************************/

describe('every in months', () => {
  it('lands on the first of the month at midnight in UTC by default', () => {
    expect(every(1).months().next(new Date('2026-01-15T00:00:00Z'))).toStrictEqual(
      new Date('2026-02-01T00:00:00Z'),
    );
  });

  it('advances strictly past an occurrence it lands on', () => {
    expect(every(1).months({ on: 15 }).next(new Date('2026-01-15T00:00:00Z'))).toStrictEqual(
      new Date('2026-02-15T00:00:00Z'),
    );
  });

  it('skips months without the day requested', () => {
    // February has no thirty first, so the thirty first of January is followed by the thirty first of March.
    expect(every(1).months({ on: 31 }).next(new Date('2026-01-31T12:00:00Z'))).toStrictEqual(
      new Date('2026-03-31T00:00:00Z'),
    );
  });

  it('finds the twenty ninth of February only in leap years', () => {
    expect(every(1).months({ on: 29 }).next(new Date('2026-02-01T00:00:00Z'))).toStrictEqual(
      new Date('2026-03-29T00:00:00Z'),
    );

    expect(every(1).months({ on: 29 }).next(new Date('2028-02-01T00:00:00Z'))).toStrictEqual(
      new Date('2028-02-29T00:00:00Z'),
    );
  });

  it('aligns month cadences to January 1970', () => {
    // January 2026 is month 672 since the epoch, so a quarterly cadence lands on January, April and July.
    expect(every(3).months({ on: 15 }).next(new Date('2026-01-20T00:00:00Z'))).toStrictEqual(
      new Date('2026-04-15T00:00:00Z'),
    );
  });

  it('lands month wall times in the timezone given', () => {
    expect(
      every(1)
        .months({ on: 1, at: { hour: 9, minute: 0 }, timezone: 'America/New_York' })
        .next(new Date('2026-01-15T00:00:00Z')),
    ).toStrictEqual(new Date('2026-02-01T14:00:00Z'));
  });
});

/*****************************************************************************************************************/

describe('calendar horizon', () => {
  it('still returns the second to last calendar day a Date can hold', () => {
    expect(
      every(1)
        .days()
        .next(new Date(8_640_000_000_000_000 - 2 * 86_400_000)),
    ).toStrictEqual(new Date(8_640_000_000_000_000 - 86_400_000));
  });

  it('exhausts at the final calendar day, whose wall time cannot be resolved', () => {
    expect(
      every(1)
        .days()
        .next(new Date(8_640_000_000_000_000 - 1)),
    ).toBeNull();
  });

  it('surrenders later wall times sooner: the horizon is met by the reading, time of day included', () => {
    const nineInTheMorning = every(1).days({ at: { hour: 9, minute: 0 } });

    const lastResolvable = new Date(8_640_000_000_000_000 - 2 * 86_400_000 + 9 * 3_600_000);

    expect(nineInTheMorning.next(new Date(8_640_000_000_000_000 - 2 * 86_400_000))).toStrictEqual(
      lastResolvable,
    );

    expect(nineInTheMorning.next(lastResolvable)).toBeNull();
  });
});

/*****************************************************************************************************************/

describe('calendar defensiveness', () => {
  it('refuses fractional counts for calendar units', () => {
    expect(() => every(1.5).days()).toThrow(RangeError);

    expect(() => every(2.5).weeks()).toThrow(RangeError);

    expect(() => every(0.5).months()).toThrow(RangeError);
  });

  it.each([
    [{ hour: 24, minute: 0 }],
    [{ hour: -1, minute: 0 }],
    [{ hour: 9.5, minute: 0 }],
    [{ hour: 9, minute: 60 }],
    [{ hour: 9, minute: -1 }],
  ])('refuses the wall time %o loudly', at => {
    expect(() => every(1).days({ at })).toThrow(RangeError);
  });

  it('refuses an unknown timezone at construction, not at the first next()', () => {
    expect(() => every(1).days({ timezone: 'Neverland/Second_Star' })).toThrow(RangeError);
  });

  it.each([[0], [32], [15.5]])('refuses a month day of %p loudly', on => {
    expect(() => every(1).months({ on })).toThrow(RangeError);
  });

  it('refuses an unrecognised weekday loudly, as an untyped caller could send one', () => {
    expect(() => every(1).weeks(JSON.parse('{ "on": "funday" }'))).toThrow(RangeError);
  });

  it('refuses to advance from an invalid Date', () => {
    expect(() => every(1).days().next(new Date(Number.NaN))).toThrow(RangeError);
  });

  it.each([[0], [-2], [2 ** 53], [Number.NaN]])(
    'refuses a count of %p on the constructors themselves',
    count => {
      expect(() => calendarDays(count)).toThrow(RangeError);
    },
  );
});

/*****************************************************************************************************************/

describe('candidate contract', () => {
  it('weekly onOrAfter never proposes a day before the one given', () => {
    // 2026-01-15 is day 20468, a Thursday: Monday of its week has passed, so the following Monday is proposed.
    expect(weekly(1, 1).onOrAfter(20_468)).toBe(20_472);
  });

  it('monthly onOrAfter never proposes a day before the one given', () => {
    // 2026-01-20 is day 20473: the fifteenth of January has passed, so the fifteenth of April is proposed.
    expect(monthly(3, 15).onOrAfter(20_473)).toBe(20_558);
  });
});

/*****************************************************************************************************************/
