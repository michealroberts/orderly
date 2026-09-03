/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { at, between, every, preview, type Schedule } from '../src/index';

/*****************************************************************************************************************/

const FROM = new Date('2026-01-15T08:30:00Z');

/*****************************************************************************************************************/

const OPENS = new Date('2026-01-15T10:00:00Z');

/*****************************************************************************************************************/

const CLOSES = new Date('2026-01-15T12:00:00Z');

/*****************************************************************************************************************/

// A schedule that must not be consulted: a window that has closed answers for itself.
const unasked: Schedule = {
  next: () => {
    throw new Error('the schedule was asked past the close of its window');
  },
};

/*****************************************************************************************************************/

describe('between() across its window', () => {
  it('keeps the occurrences inside the window, both ends included', () => {
    expect(
      preview(between(every(1).hours(), { from: OPENS, until: CLOSES }), { after: FROM, take: 5 }),
    ).toStrictEqual([OPENS, new Date('2026-01-15T11:00:00Z'), CLOSES]);
  });

  it('fires nothing before the window opens', () => {
    expect(between(every(1).hours(), { from: OPENS, until: CLOSES }).next(FROM)).toStrictEqual(
      OPENS,
    );
  });

  it('keeps an occurrence exactly at the open', () => {
    expect(between(at(OPENS).once(), { from: OPENS }).next(FROM)).toStrictEqual(OPENS);
  });

  it('keeps an occurrence exactly at the close, and nothing after it', () => {
    const schedule = between(at(CLOSES).once(), { until: CLOSES });

    expect(schedule.next(FROM)).toStrictEqual(CLOSES);

    expect(schedule.next(CLOSES)).toBeNull();
  });

  it('holds a single instant when it opens and closes at once', () => {
    expect(
      preview(between(every(1).hours(), { from: OPENS, until: OPENS }), { after: FROM, take: 3 }),
    ).toStrictEqual([OPENS]);
  });
});

/*****************************************************************************************************************/

describe('between() with an end left open', () => {
  it('bounds the start alone', () => {
    expect(
      preview(between(every(1).hours(), { from: OPENS }), { after: FROM, take: 2 }),
    ).toStrictEqual([OPENS, new Date('2026-01-15T11:00:00Z')]);
  });

  it('bounds the end alone', () => {
    expect(
      preview(between(every(1).hours(), { until: OPENS }), { after: FROM, take: 5 }),
    ).toStrictEqual([new Date('2026-01-15T09:00:00Z'), OPENS]);
  });

  it('is the schedule itself when neither end is bounded', () => {
    expect(between(every(1).hours()).next(FROM)).toStrictEqual(new Date('2026-01-15T09:00:00Z'));
  });
});

/*****************************************************************************************************************/

describe('between() across its ends', () => {
  it('exhausts once the window has closed, without asking the schedule', () => {
    expect(between(unasked, { until: CLOSES }).next(CLOSES)).toBeNull();

    expect(between(unasked, { until: CLOSES }).next(new Date(CLOSES.getTime() + 1))).toBeNull();
  });

  it('exhausts when the schedule does inside the window', () => {
    expect(between(at(OPENS).once(), { from: OPENS, until: CLOSES }).next(OPENS)).toBeNull();
  });
});

/*****************************************************************************************************************/

describe('between() purity', () => {
  it('is unaffected by later mutation of the Dates it was given', () => {
    const from = new Date(OPENS);

    const schedule = between(every(1).hours(), { from });

    from.setTime(0);

    expect(schedule.next(FROM)).toStrictEqual(OPENS);
  });

  it('computes the same occurrence from independent constructions', () => {
    expect(between(every(1).hours(), { from: OPENS, until: CLOSES }).next(FROM)).toStrictEqual(
      between(every(1).hours(), { from: OPENS, until: CLOSES }).next(FROM),
    );
  });
});

/*****************************************************************************************************************/

describe('between() refusal of what it is handed', () => {
  it('refuses a window that closes before it opens', () => {
    expect(() => between(every(1).hours(), { from: CLOSES, until: OPENS })).toThrow(
      'between() requires a window that closes no earlier than it opens',
    );
  });

  it('refuses an invalid Date at either end, at construction', () => {
    expect(() => between(every(1).hours(), { from: new Date(Number.NaN) })).toThrow(
      'between() requires a valid Date for from',
    );

    expect(() => between(every(1).hours(), { until: new Date(Number.NaN) })).toThrow(
      'between() requires a valid Date for until',
    );
  });

  it('refuses to advance from an invalid Date before the schedule is asked', () => {
    expect(() => between(unasked, { from: OPENS }).next(new Date(Number.NaN))).toThrow(
      'a window requires a valid Date to advance from',
    );
  });
});

/*****************************************************************************************************************/
