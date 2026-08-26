/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/schedules
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { calendarSchedule, daily, monthly, weekly } from './candidates';

import type { Schedule } from './contract';

import { wallClockOf } from './timezone';

import type { WallTime, Weekday } from './timezone';

/*****************************************************************************************************************/

// The calendar units behind every(): days, weeks and months are wall clock cadences rather than fixed spans,
// because a day is not always twenty four hours across daylight saving and months differ in length. Occurrences
// land on a timezone's own calendar, aligned to the epoch's, and a month without the requested day is skipped,
// as cron and RFC 5545 both skip it, never clamped. Wall times resolve through the timezone core and inherit
// its daylight saving policies: a time a spring forward gap swallows lands the gap's span later, and a time a
// fall back repeats lands on its first occurrence.

/*****************************************************************************************************************/

export type CalendarDayOptions = {
  // The wall clock time of day each occurrence lands on; midnight when omitted.
  at?: WallTime;
  // The IANA timezone whose calendar and clock place the occurrences; UTC when omitted.
  timezone?: string;
};

/*****************************************************************************************************************/

export type CalendarWeekOptions = {
  // The day of the week each occurrence lands on; Monday when omitted.
  on?: Weekday;
  // The wall clock time of day each occurrence lands on; midnight when omitted.
  at?: WallTime;
  // The IANA timezone whose calendar and clock place the occurrences; UTC when omitted.
  timezone?: string;
};

/*****************************************************************************************************************/

export type CalendarMonthOptions = {
  // The day of the month each occurrence lands on, 1 through 31; the first when omitted. A month without the
  // day is skipped, never clamped.
  on?: number;
  // The wall clock time of day each occurrence lands on; midnight when omitted.
  at?: WallTime;
  // The IANA timezone whose calendar and clock place the occurrences; UTC when omitted.
  timezone?: string;
};

/*****************************************************************************************************************/

const WEEKDAY_NUMBERS: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

/*****************************************************************************************************************/

// Calendar units count whole days, weeks and months: the count must be a whole number the candidate arithmetic
// holds exactly, and at least one, or the walk would stand still or run backwards. Fractional counts belong to
// the clock units.
const validatedCount = (count: number): number => {
  if (!Number.isSafeInteger(count)) {
    throw new RangeError(
      'a calendar cadence requires a whole number count that a number counts exactly',
    );
  }

  if (count < 1) {
    throw new RangeError('a calendar cadence requires a count of at least one');
  }

  return count;
};

/*****************************************************************************************************************/

const validatedWallTime = (at: WallTime): WallTime => {
  if (!Number.isInteger(at.hour) || at.hour < 0 || at.hour > 23) {
    throw new RangeError('a wall clock hour must be a whole number from 0 through 23');
  }

  if (!Number.isInteger(at.minute) || at.minute < 0 || at.minute > 59) {
    throw new RangeError('a wall clock minute must be a whole number from 0 through 59');
  }

  return at;
};

/*****************************************************************************************************************/

// Probing the zone at the epoch surfaces an unknown timezone as a loud RangeError at construction rather than
// at the first next().
const validatedTimezone = (timezone: string): string => {
  wallClockOf(new Date(0), timezone);

  return timezone;
};

/*****************************************************************************************************************/

const validatedMonthDay = (on: number): number => {
  if (!Number.isInteger(on) || on < 1 || on > 31) {
    throw new RangeError('a month day must be a whole number from 1 through 31');
  }

  return on;
};

/*****************************************************************************************************************/

const weekdayNumberOf = (on: Weekday): number => {
  const weekday = WEEKDAY_NUMBERS[on];

  if (weekday === undefined) {
    throw new RangeError(`unrecognised weekday "${on}"`);
  }

  return weekday;
};

/*****************************************************************************************************************/

// Every count days on a timezone's calendar. Reached through every(count).days(options).
export const calendarDays = (count: number, options: CalendarDayOptions = {}): Schedule => {
  const cadence = validatedCount(count);

  const at = validatedWallTime(options.at ?? { hour: 0, minute: 0 });

  const timezone = validatedTimezone(options.timezone ?? 'UTC');

  return calendarSchedule(daily(cadence), at, timezone);
};

/*****************************************************************************************************************/

// Every count weeks on a weekday of a timezone's calendar. Reached through every(count).weeks(options).
export const calendarWeeks = (count: number, options: CalendarWeekOptions = {}): Schedule => {
  const cadence = validatedCount(count);

  const weekday = weekdayNumberOf(options.on ?? 'monday');

  const at = validatedWallTime(options.at ?? { hour: 0, minute: 0 });

  const timezone = validatedTimezone(options.timezone ?? 'UTC');

  return calendarSchedule(weekly(cadence, weekday), at, timezone);
};

/*****************************************************************************************************************/

// Every count months on a day of a timezone's calendar. Reached through every(count).months(options).
export const calendarMonths = (count: number, options: CalendarMonthOptions = {}): Schedule => {
  const cadence = validatedCount(count);

  const on = validatedMonthDay(options.on ?? 1);

  const at = validatedWallTime(options.at ?? { hour: 0, minute: 0 });

  const timezone = validatedTimezone(options.timezone ?? 'UTC');

  return calendarSchedule(monthly(cadence, on), at, timezone);
};

/*****************************************************************************************************************/
