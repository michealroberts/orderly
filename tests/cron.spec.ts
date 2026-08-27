/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { cron, preview } from '../src/index';

/*****************************************************************************************************************/

describe('cron across times of day', () => {
  it('lands on the next minute for the run always expression', () => {
    expect(cron('* * * * *').next(new Date('2026-01-15T12:03:21Z'))).toStrictEqual(
      new Date('2026-01-15T12:04:00Z'),
    );
  });

  it('advances strictly past an instant already on an occurrence', () => {
    expect(cron('* * * * *').next(new Date('2026-01-15T12:04:00Z'))).toStrictEqual(
      new Date('2026-01-15T12:05:00Z'),
    );
  });

  it('walks a stepped minute expression within the hour', () => {
    expect(
      preview(cron('*/15 * * * *'), { after: new Date('2026-01-15T12:00:00Z'), take: 4 }),
    ).toStrictEqual([
      new Date('2026-01-15T12:15:00Z'),
      new Date('2026-01-15T12:30:00Z'),
      new Date('2026-01-15T12:45:00Z'),
      new Date('2026-01-15T13:00:00Z'),
    ]);
  });

  it('crosses midnight into the following day', () => {
    expect(cron('0 9 * * *').next(new Date('2026-01-15T12:00:00Z'))).toStrictEqual(
      new Date('2026-01-16T09:00:00Z'),
    );
  });

  it('stays on the same day when a time is still ahead', () => {
    expect(cron('0 9 * * *').next(new Date('2026-01-15T03:00:00Z'))).toStrictEqual(
      new Date('2026-01-15T09:00:00Z'),
    );
  });

  it('walks a list of times in order', () => {
    expect(
      preview(cron('30 9,17 * * *'), { after: new Date('2026-01-15T00:00:00Z'), take: 3 }),
    ).toStrictEqual([
      new Date('2026-01-15T09:30:00Z'),
      new Date('2026-01-15T17:30:00Z'),
      new Date('2026-01-16T09:30:00Z'),
    ]);
  });
});

/*****************************************************************************************************************/

describe('cron across the day fields', () => {
  it('matches only the day of month when only it is written', () => {
    expect(cron('0 0 15 * *').next(new Date('2026-01-01T00:00:00Z'))).toStrictEqual(
      new Date('2026-01-15T00:00:00Z'),
    );
  });

  it('matches only the day of week when only it is written', () => {
    // The first of January 2026 is a Thursday, so the second is the first Friday on or after it.
    expect(cron('0 0 * * FRI').next(new Date('2026-01-01T00:00:00Z'))).toStrictEqual(
      new Date('2026-01-02T00:00:00Z'),
    );
  });

  it('matches either day when both are written, as classic cron reads it', () => {
    // The thirteenth and every Friday: the second of January is a Friday, so it comes before the thirteenth.
    expect(
      preview(cron('0 0 13 * FRI'), { after: new Date('2026-01-01T00:00:00Z'), take: 4 }),
    ).toStrictEqual([
      new Date('2026-01-02T00:00:00Z'),
      new Date('2026-01-09T00:00:00Z'),
      new Date('2026-01-13T00:00:00Z'),
      new Date('2026-01-16T00:00:00Z'),
    ]);
  });

  it('honours the month field', () => {
    expect(cron('0 0 1 JUL *').next(new Date('2026-01-15T00:00:00Z'))).toStrictEqual(
      new Date('2026-07-01T00:00:00Z'),
    );
  });

  it('finds the twenty ninth of February across a leap year gap', () => {
    expect(cron('0 0 29 2 *').next(new Date('2026-03-01T00:00:00Z'))).toStrictEqual(
      new Date('2028-02-29T00:00:00Z'),
    );
  });

  it('reads weekday digits the way Cloudflare counts them', () => {
    // 1 is Sunday: the fourth of January 2026 is the first Sunday of the year.
    expect(cron('0 0 * * 1').next(new Date('2026-01-01T00:00:00Z'))).toStrictEqual(
      new Date('2026-01-04T00:00:00Z'),
    );
  });
});

/*****************************************************************************************************************/

describe('cron across timezones', () => {
  it('reads wall times in the timezone given', () => {
    expect(
      cron('0 9 * * *', { timezone: 'America/New_York' }).next(new Date('2026-01-15T00:00:00Z')),
    ).toStrictEqual(new Date('2026-01-15T14:00:00Z'));
  });

  it('places the day on the timezone calendar, not on the UTC one', () => {
    // Late on the fourteenth in New York is already the fifteenth in UTC, so a fifteenth of the month
    // expression must still be waiting.
    expect(
      cron('0 0 15 * *', { timezone: 'America/New_York' }).next(new Date('2026-01-15T02:00:00Z')),
    ).toStrictEqual(new Date('2026-01-15T05:00:00Z'));
  });

  it('defaults to UTC, as Cloudflare cron triggers read expressions', () => {
    expect(cron('0 9 * * *').next(new Date('2026-01-15T00:00:00Z'))).toStrictEqual(
      new Date('2026-01-15T09:00:00Z'),
    );
  });
});

