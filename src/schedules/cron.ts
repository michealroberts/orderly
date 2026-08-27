/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/schedules
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import {
  dayNumberOf,
  HORIZON_IN_MILLISECONDS,
  modulo,
  type WallDate,
  wallDateOf,
} from './candidates';

import type { Schedule } from './contract';

import { type ParsedCron, parseCron } from './crontab';

import { instantOf, wallClockOf } from './timezone';

/*****************************************************************************************************************/

// A crontab expression as a schedule. Two rules are decided here. Days follow classic cron: when both day
// fields are written, a day matches when either matches, so 0 0 13 * FRI means every thirteenth and every
// Friday, not only Friday the thirteenth; when one is written, only that one speaks. Times of day resolve
// through the timezone core, so a cron in a zone inherits its daylight saving policies, and a day's
// occurrences are gathered and ordered before one is chosen, because a wall time a spring forward gap swallows
// can otherwise resolve later than the wall time following it.

/*****************************************************************************************************************/

export type CronOptions = {
  // The IANA timezone the expression's wall times are read in; UTC when omitted, as Cloudflare's own cron
  // triggers read them.
  timezone?: string;
};

/*****************************************************************************************************************/

// Day numbering runs from 1970-01-01, a Thursday, which is 4 counting from Monday.
const weekdayOf = (dayNumber: number): number => modulo(dayNumber + 3, 7) + 1;

/*****************************************************************************************************************/

// How far the search for a matching day runs before calling the expression impossible. February the twenty
// ninth is the widest real gap, and a century that skips its leap year stretches that gap to eight years, so
// ten years of days settles every expression the notation can express.
const SEARCH_LIMIT_IN_DAYS = 3653;

/*****************************************************************************************************************/

// Classic cron's day rule: the month must match, and then the two day fields speak together only when both
// were written, in which case either matching is enough.
const matchesDay = (dayNumber: number, parsed: ParsedCron): boolean => {
  const wall = wallDateOf(dayNumber);

  if (!parsed.months.includes(wall.month)) {
    return false;
  }

  const dayOfMonthMatches = parsed.daysOfMonth.includes(wall.day);

  const dayOfWeekMatches = parsed.daysOfWeek.includes(weekdayOf(dayNumber));

  if (parsed.daysOfMonthRestricted && parsed.daysOfWeekRestricted) {
    return dayOfMonthMatches || dayOfWeekMatches;
  }

  if (parsed.daysOfMonthRestricted) {
    return dayOfMonthMatches;
  }

  if (parsed.daysOfWeekRestricted) {
    return dayOfWeekMatches;
  }

  return true;
};

/*****************************************************************************************************************/

// Every time of day the expression names, as minutes from midnight, ascending.
const minutesOfDayOf = (parsed: ParsedCron): number[] => {
  const minutes: number[] = [];

  for (const hour of parsed.hours) {
    for (const minute of parsed.minutes) {
      minutes.push(hour * 60 + minute);
    }
  }

  return minutes.toSorted((first, second) => first - second);
};

/*****************************************************************************************************************/

// The instant one of a day's wall times resolves to, or null once that reading sits past the horizon.
const resolve = (wall: WallDate, minuteOfDay: number, timezone: string): number | null => {
  const hour = Math.floor(minuteOfDay / 60);

  const minute = minuteOfDay % 60;

  if (Date.UTC(wall.year, wall.month - 1, wall.day, hour, minute) > HORIZON_IN_MILLISECONDS) {
    return null;
  }

  return instantOf(
    { year: wall.year, month: wall.month, day: wall.day, hour, minute },
    timezone,
  ).getTime();
};

/*****************************************************************************************************************/

// The exact reading of a day: every time the expression names resolved, ordered and deduplicated, then the
// first occurrence ahead of the instant given. Ordering matters because resolution is not monotonic across a
// spring forward gap, where a swallowed wall time is shifted past the wall time following it, and two wall
// times can land on the same instant. Sorting means the walk chooses the earliest occurrence still ahead of
// it, and never skips one by meeting a shifted neighbour first.
const exactlyOn = (
  wall: WallDate,
  minutesOfDay: number[],
  timezone: string,
  after: number,
): number | null => {
  const instants = new Set<number>();

  for (const minuteOfDay of minutesOfDay) {
    const instant = resolve(wall, minuteOfDay, timezone);

    if (instant !== null) {
      instants.add(instant);
    }
  }

  return (
    [...instants]
      .toSorted((first, second) => first - second)
      .find(candidate => candidate > after) ?? null
  );
};

