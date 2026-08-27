/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { every } from '../src/index';

import { wallClockOf } from '../src/schedules/timezone';

/*****************************************************************************************************************/

// The systematic sweep behind the hand picked cases: hundreds of consecutive occurrences walked across
// timezones of every flavour, on the runtime's own IANA data, asserting the invariants that must hold
// everywhere without knowing any zone's transitions in advance: occurrences advance strictly, resolve purely,
// stay bounded in spacing, and read the requested wall time exactly, or later by at most the two hours a
// spring forward gap can swallow.

/*****************************************************************************************************************/

// Whole hour and fractional offsets, northern and southern daylight saving, half hour daylight saving shifts,
// zones without daylight saving at all, both sides of the date line, and Dublin's negative winter saving.
const TIMEZONES = [
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Dublin',
  'America/New_York',
  'America/St_Johns',
  'America/Sao_Paulo',
  'Asia/Tokyo',
  'Asia/Kolkata',
  'Asia/Kathmandu',
  'Australia/Sydney',
  'Australia/Adelaide',
  'Australia/Lord_Howe',
  'Pacific/Auckland',
  'Pacific/Chatham',
  'Pacific/Kiritimati',
  'Pacific/Apia',
];

/*****************************************************************************************************************/

// Half past two in the morning sits inside almost every real spring forward gap, so it is the wall time that
// stresses the daylight saving policies hardest. As minutes into the day: exact is 150, and a gap of up to two
// hours reads no later than 270.
const REQUESTED = { hour: 2, minute: 30 };

const EXACT_READING = 150;

const LATEST_SHIFTED_READING = 270;

/*****************************************************************************************************************/

// The sweeps walk far from the end of time, so exhaustion is a failed invariant, thrown from outside the test
// bodies to keep them free of conditionals.
const resolved = (occurrence: Date | null): Date => {
  if (occurrence === null) {
    throw new Error('the sweep expected an occurrence, not exhaustion');
  }

  return occurrence;
};

/*****************************************************************************************************************/

describe('a year of daily occurrences in every flavour of timezone', () => {
  it.each(TIMEZONES)('holds the daily invariants across %s', timezone => {
    const schedule = every(1).days({ at: REQUESTED, timezone });

    let cursor = new Date('2026-01-01T00:00:00Z');

    for (let step = 0; step < 370; step += 1) {
      const occurrence = resolved(schedule.next(cursor));

      expect(schedule.next(cursor)).toStrictEqual(occurrence);

      expect(occurrence.getTime()).toBeGreaterThan(cursor.getTime());

      expect(occurrence.getTime() - cursor.getTime()).toBeLessThanOrEqual(172_800_000);

      const wall = wallClockOf(occurrence, timezone);

      const reading = wall.hour * 60 + wall.minute;

      expect(reading).toBeGreaterThanOrEqual(EXACT_READING);

      expect(reading).toBeLessThanOrEqual(LATEST_SHIFTED_READING);

      expect(wall.second).toBe(0);

      cursor = occurrence;
    }
  });
});

/*****************************************************************************************************************/

describe('sixty weeks of Sunday occurrences in every flavour of timezone', () => {
  it.each(TIMEZONES)('holds the weekly invariants across %s', timezone => {
    const schedule = every(1).weeks({ on: 'sunday', at: REQUESTED, timezone });

    let cursor = new Date('2026-01-01T00:00:00Z');

    for (let step = 0; step < 60; step += 1) {
      const occurrence = resolved(schedule.next(cursor));

      expect(occurrence.getTime()).toBeGreaterThan(cursor.getTime());

      expect(occurrence.getTime() - cursor.getTime()).toBeLessThanOrEqual(8 * 86_400_000);

      const wall = wallClockOf(occurrence, timezone);

      expect(wall.weekday).toBe(7);

      const reading = wall.hour * 60 + wall.minute;

      expect(reading).toBeGreaterThanOrEqual(EXACT_READING);

      expect(reading).toBeLessThanOrEqual(LATEST_SHIFTED_READING);

      cursor = occurrence;
    }
  });
});

/*****************************************************************************************************************/

describe('two years of month ends in every flavour of timezone', () => {
  it.each(TIMEZONES)('holds the monthly invariants across %s', timezone => {
    const schedule = every(1).months({ on: 31, at: REQUESTED, timezone });

    let cursor = new Date('2026-01-01T00:00:00Z');

    for (let step = 0; step < 14; step += 1) {
      const occurrence = resolved(schedule.next(cursor));

      expect(occurrence.getTime()).toBeGreaterThan(cursor.getTime());

      const wall = wallClockOf(occurrence, timezone);

      expect(wall.day).toBe(31);

      const reading = wall.hour * 60 + wall.minute;

      expect(reading).toBeGreaterThanOrEqual(EXACT_READING);

      expect(reading).toBeLessThanOrEqual(LATEST_SHIFTED_READING);

      cursor = occurrence;
    }
  });
});

/*****************************************************************************************************************/