/*****************************************************************************************************************/

describe('cron across daylight saving', () => {
  it('keeps a daily wall time as the clocks change, so the spans between occurrences flex', () => {
    expect(
      preview(cron('0 9 * * *', { timezone: 'Europe/London' }), {
        after: new Date('2026-03-27T12:00:00Z'),
        take: 3,
      }),
    ).toStrictEqual([
      new Date('2026-03-28T09:00:00Z'),
      new Date('2026-03-29T08:00:00Z'),
      new Date('2026-03-30T08:00:00Z'),
    ]);
  });

  it('shifts a wall time a spring forward gap swallows, without skipping the times behind it', () => {
    // New York jumps 02:00 to 03:00 on 2026-03-08: 02:30 is shifted onto 03:30, which is where the 03:30
    // occurrence already sits, so the hour reads once each rather than twice or not at all.
    expect(
      preview(cron('30 1,2,3 * * *', { timezone: 'America/New_York' }), {
        after: new Date('2026-03-08T06:00:00Z'),
        take: 3,
      }),
    ).toStrictEqual([
      new Date('2026-03-08T06:30:00Z'),
      new Date('2026-03-08T07:30:00Z'),
      new Date('2026-03-09T05:30:00Z'),
    ]);
  });

  it('fires a wall time a fall back repeats once, at its first occurrence', () => {
    // New York falls 02:00 back to 01:00 on 2026-11-01, so 01:30 happens twice; only the earlier fires.
    expect(
      preview(cron('30 1,2 * * *', { timezone: 'America/New_York' }), {
        after: new Date('2026-11-01T04:00:00Z'),
        take: 3,
      }),
    ).toStrictEqual([
      new Date('2026-11-01T05:30:00Z'),
      new Date('2026-11-01T07:30:00Z'),
      new Date('2026-11-02T06:30:00Z'),
    ]);
  });
});

/*****************************************************************************************************************/

describe('cron across spring forward gaps', () => {
  it('shifts a lone daily time the gap swallows, past the arithmetic reading of the day', () => {
    // London jumps 01:00 to 02:00 on 2026-03-29: an expression naming only 01:30 has nothing to compare its
    // offset against, so the occurrence is read back, disagrees, and the exact reading shifts it to 02:30 BST.
    expect(
      cron('30 1 * * *', { timezone: 'Europe/London' }).next(new Date('2026-03-28T12:00:00Z')),
    ).toStrictEqual(new Date('2026-03-29T01:30:00Z'));
  });

  it('keeps occurrences ordered and distinct through a half hour gap', () => {
    // Lord Howe jumps 02:00 to 02:30 on 2026-10-04, the case where a swallowed wall time resolves later than
    // the wall time following it: ordering the day's occurrences is what keeps 02:30 from being skipped.
    const occurrences = preview(cron('0,15,30 2 * * *', { timezone: 'Australia/Lord_Howe' }), {
      after: new Date('2026-10-03T14:00:00Z'),
      take: 3,
    });

    expect(occurrences).toStrictEqual([
      new Date('2026-10-03T15:30:00Z'),
      new Date('2026-10-03T15:45:00Z'),
      new Date('2026-10-04T15:00:00Z'),
    ]);
  });
});

/*****************************************************************************************************************/

describe('cron exhaustion', () => {
  it('exhausts on an expression no calendar can satisfy', () => {
    expect(cron('0 0 30 2 *').next(new Date('2026-01-01T00:00:00Z'))).toBeNull();
  });

  it('exhausts on a day of month no month of the year holds', () => {
    expect(cron('0 0 31 4 *').next(new Date('2026-01-01T00:00:00Z'))).toBeNull();
  });

  it('exhausts at the end of the range a Date can hold', () => {
    expect(cron('* * * * *').next(new Date(8_640_000_000_000_000 - 1))).toBeNull();
  });
});

/*****************************************************************************************************************/

describe('cron defensiveness', () => {
  it('refuses a malformed expression at construction, not at the first next()', () => {
    expect(() => cron('not a cron expression')).toThrow(RangeError);
  });

  it('refuses an unknown timezone at construction', () => {
    expect(() => cron('* * * * *', { timezone: 'Neverland/Second_Star' })).toThrow(RangeError);
  });

  it('refuses to advance from an invalid Date', () => {
    expect(() => cron('* * * * *').next(new Date(Number.NaN))).toThrow(RangeError);
  });

  it('computes the same occurrence from independent constructions', () => {
    const after = new Date('2026-06-01T09:17:43Z');

    expect(cron('*/5 * * * *').next(after)).toStrictEqual(cron('*/5 * * * *').next(after));
  });
});

/*****************************************************************************************************************/
