/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { parseRecurrenceRule } from '../src/index';

/*****************************************************************************************************************/

describe('parseRecurrenceRule across whole rules', () => {
  it('reads the simplest rule, leaving every other part unwritten', () => {
    expect(parseRecurrenceRule('FREQ=DAILY')).toStrictEqual({
      frequency: 'daily',
      interval: 1,
      count: null,
      until: null,
      months: null,
      daysOfMonth: null,
      daysOfWeek: null,
      hours: null,
      minutes: null,
      weekStart: 1,
    });
  });

  it('reads every part of a rule that writes them all', () => {
    expect(
      parseRecurrenceRule(
        'FREQ=WEEKLY;INTERVAL=2;COUNT=10;BYMONTH=1,6;BYDAY=MO,WE;BYHOUR=9;BYMINUTE=30;WKST=SU',
      ),
    ).toMatchObject({
      frequency: 'weekly',
      interval: 2,
      count: 10,
      months: [1, 6],
      daysOfWeek: [
        { weekday: 1, ordinal: null },
        { weekday: 3, ordinal: null },
      ],
      hours: [9],
      minutes: [30],
      weekStart: 7,
    });
  });

  it('survives the RRULE prefix, surrounding whitespace and lower casing', () => {
    expect(parseRecurrenceRule('  rrule:freq=monthly;interval=3  ')).toMatchObject({
      frequency: 'monthly',
      interval: 3,
    });
  });
});

/*****************************************************************************************************************/

describe('parseRecurrenceRule across frequencies', () => {
  it.each([
    ['MINUTELY', 'minutely'],
    ['HOURLY', 'hourly'],
    ['DAILY', 'daily'],
    ['WEEKLY', 'weekly'],
    ['MONTHLY', 'monthly'],
    ['YEARLY', 'yearly'],
  ])('reads the frequency %s', (written, frequency) => {
    expect(parseRecurrenceRule(`FREQ=${written}`).frequency).toBe(frequency);
  });
});

/*****************************************************************************************************************/

describe('parseRecurrenceRule across weekdays', () => {
  it('reads weekdays into Monday first numbering', () => {
    expect(parseRecurrenceRule('FREQ=WEEKLY;BYDAY=MO,SU').daysOfWeek).toStrictEqual([
      { weekday: 1, ordinal: null },
      { weekday: 7, ordinal: null },
    ]);
  });

  it('reads an ordinal occurrence within the period', () => {
    expect(parseRecurrenceRule('FREQ=MONTHLY;BYDAY=2MO').daysOfWeek).toStrictEqual([
      { weekday: 1, ordinal: 2 },
    ]);
  });

  it('reads an occurrence counted from the end of the period', () => {
    expect(parseRecurrenceRule('FREQ=MONTHLY;BYDAY=-1FR').daysOfWeek).toStrictEqual([
      { weekday: 5, ordinal: -1 },
    ]);
  });

  it('reads a leading plus as the ordinal it writes', () => {
    expect(parseRecurrenceRule('FREQ=MONTHLY;BYDAY=+3WE').daysOfWeek).toStrictEqual([
      { weekday: 3, ordinal: 3 },
    ]);
  });
});

/*****************************************************************************************************************/

describe('parseRecurrenceRule across the narrowing parts', () => {
  it('reads days of the month counted from either end', () => {
    expect(parseRecurrenceRule('FREQ=MONTHLY;BYMONTHDAY=1,15,-1').daysOfMonth).toStrictEqual([
      1, 15, -1,
    ]);
  });

  it('reads midnight and the top of the hour, the zeroes that mean something', () => {
    const parsed = parseRecurrenceRule('FREQ=DAILY;BYHOUR=0;BYMINUTE=0');

    expect(parsed.hours).toStrictEqual([0]);

    expect(parsed.minutes).toStrictEqual([0]);
  });

  it("reads an end by date in the notation's own form", () => {
    expect(parseRecurrenceRule('FREQ=DAILY;UNTIL=20260115T090000Z').until).toStrictEqual(
      new Date('2026-01-15T09:00:00Z'),
    );
  });

  it('reads an end by date written as a bare calendar day', () => {
    expect(parseRecurrenceRule('FREQ=DAILY;UNTIL=20260115').until).toStrictEqual(
      new Date('2026-01-15T00:00:00Z'),
    );
  });

  it('leaves a part the rule never wrote as null, not as every value', () => {
    const parsed = parseRecurrenceRule('FREQ=DAILY;BYHOUR=9');

    expect(parsed.hours).toStrictEqual([9]);

    expect(parsed.minutes).toBeNull();

    expect(parsed.months).toBeNull();
  });
});

