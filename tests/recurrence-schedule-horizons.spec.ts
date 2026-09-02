/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { recurrenceRule } from '../src/index';

/*****************************************************************************************************************/

const FROM = new Date('2026-01-15T09:00:00Z');

/*****************************************************************************************************************/

describe('recurrenceRule across days a rule below a day rarely reaches', () => {
  it('reaches a day two years of minutes away', () => {
    // The walk skips the days the date parts refuse rather than stepping through them, so it arrives rather
    // than giving up part way.
    expect(
      recurrenceRule('FREQ=MINUTELY;BYMONTH=2;BYMONTHDAY=29', { from: FROM }).next(FROM),
    ).toStrictEqual(new Date('2028-02-29T00:00:00Z'));
  });

  it('reaches a day across a century that skips its own leap year', () => {
    // Eight years of minutes, which is where stepping one at a time stops being merely slow: four million of
    // them, each reading the zone, would run past any patience this suite has, so arriving at all is the
    // guard against a walk that steps rather than skips.
    const from = new Date('2096-03-01T00:00:00Z');

    expect(
      recurrenceRule('FREQ=MINUTELY;BYMONTH=2;BYMONTHDAY=29', { from }).next(from),
    ).toStrictEqual(new Date('2104-02-29T00:00:00Z'));

    expect(
      recurrenceRule('FREQ=HOURLY;BYMONTH=2;BYMONTHDAY=29', { from }).next(from),
    ).toStrictEqual(new Date('2104-02-29T00:00:00Z'));
  });
});

/*****************************************************************************************************************/

describe('recurrenceRule across days a calendar rule rarely reaches', () => {
  // A weekly rule cannot carry a day of the month, so it names the weekday the leap day next falls on.
  it.each([
    ['FREQ=DAILY;BYMONTH=2;BYMONTHDAY=29'],
    ['FREQ=WEEKLY;BYMONTH=2;BYDAY=TU'],
    ['FREQ=MONTHLY;BYMONTH=2;BYMONTHDAY=29'],
    ['FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29'],
  ])('reaches February from "%s" years after the anchor', rule => {
    const from = new Date('2028-03-01T09:00:00Z');

    expect(recurrenceRule(rule, { from }).next(from)).not.toBeNull();
  });

  it('reaches a day across a century that skips its own leap year', () => {
    // Eight years of days: a walk counting periods rather than the days they span gives up long before this.
    const from = new Date('2096-03-01T09:00:00Z');

    expect(recurrenceRule('FREQ=DAILY;BYMONTH=2;BYMONTHDAY=29', { from }).next(from)).toStrictEqual(
      new Date('2104-02-29T09:00:00Z'),
    );
  });

  it('reaches it from a monthly rule too, where a period spans a month rather than a day', () => {
    const from = new Date('2096-03-01T09:00:00Z');

    expect(
      recurrenceRule('FREQ=MONTHLY;BYMONTH=2;BYMONTHDAY=29', { from }).next(from),
    ).toStrictEqual(new Date('2104-02-29T09:00:00Z'));
  });
});

/*****************************************************************************************************************/

describe('recurrenceRule across cadences too sparse to come round quickly', () => {
  // Each of these was computed independently by walking the cadence and reading the calendar, because a rule
  // whose period spans years crosses a decade in a handful of turns: counting the walk in calendar alone
  // would call every one of them impossible.
  it.each([
    ['FREQ=DAILY;INTERVAL=1000;BYMONTH=2', '2056-02-27T09:00:00Z'],
    ['FREQ=DAILY;INTERVAL=400;BYMONTHDAY=1', '2038-02-01T09:00:00Z'],
    ['FREQ=WEEKLY;INTERVAL=100;BYMONTH=2', '2047-02-14T09:00:00Z'],
  ])('reaches the occurrence "%s" names, however many turns it takes', (rule, expected) => {
    expect(recurrenceRule(rule, { from: FROM }).next(FROM)).toStrictEqual(new Date(expected));
  });

  it('still exhausts on a cadence that can never reach the month it names', () => {
    // Two years between periods holds the month still, so a January anchor never sees February.
    expect(
      recurrenceRule('FREQ=MONTHLY;INTERVAL=24;BYMONTH=2', { from: FROM }).next(FROM),
    ).toBeNull();
  });

  it('reaches a sparse cadence below a day too, where the walk counts days rather than steps', () => {
    expect(
      recurrenceRule('FREQ=MINUTELY;INTERVAL=100000;BYMONTH=2', { from: FROM }).next(FROM),
    ).toStrictEqual(new Date('2028-02-18T06:20:00Z'));
  });
});

/*****************************************************************************************************************/

describe('recurrenceRule at the end of the range a Date can hold', () => {
  // Every schedule in this module answers the end of time with exhaustion rather than an error, and a rule is
  // no exception on either of its paths, nor when an interval puts its second period past the end outright.
  const LAST = new Date(8_640_000_000_000_000 - 1);

  it.each([['FREQ=MINUTELY'], ['FREQ=HOURLY;BYMINUTE=0,30'], ['FREQ=DAILY'], ['FREQ=YEARLY']])(
    'exhausts "%s" rather than throwing',
    rule => {
      expect(recurrenceRule(rule).next(LAST)).toBeNull();
    },
  );

  it('exhausts an interval whose next period lies past the end of time', () => {
    expect(
      recurrenceRule('FREQ=DAILY;INTERVAL=9007199254740991', { from: FROM }).next(FROM),
    ).toBeNull();
  });
});

/*****************************************************************************************************************/
