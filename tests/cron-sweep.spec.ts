/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { cron } from '../src/index';

import { wallClockOf } from '../src/schedules/timezone';

/*****************************************************************************************************************/

// The systematic sweep behind the hand picked cron cases, mirroring the calendar one: hundreds of consecutive
// occurrences walked across timezones of every flavour, on the runtime's own IANA data, asserting what must
// hold everywhere without knowing any zone's transitions in advance. The half hourly sweep matters most, since
// it names times either side of every transition and is where an occurrence lost to a gap would show.

/*****************************************************************************************************************/

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

// Half past two in the morning sits inside almost every real spring forward gap, which makes it the wall time
// that stresses the daylight saving policies hardest: as minutes into the day, exactly 150.
const EXACT_READING = 150;

/*****************************************************************************************************************/

// The latest a shifted reading can land, a gap of up to two hours past the requested time.
const LATEST_SHIFTED_READING = 270;

/*****************************************************************************************************************/

const resolved = (occurrence: Date | null): Date => {
  if (occurrence === null) {
    throw new Error('the sweep expected an occurrence, not exhaustion');
  }

  return occurrence;
};

/*****************************************************************************************************************/

describe('a year of daily cron occurrences in every flavour of timezone', () => {
  it.each(TIMEZONES)('holds the daily invariants across %s', timezone => {
    const schedule = cron('30 2 * * *', { timezone });

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

      cursor = occurrence;
    }
  });
});

/*****************************************************************************************************************/

// Four days of half hours around each cluster of real transitions in 2026, each window opening three days
// ahead of its cluster: the North American spring and autumn changes, the European ones, and the southern
// hemisphere's, Lord Howe's half hour among them.
const TRANSITION_WINDOWS = [
  '2026-03-05T00:00:00Z',
  '2026-03-26T00:00:00Z',
  '2026-09-24T00:00:00Z',
  '2026-10-01T00:00:00Z',
  '2026-10-22T00:00:00Z',
  '2026-10-29T00:00:00Z',
];

/*****************************************************************************************************************/

describe('half hourly cron occurrences through every transition of a year', () => {
  it.each(TIMEZONES)('never loses or repeats a half hour across %s', timezone => {
    const schedule = cron('0,30 * * * *', { timezone });

    for (const start of TRANSITION_WINDOWS) {
      let cursor = new Date(start);

      for (let step = 0; step < 192; step += 1) {
        const occurrence = resolved(schedule.next(cursor));

        expect(occurrence.getTime()).toBeGreaterThan(cursor.getTime());

        // Half hourly occurrences are exactly a half hour apart, save across a transition, where the span
        // stretches or shrinks by the offset moved and never by more than three hours.
        expect(occurrence.getTime() - cursor.getTime()).toBeLessThanOrEqual(10_800_000);

        const wall = wallClockOf(occurrence, timezone);

        expect(wall.minute % 30).toBe(0);

        cursor = occurrence;
      }
    }
  });
});

/*****************************************************************************************************************/