/*****************************************************************************************************************/

describe('parseRecurrenceRule defensiveness', () => {
  it.each([[''], ['INTERVAL=2'], ['FREQ=FORTNIGHTLY'], ['FREQ=']])(
    'refuses "%s" for want of a frequency it knows',
    rule => {
      expect(() => parseRecurrenceRule(rule)).toThrow(RangeError);
    },
  );

  it('refuses a rule ending by both COUNT and UNTIL', () => {
    expect(() => parseRecurrenceRule('FREQ=DAILY;COUNT=5;UNTIL=20260115')).toThrow(
      /never by both/u,
    );
  });

  it('refuses a part written more than once', () => {
    expect(() => parseRecurrenceRule('FREQ=DAILY;INTERVAL=2;INTERVAL=3')).toThrow(
      /more than once/u,
    );
  });

  it('refuses a part it has never heard of', () => {
    expect(() => parseRecurrenceRule('FREQ=DAILY;BYFORTNIGHT=2')).toThrow(/no part named/u);
  });

  it('refuses a time of day that does not say it is UTC', () => {
    // Without the Z this is a floating local time, an instant only a calendar's own timezone can place.
    expect(() => parseRecurrenceRule('FREQ=DAILY;UNTIL=20260115T090000')).toThrow(/in UTC/u);
  });

  it('refuses an impossible calendar date rather than letting it roll over', () => {
    // Date.UTC would quietly read the thirty first of February as the third of March.
    expect(() => parseRecurrenceRule('FREQ=DAILY;UNTIL=20260231')).toThrow(/not a real instant/u);
  });

  it('quotes the whole rule when a part is empty', () => {
    expect(() => parseRecurrenceRule('FREQ=DAILY;;INTERVAL=2')).toThrow(
      /"FREQ=DAILY;;INTERVAL=2"/u,
    );
  });

  it.each([['BYSECOND=30'], ['BYYEARDAY=200'], ['BYWEEKNO=20'], ['BYSETPOS=-1']])(
    'refuses the unsupported part in "%s" by name',
    part => {
      expect(() => parseRecurrenceRule(`FREQ=YEARLY;${part}`)).toThrow(/not supported/u);
    },
  );
});

/*****************************************************************************************************************/

describe('parseRecurrenceRule refusal of malformed parts', () => {
  it.each([
    ['FREQ=DAILY;INTERVAL=0'],
    ['FREQ=DAILY;INTERVAL=-1'],
    ['FREQ=DAILY;COUNT=0'],
    ['FREQ=DAILY;BYMONTH=13'],
    ['FREQ=DAILY;BYMONTH=0'],
    ['FREQ=DAILY;BYMONTHDAY=0'],
    ['FREQ=DAILY;BYMONTHDAY=32'],
    ['FREQ=DAILY;BYHOUR=24'],
    ['FREQ=DAILY;BYMINUTE=60'],
    ['FREQ=DAILY;BYDAY=MONDAY'],
    ['FREQ=DAILY;BYDAY=0MO'],
    ['FREQ=DAILY;WKST=XX'],
    ['FREQ=DAILY;UNTIL=tomorrow'],
    ['FREQ=DAILY;UNTIL=2026-01-15'],
    ['FREQ=DAILY;UNTIL=20260231'],
    ['FREQ=DAILY;UNTIL=20261301'],
    ['FREQ=DAILY;UNTIL=20260115T250000Z'],
    ['FREQ=DAILY;COUNT=99999999999999999999'],
    ['FREQ=DAILY;INTERVAL=99999999999999999999'],
    ['FREQ=DAILY;;INTERVAL=2'],
    ['FREQ=DAILY;INTERVAL'],
  ])('refuses the malformed rule "%s" loudly', rule => {
    expect(() => parseRecurrenceRule(rule)).toThrow(RangeError);
  });
});

/*****************************************************************************************************************/
