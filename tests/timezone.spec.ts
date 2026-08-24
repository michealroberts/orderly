/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { instantOf, wallClockOf } from '../src/schedules/timezone';

/*****************************************************************************************************************/

describe('wallClockOf', () => {
  it.each([
    ['UTC', '2026-01-15T12:00:00Z', { hour: 12, minute: 0 }],
    ['Europe/London', '2026-01-15T12:00:00Z', { hour: 12, minute: 0 }],
    ['Europe/London', '2026-07-15T12:00:00Z', { hour: 13, minute: 0 }],
    ['America/New_York', '2026-01-15T12:00:00Z', { hour: 7, minute: 0 }],
    ['Asia/Tokyo', '2026-01-15T12:00:00Z', { hour: 21, minute: 0 }],
    ['Australia/Lord_Howe', '2026-01-15T12:00:00Z', { hour: 23, minute: 0 }],
    ['Australia/Lord_Howe', '2026-07-15T12:00:00Z', { hour: 22, minute: 30 }],
  ])('reads the clock in %s at %s as %o', (timezone, instant, expected) => {
    expect(wallClockOf(new Date(instant), timezone)).toMatchObject(expected);
  });

  it('reads the whole clock face, weekday included, with Monday first', () => {
    expect(wallClockOf(new Date('2026-01-15T12:30:45Z'), 'UTC')).toStrictEqual({
      year: 2026,
      month: 1,
      day: 15,
      hour: 12,
      minute: 30,
      second: 45,
      weekday: 4,
    });
  });

  it('crosses the date line: late in Greenwich is tomorrow in Tokyo', () => {
    expect(wallClockOf(new Date('2026-12-31T23:00:00Z'), 'Asia/Tokyo')).toMatchObject({
      year: 2027,
      month: 1,
      day: 1,
      hour: 8,
    });
  });

  it('reads midnight as hour zero, never twenty four', () => {
    expect(wallClockOf(new Date('2026-01-15T00:00:00Z'), 'UTC').hour).toBe(0);
  });
});

/*****************************************************************************************************************/

describe('instantOf', () => {
  it.each([
    ['UTC', { year: 2026, month: 1, day: 15, hour: 12, minute: 0 }, '2026-01-15T12:00:00Z'],
    [
      'Europe/London',
      { year: 2026, month: 7, day: 15, hour: 13, minute: 0 },
      '2026-07-15T12:00:00Z',
    ],
    [
      'America/New_York',
      { year: 2026, month: 1, day: 15, hour: 7, minute: 0 },
      '2026-01-15T12:00:00Z',
    ],
    ['Asia/Tokyo', { year: 2026, month: 1, day: 15, hour: 21, minute: 0 }, '2026-01-15T12:00:00Z'],
    [
      'Australia/Lord_Howe',
      { year: 2026, month: 7, day: 15, hour: 22, minute: 30 },
      '2026-07-15T12:00:00Z',
    ],
  ])('resolves a wall time in %s to the instant it reads', (timezone, wall, expected) => {
    expect(instantOf(wall, timezone)).toStrictEqual(new Date(expected));
  });

  it('round trips with wallClockOf away from transitions', () => {
    const wall = { year: 2026, month: 5, day: 20, hour: 9, minute: 30, second: 15 };

    const instant = instantOf(wall, 'America/New_York');

    expect(wallClockOf(instant, 'America/New_York')).toMatchObject(wall);
  });

  it('defaults seconds to zero', () => {
    expect(instantOf({ year: 2026, month: 1, day: 15, hour: 12, minute: 0 }, 'UTC')).toStrictEqual(
      new Date('2026-01-15T12:00:00.000Z'),
    );
  });
});

/*****************************************************************************************************************/

describe('instantOf across spring forward gaps', () => {
  it('shifts a New York wall time inside the gap forward by the hour the gap spans', () => {
    // Clocks jump 02:00 to 03:00 on 2026-03-08, so 02:30 never happens; it resolves to 03:30 EDT.
    expect(
      instantOf({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, 'America/New_York'),
    ).toStrictEqual(new Date('2026-03-08T07:30:00Z'));
  });

  it('shifts a London wall time inside the gap forward likewise', () => {
    // Clocks jump 01:00 to 02:00 on 2026-03-29, so 01:30 resolves to 02:30 BST.
    expect(
      instantOf({ year: 2026, month: 3, day: 29, hour: 1, minute: 30 }, 'Europe/London'),
    ).toStrictEqual(new Date('2026-03-29T01:30:00Z'));
  });

  it('shifts a Lord Howe wall time forward by its half hour gap', () => {
    // Clocks jump 02:00 to 02:30 on 2026-10-04, so 02:15 resolves to 02:45 at +11.
    expect(
      instantOf({ year: 2026, month: 10, day: 4, hour: 2, minute: 15 }, 'Australia/Lord_Howe'),
    ).toStrictEqual(new Date('2026-10-03T15:45:00Z'));
  });
});

/*****************************************************************************************************************/

describe('instantOf across fall back overlaps', () => {
  it('resolves a repeated New York wall time to its first occurrence', () => {
    // Clocks fall 02:00 back to 01:00 on 2026-11-01, so 01:30 happens twice; the earlier is EDT.
    expect(
      instantOf({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, 'America/New_York'),
    ).toStrictEqual(new Date('2026-11-01T05:30:00Z'));
  });

  it('resolves a repeated London wall time to its first occurrence', () => {
    // Clocks fall 02:00 back to 01:00 on 2026-10-25, so 01:30 happens twice; the earlier is BST.
    expect(
      instantOf({ year: 2026, month: 10, day: 25, hour: 1, minute: 30 }, 'Europe/London'),
    ).toStrictEqual(new Date('2026-10-25T00:30:00Z'));
  });
});

/*****************************************************************************************************************/

describe('timezone defensiveness', () => {
  it('refuses an unknown timezone loudly', () => {
    expect(() => wallClockOf(new Date(0), 'Neverland/Second_Star')).toThrow(RangeError);

    expect(() =>
      instantOf({ year: 2026, month: 1, day: 1, hour: 0, minute: 0 }, 'Neverland/Second_Star'),
    ).toThrow(RangeError);
  });
});

/*****************************************************************************************************************/
