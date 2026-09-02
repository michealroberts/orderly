/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { preview, recurrenceRule } from '../src/index';

/*****************************************************************************************************************/

const FROM = new Date('2026-01-15T09:00:00Z');

/*****************************************************************************************************************/

describe('recurrenceRule across frequencies below a day', () => {
  it('steps by the minutes it names', () => {
    expect(
      preview(recurrenceRule('FREQ=MINUTELY;INTERVAL=15', { from: FROM }), {
        after: FROM,
        take: 2,
      }),
    ).toStrictEqual([new Date('2026-01-15T09:15:00Z'), new Date('2026-01-15T09:30:00Z')]);
  });

  it('steps by the hours it names', () => {
    expect(
      preview(recurrenceRule('FREQ=HOURLY;INTERVAL=6', { from: FROM }), { after: FROM, take: 2 }),
    ).toStrictEqual([new Date('2026-01-15T15:00:00Z'), new Date('2026-01-15T21:00:00Z')]);
  });

  it('narrows an hourly rule to the hours it names', () => {
    expect(
      preview(recurrenceRule('FREQ=HOURLY;BYHOUR=9,10', { from: FROM }), { after: FROM, take: 2 }),
    ).toStrictEqual([new Date('2026-01-15T10:00:00Z'), new Date('2026-01-16T09:00:00Z')]);
  });
});

/*****************************************************************************************************************/

describe('recurrenceRule across transitions below a day', () => {
  it('stays hourly across a transition rather than following the wall clock', () => {
    const occurrences = preview(
      recurrenceRule('FREQ=HOURLY', {
        from: new Date('2026-03-08T05:00:00Z'),
        timezone: 'America/New_York',
      }),
      { after: new Date('2026-03-08T05:00:00Z'), take: 2 },
    );

    expect(occurrences).toStrictEqual([
      new Date('2026-03-08T06:00:00Z'),
      new Date('2026-03-08T07:00:00Z'),
    ]);
  });

  it('expands both instances of an hour a fall back repeats, once at each offset', () => {
    // New York falls back at 06:00Z, so the hour from one o'clock is read twice; the steps visit both, and
    // the minute each expands to is placed at the offset its step was read at, so the second half past one is
    // an occurrence of its own rather than the first one over again.
    const from = new Date('2026-11-01T04:00:00Z');

    expect(
      preview(recurrenceRule('FREQ=HOURLY;BYMINUTE=30', { from, timezone: 'America/New_York' }), {
        after: from,
        take: 4,
      }),
    ).toStrictEqual([
      new Date('2026-11-01T04:30:00Z'),
      new Date('2026-11-01T05:30:00Z'),
      new Date('2026-11-01T06:30:00Z'),
      new Date('2026-11-01T07:30:00Z'),
    ]);
  });
});

/*****************************************************************************************************************/

describe('recurrenceRule across transitions of half an hour', () => {
  it('places a minute a half hour transition skips where the notation puts a time that never happened', () => {
    // Lord Howe Island moves its clocks from two to half past two, so the step read at half past two expands
    // to a quarter past that never happened: it is read at the offset before the gap, which lands it at a
    // quarter to three, the one instant the minute forty five was already bound for.
    const from = new Date('2026-10-03T14:30:00Z');

    expect(
      preview(
        recurrenceRule('FREQ=HOURLY;BYMINUTE=15,45', { from, timezone: 'Australia/Lord_Howe' }),
        { after: from, take: 4 },
      ),
    ).toStrictEqual([
      new Date('2026-10-03T14:45:00Z'),
      new Date('2026-10-03T15:15:00Z'),
      new Date('2026-10-03T15:45:00Z'),
      new Date('2026-10-03T16:15:00Z'),
    ]);
  });

  it('repeats only the minutes a half hour fall back actually repeats', () => {
    // Lord Howe Island moves its clocks from two back to half past one, so a quarter to two comes round twice
    // where a quarter past comes round once: the step read in the repeated half hour expands to the second of
    // the one and, finding the other skipped at its own offset, to the single instance of it there ever was.
    const from = new Date('2026-04-04T14:00:00Z');

    expect(
      preview(
        recurrenceRule('FREQ=HOURLY;BYMINUTE=15,45', { from, timezone: 'Australia/Lord_Howe' }),
        { after: from, take: 5 },
      ),
    ).toStrictEqual([
      new Date('2026-04-04T14:15:00Z'),
      new Date('2026-04-04T14:45:00Z'),
      new Date('2026-04-04T15:15:00Z'),
      new Date('2026-04-04T15:45:00Z'),
      new Date('2026-04-04T16:15:00Z'),
    ]);
  });
});

/*****************************************************************************************************************/

describe('recurrenceRule across its ends', () => {
  it('exhausts once the count is spent, the anchor being the first of them', () => {
    // A count of three names the anchor and the two days after it, so only two remain ahead of the anchor.
    expect(
      preview(recurrenceRule('FREQ=DAILY;COUNT=3', { from: FROM }), { after: FROM, take: 10 }),
    ).toStrictEqual([new Date('2026-01-16T09:00:00Z'), new Date('2026-01-17T09:00:00Z')]);
  });

  it('counts the anchor itself as the first occurrence', () => {
    expect(
      preview(recurrenceRule('FREQ=DAILY;COUNT=2', { from: FROM }), {
        after: new Date('2026-01-14T00:00:00Z'),
        take: 10,
      }),
    ).toStrictEqual([new Date('2026-01-15T09:00:00Z'), new Date('2026-01-16T09:00:00Z')]);
  });

  it('exhausts once the end by date has passed', () => {
    expect(
      preview(recurrenceRule('FREQ=DAILY;UNTIL=20260117T090000Z', { from: FROM }), {
        after: FROM,
        take: 10,
      }),
    ).toStrictEqual([new Date('2026-01-16T09:00:00Z'), new Date('2026-01-17T09:00:00Z')]);
  });

  it('never fires before the anchor it counts from', () => {
    expect(
      recurrenceRule('FREQ=DAILY', { from: FROM }).next(new Date('2020-01-01T00:00:00Z')),
    ).toStrictEqual(FROM);
  });
});