/*****************************************************************************************************************/

// The zone's offset across the times a day names, or null when it moves between the first and the last of
// them. Sampling the two ends is enough because a day whose offset holds across them holds across everything
// between: a zone changing twice within that span and returning to where it started would defeat the sample,
// which nothing in the IANA data does, and the reading is checked before it is trusted regardless.
const constantOffsetOf = (
  wall: WallDate,
  minutesOfDay: number[],
  timezone: string,
): number | null => {
  const first = minutesOfDay[0];

  const last = minutesOfDay.at(-1);

  if (first === undefined || last === undefined) {
    return null;
  }

  const firstInstant = resolve(wall, first, timezone);

  const lastInstant = resolve(wall, last, timezone);

  if (firstInstant === null || lastInstant === null) {
    return null;
  }

  const midnight = Date.UTC(wall.year, wall.month - 1, wall.day);

  const offset = midnight + first * 60_000 - firstInstant;

  return midnight + last * 60_000 - lastInstant === offset ? offset : null;
};

/*****************************************************************************************************************/

// The first occurrence on a day after the instant given. A day whose offset holds across the times it names
// maps them to instants by arithmetic alone, which is the ordinary day and costs two readings of the zone
// however many times the expression names; the occurrence is read back before it is returned, and anything
// else, a transition day above all, falls to the exact reading.
const nextOn = (
  dayNumber: number,
  minutesOfDay: number[],
  timezone: string,
  after: number,
): number | null => {
  const wall = wallDateOf(dayNumber);

  const offset = constantOffsetOf(wall, minutesOfDay, timezone);

  if (offset !== null) {
    const midnight = Date.UTC(wall.year, wall.month - 1, wall.day);

    const minuteOfDay = minutesOfDay.find(
      candidate => midnight + candidate * 60_000 - offset > after,
    );

    if (minuteOfDay === undefined) {
      return null;
    }

    const instant = midnight + minuteOfDay * 60_000 - offset;

    const reading = wallClockOf(new Date(instant), timezone);

    if (reading.hour * 60 + reading.minute === minuteOfDay) {
      return instant;
    }
  }

  return exactlyOn(wall, minutesOfDay, timezone, after);
};

/*****************************************************************************************************************/

// Probing the zone at the epoch surfaces an unknown timezone as a loud RangeError at construction rather than
// at the first next().
const validatedTimezone = (timezone: string): string => {
  wallClockOf(new Date(0), timezone);

  return timezone;
};

/*****************************************************************************************************************/

// A schedule from a crontab expression, read in a timezone. Reached through cron(expression, options).
export const cron = (expression: string, options: CronOptions = {}): Schedule => {
  const parsed = parseCron(expression);

  const timezone = validatedTimezone(options.timezone ?? 'UTC');

  const minutesOfDay = minutesOfDayOf(parsed);

  return {
    next: after => {
      const instant = after.getTime();

      if (Number.isNaN(instant)) {
        throw new RangeError('a cron schedule requires a valid Date to advance from');
      }

      // The walk starts on the day the instant falls on in the zone, because that day may still hold
      // occurrences ahead of it, and runs day by day from there.
      const first = dayNumberOf(wallClockOf(after, timezone));

      for (let step = 0; step < SEARCH_LIMIT_IN_DAYS; step += 1) {
        const dayNumber = first + step;

        if (dayNumber * 86_400_000 > HORIZON_IN_MILLISECONDS) {
          return null;
        }

        if (matchesDay(dayNumber, parsed)) {
          const occurrence = nextOn(dayNumber, minutesOfDay, timezone, instant);

          if (occurrence !== null) {
            return new Date(occurrence);
          }
        }
      }

      return null;
    },
  };
};

/*****************************************************************************************************************/
