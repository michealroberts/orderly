/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { preview, recurrenceRule } from '../src/index';

/*****************************************************************************************************************/

// The table RFC 5545 gives each BY part, which says whether a part narrows the occurrences its frequency
// already holds or expands the frequency into the ones it names. The two read nothing alike: a part that
// narrows can only ever remove occurrences, while one that expands multiplies them. These walk the rows this
// module honours, so a row read the wrong way round is caught here rather than by whoever relied on it.

/*****************************************************************************************************************/

const FROM = new Date('2026-01-15T09:00:00Z');

/*****************************************************************************************************************/

// The times of day a rule yields, which is what the narrowing and expanding rows are visible in.
const timesOf = (rule: string, take: number): string[] => {
  return preview(recurrenceRule(rule, { from: FROM }), { after: FROM, take }).map(occurrence =>
    occurrence.toISOString().slice(11, 16),
  );
};

/*****************************************************************************************************************/

describe('the rows RFC 5545 has expand', () => {
  it('expands an hourly rule by the minutes it names, twice an hour rather than once', () => {
    expect(timesOf('FREQ=HOURLY;BYMINUTE=0,30', 4)).toStrictEqual([
      '09:30',
      '10:00',
      '10:30',
      '11:00',
    ]);
  });

  it('expands a daily rule by both the hours and the minutes it names', () => {
    expect(timesOf('FREQ=DAILY;BYHOUR=9,17;BYMINUTE=0,30', 4)).toStrictEqual([
      '09:30',
      '17:00',
      '17:30',
      '09:00',
    ]);
  });

  it('expands a yearly rule into the months it names', () => {
    expect(
      preview(recurrenceRule('FREQ=YEARLY;BYMONTH=3,9', { from: FROM }), { after: FROM, take: 2 }),
    ).toStrictEqual([new Date('2026-03-15T09:00:00Z'), new Date('2026-09-15T09:00:00Z')]);
  });

  it('expands a monthly rule into the days of the month it names', () => {
    expect(
      preview(recurrenceRule('FREQ=MONTHLY;BYMONTHDAY=1,15', { from: FROM }), {
        after: FROM,
        take: 2,
      }),
    ).toStrictEqual([new Date('2026-02-01T09:00:00Z'), new Date('2026-02-15T09:00:00Z')]);
  });
});

/*****************************************************************************************************************/

describe('the rows RFC 5545 has narrow', () => {
  it('narrows an hourly rule to the hours it names, leaving the minute where the anchor put it', () => {
    expect(timesOf('FREQ=HOURLY;BYHOUR=9,10', 4)).toStrictEqual([
      '10:00',
      '09:00',
      '10:00',
      '09:00',
    ]);
  });

  it('narrows an hourly rule by the hours it names even while its minutes expand', () => {
    // Half past nine on the anchor's day, then nine and half past on the next: the two rows meet in one rule,
    // and the one that narrows still holds every step outside its hours to nothing.
    expect(timesOf('FREQ=HOURLY;BYHOUR=9;BYMINUTE=0,30', 3)).toStrictEqual([
      '09:30',
      '09:00',
      '09:30',
    ]);
  });

  it('narrows a minutely rule to the minutes it names rather than expanding it', () => {
    expect(timesOf('FREQ=MINUTELY;BYMINUTE=0,30', 4)).toStrictEqual([
      '09:30',
      '10:00',
      '10:30',
      '11:00',
    ]);
  });

  it('narrows a daily rule to the weekdays it names, never adding a day', () => {
    expect(
      preview(recurrenceRule('FREQ=DAILY;BYDAY=SA,SU', { from: FROM }), { after: FROM, take: 2 }),
    ).toStrictEqual([new Date('2026-01-17T09:00:00Z'), new Date('2026-01-18T09:00:00Z')]);
  });

  it('narrows a monthly rule by weekday once a day of the month is named as well', () => {
    // The first and the fifteenth, kept only where they fall on a Wednesday. Through 2026 those days are
    // Sundays in February and March and Wednesdays in April, so a narrowing rule skips four and keeps two;
    // a rule that read the weekday as expanding would have answered with February.
    expect(
      preview(recurrenceRule('FREQ=MONTHLY;BYMONTHDAY=1,15;BYDAY=WE', { from: FROM }), {
        after: FROM,
        take: 2,
      }),
    ).toStrictEqual([new Date('2026-04-01T09:00:00Z'), new Date('2026-04-15T09:00:00Z')]);
  });
});

/*****************************************************************************************************************/
