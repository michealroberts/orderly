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

describe('recurrenceRule across daily rules', () => {
  it('takes its time of day from the anchor when the rule names none', () => {
    expect(recurrenceRule('FREQ=DAILY', { from: FROM }).next(FROM)).toStrictEqual(
      new Date('2026-01-16T09:00:00Z'),
    );
  });

  it('anchors to the epoch when no anchor is given, as every constructor here does', () => {
    expect(recurrenceRule('FREQ=DAILY').next(new Date('2026-01-15T05:00:00Z'))).toStrictEqual(
      new Date('2026-01-16T00:00:00Z'),
    );
  });

  it('counts its interval from the anchor, not from the epoch', () => {
    expect(
      preview(recurrenceRule('FREQ=DAILY;INTERVAL=3', { from: FROM }), { after: FROM, take: 2 }),
    ).toStrictEqual([new Date('2026-01-18T09:00:00Z'), new Date('2026-01-21T09:00:00Z')]);
  });

  it('crosses hours and minutes into every time of day it names', () => {
    expect(
      preview(recurrenceRule('FREQ=DAILY;BYHOUR=9,17;BYMINUTE=0,30', { from: FROM }), {
        after: FROM,
        take: 4,
      }),
    ).toStrictEqual([
      new Date('2026-01-15T09:30:00Z'),
      new Date('2026-01-15T17:00:00Z'),
      new Date('2026-01-15T17:30:00Z'),
      new Date('2026-01-16T09:00:00Z'),
    ]);
  });

  it('narrows a daily rule by weekday rather than expanding it', () => {
    expect(
      preview(recurrenceRule('FREQ=DAILY;BYDAY=SA,SU', { from: FROM }), { after: FROM, take: 3 }),
    ).toStrictEqual([
      new Date('2026-01-17T09:00:00Z'),
      new Date('2026-01-18T09:00:00Z'),
      new Date('2026-01-24T09:00:00Z'),
    ]);
  });
});

/*****************************************************************************************************************/

describe('recurrenceRule across weekly rules', () => {
  it('takes its weekday from the anchor when the rule names none', () => {
    // The fifteenth of January 2026 is a Thursday.
    expect(recurrenceRule('FREQ=WEEKLY', { from: FROM }).next(FROM)).toStrictEqual(
      new Date('2026-01-22T09:00:00Z'),
    );
  });

  it('expands a week into every weekday it names', () => {
    expect(
      preview(recurrenceRule('FREQ=WEEKLY;BYDAY=MO,FR', { from: FROM }), { after: FROM, take: 3 }),
    ).toStrictEqual([
      new Date('2026-01-16T09:00:00Z'),
      new Date('2026-01-19T09:00:00Z'),
      new Date('2026-01-23T09:00:00Z'),
    ]);
  });

  it("skips a week when the interval says to, counting weeks from the anchor's own", () => {
    // The anchor falls in the week starting Monday the twelfth, so every other week is that one, the twenty
    // sixth and the ninth of February; the Monday of the anchor's own week precedes it and never fires.
    expect(
      preview(recurrenceRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO', { from: FROM }), {
        after: FROM,
        take: 2,
      }),
    ).toStrictEqual([new Date('2026-01-26T09:00:00Z'), new Date('2026-02-09T09:00:00Z')]);
  });
});

/*****************************************************************************************************************/

describe('recurrenceRule across monthly rules', () => {
  it('takes its day of the month from the anchor when the rule names none', () => {
    expect(recurrenceRule('FREQ=MONTHLY', { from: FROM }).next(FROM)).toStrictEqual(
      new Date('2026-02-15T09:00:00Z'),
    );
  });

  it('expands a month into every day of it the rule names', () => {
    expect(
      preview(recurrenceRule('FREQ=MONTHLY;BYMONTHDAY=1,15', { from: FROM }), {
        after: FROM,
        take: 3,
      }),
    ).toStrictEqual([
      new Date('2026-02-01T09:00:00Z'),
      new Date('2026-02-15T09:00:00Z'),
      new Date('2026-03-01T09:00:00Z'),
    ]);
  });

  it('counts a day of the month from the end when it is written negative', () => {
    expect(
      preview(recurrenceRule('FREQ=MONTHLY;BYMONTHDAY=-1', { from: FROM }), {
        after: FROM,
        take: 3,
      }),
    ).toStrictEqual([
      new Date('2026-01-31T09:00:00Z'),
      new Date('2026-02-28T09:00:00Z'),
      new Date('2026-03-31T09:00:00Z'),
    ]);
  });

  it('skips a month too short to hold the day it names', () => {
    expect(
      preview(recurrenceRule('FREQ=MONTHLY;BYMONTHDAY=31', { from: FROM }), {
        after: new Date('2026-01-31T12:00:00Z'),
        take: 2,
      }),
    ).toStrictEqual([new Date('2026-03-31T09:00:00Z'), new Date('2026-05-31T09:00:00Z')]);
  });
});

/*****************************************************************************************************************/

describe('recurrenceRule across counted weekdays of a month', () => {
  it('counts an occurrence of a weekday within the month', () => {
    // The second Monday of February 2026 is the ninth, and of March the ninth again.
    expect(
      preview(recurrenceRule('FREQ=MONTHLY;BYDAY=2MO', { from: FROM }), { after: FROM, take: 2 }),
    ).toStrictEqual([new Date('2026-02-09T09:00:00Z'), new Date('2026-03-09T09:00:00Z')]);
  });

  it('counts an occurrence from the end of the month when the ordinal is negative', () => {
    expect(
      preview(recurrenceRule('FREQ=MONTHLY;BYDAY=-1FR', { from: FROM }), { after: FROM, take: 2 }),
    ).toStrictEqual([new Date('2026-01-30T09:00:00Z'), new Date('2026-02-27T09:00:00Z')]);
  });
});

/*****************************************************************************************************************/

describe('recurrenceRule across yearly rules', () => {
  it('takes its month and day from the anchor when the rule names neither', () => {
    expect(recurrenceRule('FREQ=YEARLY', { from: FROM }).next(FROM)).toStrictEqual(
      new Date('2027-01-15T09:00:00Z'),
    );
  });

  it('expands a year into the months it names', () => {
    expect(
      preview(recurrenceRule('FREQ=YEARLY;BYMONTH=3,9', { from: FROM }), { after: FROM, take: 3 }),
    ).toStrictEqual([
      new Date('2026-03-15T09:00:00Z'),
      new Date('2026-09-15T09:00:00Z'),
      new Date('2027-03-15T09:00:00Z'),
    ]);
  });

  it('finds the twenty ninth of February only in the years that hold it', () => {
    expect(
      preview(recurrenceRule('FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29', { from: FROM }), {
        after: FROM,
        take: 2,
      }),
    ).toStrictEqual([new Date('2028-02-29T09:00:00Z'), new Date('2032-02-29T09:00:00Z')]);
  });
});

/*****************************************************************************************************************/
