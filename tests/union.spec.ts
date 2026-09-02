/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { at, cron, every, preview, union } from '../src/index';

/*****************************************************************************************************************/

const FROM = new Date('2026-01-15T09:00:00Z');

/*****************************************************************************************************************/

const EARLY = new Date('2026-01-15T10:00:00Z');

/*****************************************************************************************************************/

const LATE = new Date('2026-01-15T11:00:00Z');

/*****************************************************************************************************************/

describe('union() across its members', () => {
  it('fires whenever any member does, and once where two agree', () => {
    // Every ten minutes and every fifteen: half past nine is named by both, and fires once.
    expect(
      preview(union([every(10).minutes(), every(15).minutes()]), { after: FROM, take: 5 }),
    ).toStrictEqual([
      new Date('2026-01-15T09:10:00Z'),
      new Date('2026-01-15T09:15:00Z'),
      new Date('2026-01-15T09:20:00Z'),
      new Date('2026-01-15T09:30:00Z'),
      new Date('2026-01-15T09:40:00Z'),
    ]);
  });

  it('answers with the earliest member, whichever that is', () => {
    const schedule = union([at(LATE).once(), at(EARLY).once()]);

    expect(schedule.next(FROM)).toStrictEqual(EARLY);

    expect(schedule.next(EARLY)).toStrictEqual(LATE);
  });

  it('joins schedules of different kinds', () => {
    // Weekdays at nine and weekends at noon, asked from a Friday morning: the weekend comes first, then the
    // working week resumes. Cloudflare counts the days of the week from Sunday as one.
    const schedule = union([cron('0 9 * * 2-6'), cron('0 12 * * 1,7')]);

    expect(preview(schedule, { after: new Date('2026-01-16T10:00:00Z'), take: 4 })).toStrictEqual([
      new Date('2026-01-17T12:00:00Z'),
      new Date('2026-01-18T12:00:00Z'),
      new Date('2026-01-19T09:00:00Z'),
      new Date('2026-01-20T09:00:00Z'),
    ]);
  });

  it('nests, a union of unions being the union of their members', () => {
    const last = new Date('2026-01-15T12:00:00Z');

    expect(
      preview(union([union([at(last).once(), at(EARLY).once()]), at(LATE).once()]), {
        after: FROM,
        take: 3,
      }),
    ).toStrictEqual([EARLY, LATE, last]);
  });
});

/*****************************************************************************************************************/

describe('union() across its ends', () => {
  it('exhausts only once every member has', () => {
    const schedule = union([at(EARLY).once(), at(LATE).once()]);

    expect(schedule.next(EARLY)).toStrictEqual(LATE);

    expect(schedule.next(LATE)).toBeNull();
  });

  it('has no occurrences when built from nothing, which is the identity of a union', () => {
    expect(union([]).next(FROM)).toBeNull();
  });
});

/*****************************************************************************************************************/

describe('union() purity', () => {
  it('is unaffected by later mutation of the list it was given', () => {
    const members = [at(LATE).once()];

    const schedule = union(members);

    members.push(at(EARLY).once());

    expect(schedule.next(FROM)).toStrictEqual(LATE);
  });

  it('computes the same occurrence from independent constructions', () => {
    expect(union([every(10).minutes(), every(15).minutes()]).next(FROM)).toStrictEqual(
      union([every(10).minutes(), every(15).minutes()]).next(FROM),
    );
  });
});

/*****************************************************************************************************************/

describe('union() refusal of what it is handed', () => {
  it('refuses to advance from an invalid Date, even with no member to ask', () => {
    expect(() => union([]).next(new Date(Number.NaN))).toThrow(RangeError);
  });

  it('refuses to advance from an invalid Date before any member is asked', () => {
    expect(() => union([every(5).minutes()]).next(new Date(Number.NaN))).toThrow(
      'a union requires a valid Date to advance from',
    );
  });
});

/*****************************************************************************************************************/