/*****************************************************************************************************************/

describe('recurrenceRule across anchors that are not whole minutes', () => {
  const UNEVEN = new Date('2026-01-15T09:00:30.250Z');

  it('still fires the anchor itself, read down to the minute it falls in', () => {
    expect(
      recurrenceRule('FREQ=DAILY', { from: UNEVEN }).next(new Date('2020-01-01T00:00:00Z')),
    ).toStrictEqual(new Date('2026-01-15T09:00:00Z'));
  });

  it('counts the anchor as the first occurrence rather than stepping over it', () => {
    expect(
      preview(recurrenceRule('FREQ=DAILY;COUNT=2', { from: UNEVEN }), {
        after: new Date('2020-01-01T00:00:00Z'),
        take: 5,
      }),
    ).toStrictEqual([new Date('2026-01-15T09:00:00Z'), new Date('2026-01-16T09:00:00Z')]);
  });

  it('steps a rule below a day from the same whole minute', () => {
    expect(
      preview(recurrenceRule('FREQ=MINUTELY', { from: UNEVEN }), { after: UNEVEN, take: 2 }),
    ).toStrictEqual([new Date('2026-01-15T09:01:00Z'), new Date('2026-01-15T09:02:00Z')]);
  });
});

/*****************************************************************************************************************/

describe('recurrenceRule across timezones', () => {
  it('reads its wall times in the timezone given', () => {
    expect(
      recurrenceRule('FREQ=DAILY;BYHOUR=9;BYMINUTE=0', {
        from: FROM,
        timezone: 'America/New_York',
      }).next(FROM),
    ).toStrictEqual(new Date('2026-01-15T14:00:00Z'));
  });

  it('keeps a daily wall time as the clocks change', () => {
    expect(
      preview(
        recurrenceRule('FREQ=DAILY;BYHOUR=9;BYMINUTE=0', {
          from: new Date('2026-03-27T09:00:00Z'),
          timezone: 'Europe/London',
        }),
        { after: new Date('2026-03-28T12:00:00Z'), take: 2 },
      ),
    ).toStrictEqual([new Date('2026-03-29T08:00:00Z'), new Date('2026-03-30T08:00:00Z')]);
  });
});

/*****************************************************************************************************************/

describe('recurrenceRule defensiveness', () => {
  it('refuses a day of the month narrowing a weekly rule, as the notation forbids', () => {
    expect(() => recurrenceRule('FREQ=WEEKLY;BYMONTHDAY=1')).toThrow(/weekly rule/u);
  });

  it.each([['FREQ=DAILY;BYDAY=2MO'], ['FREQ=WEEKLY;BYDAY=-1FR'], ['FREQ=HOURLY;BYDAY=2MO']])(
    'refuses the counted weekday in "%s", which only a monthly or yearly rule may carry',
    rule => {
      expect(() => recurrenceRule(rule)).toThrow(/monthly or yearly/u);
    },
  );

  it('refuses a counted weekday alongside a day of the month', () => {
    expect(() => recurrenceRule('FREQ=MONTHLY;BYDAY=2MO;BYMONTHDAY=15')).toThrow(
      /while BYMONTHDAY/u,
    );
  });

  it('refuses a count past the ceiling rather than exhausting early and lying about its end', () => {
    expect(() => recurrenceRule('FREQ=DAILY;COUNT=10001')).toThrow(/honoured up to 10000/u);
  });

  it('honours a count at the ceiling itself', () => {
    expect(() => recurrenceRule('FREQ=DAILY;COUNT=10000')).not.toThrow();
  });

  it('refuses a malformed rule at construction, not at the first next()', () => {
    expect(() => recurrenceRule('FREQ=FORTNIGHTLY')).toThrow(RangeError);
  });
});

/*****************************************************************************************************************/

describe('recurrenceRule refusal of what it is handed', () => {
  it('refuses an unknown timezone at construction, not at the first next()', () => {
    expect(() => recurrenceRule('FREQ=DAILY', { timezone: 'Neverland/Second_Star' })).toThrow(
      RangeError,
    );
  });

  it('refuses an invalid anchor', () => {
    expect(() => recurrenceRule('FREQ=DAILY', { from: new Date(Number.NaN) })).toThrow(RangeError);
  });

  it('refuses to advance from an invalid Date', () => {
    expect(() => recurrenceRule('FREQ=DAILY').next(new Date(Number.NaN))).toThrow(RangeError);
  });

  it('computes the same occurrence from independent constructions', () => {
    const after = new Date('2026-06-01T09:17:43Z');

    expect(recurrenceRule('FREQ=MONTHLY;BYDAY=2MO', { from: FROM }).next(after)).toStrictEqual(
      recurrenceRule('FREQ=MONTHLY;BYDAY=2MO', { from: FROM }).next(after),
    );
  });
});

/*****************************************************************************************************************/
