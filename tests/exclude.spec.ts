/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { at, cron, every, exclude, preview } from '../src/index';

/*****************************************************************************************************************/

const FROM = new Date('2026-01-15T09:00:00Z');

/*****************************************************************************************************************/

const EARLY = new Date('2026-01-15T10:00:00Z');

/*****************************************************************************************************************/

const LATE = new Date('2026-01-15T11:00:00Z');

/*****************************************************************************************************************/

describe('exclude() across what it removes', () => {
  it('skips the occurrences the exclusion names', () => {
    // Every hour, less noon: the walk passes noon and picks up at one.
    expect(
      preview(exclude(every(1).hours(), cron('0 12 * * *')), {
        after: new Date('2026-01-15T10:00:00Z'),
        take: 3,
      }),
    ).toStrictEqual([
      new Date('2026-01-15T11:00:00Z'),
      new Date('2026-01-15T13:00:00Z'),
      new Date('2026-01-15T14:00:00Z'),
    ]);
  });

  it('skips the holiday a daily schedule would otherwise fire on', () => {
    expect(
      preview(exclude(cron('0 9 * * *'), cron('0 9 25 12 *')), {
        after: new Date('2026-12-24T10:00:00Z'),
        take: 2,
      }),
    ).toStrictEqual([new Date('2026-12-26T09:00:00Z'), new Date('2026-12-27T09:00:00Z')]);
  });

  it('skips the hours of a weekly window an hourly schedule ticks through', () => {
    // Two and three in the morning on Sundays, which Cloudflare counts as day one.
    expect(
      preview(exclude(every(1).hours(), cron('0 2,3 * * 1')), {
        after: new Date('2026-01-17T23:30:00Z'),
        take: 4,
      }),
    ).toStrictEqual([
      new Date('2026-01-18T00:00:00Z'),
      new Date('2026-01-18T01:00:00Z'),
      new Date('2026-01-18T04:00:00Z'),
      new Date('2026-01-18T05:00:00Z'),
    ]);
  });

  it('matches to the millisecond, keeping an occurrence the exclusion misses by one', () => {
    const nearly = new Date(EARLY.getTime() + 1);

    expect(exclude(at(EARLY).once(), at(nearly).once()).next(FROM)).toStrictEqual(EARLY);
  });

  it('removes nothing when the exclusion names nothing of the schedule', () => {
    expect(exclude(at(EARLY).once(), at(LATE).once()).next(FROM)).toStrictEqual(EARLY);
  });
});

/*****************************************************************************************************************/

describe('exclude() across its ends', () => {
  it('exhausts when the schedule does', () => {
    expect(exclude(at(EARLY).once(), at(LATE).once()).next(EARLY)).toBeNull();
  });

  it('exhausts when the exclusion removes the last occurrence', () => {
    expect(exclude(at(EARLY).once(), at(EARLY).once()).next(FROM)).toBeNull();
  });

  it('finds an occurrence past hundreds of excluded ones in a row', () => {
    // Every minute, less every minute of the working day: nine hours of exclusions before six o'clock.
    expect(
      exclude(every(1).minutes(), cron('* 9-17 * * *')).next(new Date('2026-01-15T08:59:00Z')),
    ).toStrictEqual(new Date('2026-01-15T18:00:00Z'));
  });

  it('reads a schedule excluded from itself as exhausted rather than searching forever', () => {
    expect(exclude(every(1).minutes(), every(1).minutes()).next(FROM)).toBeNull();
  });
});

/*****************************************************************************************************************/

describe('exclude() purity', () => {
  it('computes the same occurrence from independent constructions', () => {
    expect(exclude(every(1).hours(), cron('0 12 * * *')).next(FROM)).toStrictEqual(
      exclude(every(1).hours(), cron('0 12 * * *')).next(FROM),
    );
  });
});

/*****************************************************************************************************************/

describe('exclude() refusal of what it is handed', () => {
  it('refuses to advance from an invalid Date before either schedule is asked', () => {
    expect(() =>
      exclude(every(5).minutes(), every(10).minutes()).next(new Date(Number.NaN)),
    ).toThrow('an exclusion requires a valid Date to advance from');
  });
});

/*****************************************************************************************************************/
