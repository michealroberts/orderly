/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/schedules
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { MAXIMUM_INSTANT_IN_MILLISECONDS, MILLISECONDS_IN_DAY } from './constants';

import type { Schedule } from './contract';

import { instantOf, wallClockOf } from './timezone';

import type { WallTime } from './timezone';

/*****************************************************************************************************************/

// The engine under the calendar units: each unit proposes candidate days on the timezone's calendar, and the
// shared walk resolves them to instants through the timezone core until one lies strictly after the instant
// asked from. Day numbering is the epoch's: day zero is 1970-01-01, week zero is the Monday week holding it,
// month zero is January 1970.

/*****************************************************************************************************************/

// Resolving a wall time probes offsets a day either side of its UTC reading, so a reading past this horizon
// cannot be resolved and is exhaustion instead. The horizon is met by the reading with its time of day
// included: a later wall time exhausts up to a day of representable instants sooner, surrendered deliberately
// at the end of the year 275760 rather than resolved by a separate edge strategy.
const HORIZON_IN_MILLISECONDS = MAXIMUM_INSTANT_IN_MILLISECONDS - MILLISECONDS_IN_DAY;

/*****************************************************************************************************************/

// Remainders the Euclidean way, never negative, so indices before the epoch stay aligned to the same series.
const modulo = (value: number, divisor: number): number => ((value % divisor) + divisor) % divisor;

/*****************************************************************************************************************/

type WallDate = { year: number; month: number; day: number };

// Days since 1970-01-01 on the calendar the wall date belongs to; exact, because every UTC day is a whole
// number of milliseconds.
const dayNumberOf = (wall: WallDate): number => {
  return Date.UTC(wall.year, wall.month - 1, wall.day) / MILLISECONDS_IN_DAY;
};

const wallDateOf = (dayNumber: number): WallDate => {
  const date = new Date(dayNumber * MILLISECONDS_IN_DAY);

  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
};

const daysInMonth = (year: number, month: number): number => {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

/*****************************************************************************************************************/

const weekNumberOf = (dayNumber: number): number => Math.floor((dayNumber + 3) / 7);

const monthNumberOf = (dayNumber: number): number => {
  const wall = wallDateOf(dayNumber);

  return (wall.year - 1970) * 12 + (wall.month - 1);
};

const firstInstantOfMonth = (monthNumber: number): number => {
  return Date.UTC(1970 + Math.floor(monthNumber / 12), modulo(monthNumber, 12), 1);
};

/*****************************************************************************************************************/

// How each unit proposes candidate days: the first eligible day on or after a day, and the eligible day after
// a candidate. null means no eligible day remains within the horizon.
export type Candidates = {
  onOrAfter: (dayNumber: number) => number | null;
  after: (dayNumber: number) => number | null;
};

/*****************************************************************************************************************/

// A day is eligible when its number divides by the count.
export const daily = (count: number): Candidates => ({
  onOrAfter: dayNumber => dayNumber + modulo(-dayNumber, count),
  after: candidate => candidate + count,
});

/*****************************************************************************************************************/

// A week is eligible when its number divides by the count, and the candidate is that week's requested weekday,
// numbered 1 through 7 with Monday first; a weekday already passed advances to the next eligible week.
export const weekly = (count: number, weekday: number): Candidates => {
  const candidateOf = (weekNumber: number): number => weekNumber * 7 - 3 + (weekday - 1);

  return {
    onOrAfter: dayNumber => {
      const weekNumber = weekNumberOf(dayNumber);

      const aligned = weekNumber + modulo(-weekNumber, count);

      const candidate = candidateOf(aligned);

      return candidate >= dayNumber ? candidate : candidateOf(aligned + count);
    },
    after: candidate => candidateOf(weekNumberOf(candidate) + count),
  };
};

/*****************************************************************************************************************/

// A month is eligible when its number divides by the count and it holds the requested day; one without it is
// skipped, and a day already passed advances to the next eligible month. The search ends at the horizon, so a
// day no eligible month ever holds exhausts rather than looping forever.
export const monthly = (count: number, on: number): Candidates => {
  const fromMonthNumber = (start: number): number | null => {
    let monthNumber = start;

    let first = firstInstantOfMonth(monthNumber);

    while (!Number.isNaN(first) && first <= HORIZON_IN_MILLISECONDS) {
      const year = 1970 + Math.floor(monthNumber / 12);

      const month = modulo(monthNumber, 12) + 1;

      if (on <= daysInMonth(year, month)) {
        return dayNumberOf({ year, month, day: on });
      }

      monthNumber += count;

      first = firstInstantOfMonth(monthNumber);
    }

    return null;
  };

  return {
    onOrAfter: dayNumber => {
      const monthNumber = monthNumberOf(dayNumber);

      const candidate = fromMonthNumber(monthNumber + modulo(-monthNumber, count));

      if (candidate === null || candidate >= dayNumber) {
        return candidate;
      }

      return fromMonthNumber(monthNumberOf(candidate) + count);
    },
    after: candidate => fromMonthNumber(monthNumberOf(candidate) + count),
  };
};

/*****************************************************************************************************************/

// The instant a candidate day's wall time resolves to, or null once the day sits past the horizon.
const occurrenceOf = (dayNumber: number, at: WallTime, timezone: string): Date | null => {
  const wall = wallDateOf(dayNumber);

  const guess = Date.UTC(wall.year, wall.month - 1, wall.day, at.hour, at.minute);

  if (Number.isNaN(guess) || guess > HORIZON_IN_MILLISECONDS) {
    return null;
  }

  return instantOf(
    { year: wall.year, month: wall.month, day: wall.day, hour: at.hour, minute: at.minute },
    timezone,
  );
};

/*****************************************************************************************************************/

// The shared walk: from the wall date of the instant given, propose candidate days and return the first whose
// resolved instant lies strictly after it. Candidates advance strictly, so the walk always terminates at an
// occurrence or the horizon.
export const calendarSchedule = (
  candidates: Candidates,
  at: WallTime,
  timezone: string,
): Schedule => ({
  next: after => {
    if (Number.isNaN(after.getTime())) {
      throw new RangeError('a calendar schedule requires a valid Date to advance from');
    }

    let candidate = candidates.onOrAfter(dayNumberOf(wallClockOf(after, timezone)));

    while (candidate !== null) {
      const occurrence = occurrenceOf(candidate, at, timezone);

      if (occurrence === null) {
        return null;
      }

      if (occurrence.getTime() > after.getTime()) {
        return occurrence;
      }

      candidate = candidates.after(candidate);
    }

    return null;
  },
});

/*****************************************************************************************************************/
