/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/schedules
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { dayNumberOf, HORIZON_IN_MILLISECONDS, wallDateOf } from './candidates';

import { MILLISECONDS_IN_DAY, MILLISECONDS_IN_MINUTE } from './constants';

import type { ParsedRecurrenceRule } from './recurrence';

import { withinLimits } from './recurrence-days';

import { instantOf, offsetInMilliseconds, type WallClock, wallClockOf } from './timezone';

/*****************************************************************************************************************/

// The path a rule below a day takes. A minutely or hourly rule steps in instants from its anchor rather than
// walking a calendar, so a daylight saving transition can neither repeat nor skip a step: an hourly rule stays
// an hour apart across one, where following the wall clock would leave it an hour short or an hour over. The
// parts such a rule writes narrow the steps rather than expanding them, save one: RFC 5545 has BYMINUTE expand
// an hourly rule, so an hourly rule naming two minutes fires twice an hour rather than once.
//
// The walk is by day rather than by step, because a rule narrowed to a rare day, the twenty ninth of February
// among them, can sit years of minutes away from the instant asked from. Days the date parts refuse cost no
// reading of the zone at all, since a day's month, day and weekday are arithmetic; only the days they accept
// have their steps read and measured.

/*****************************************************************************************************************/

// How many days the walk examines before calling a rule impossible, matching what the crontab schedule allows
// itself: a rule naming the twenty ninth of February waits four years for one, and eight when a century skips
// its own leap year, so ten years of days settles every rule the notation can express.
const SEARCH_LIMIT_IN_DAYS = 3653;

/*****************************************************************************************************************/

// The instant a day of the timezone's calendar begins on.
const startOfDay = (dayNumber: number, timezone: string): number => {
  const wall = wallDateOf(dayNumber);

  return instantOf({ ...wall, hour: 0, minute: 0 }, timezone).getTime();
};

/*****************************************************************************************************************/

// The parts of a rule that speak of the time of day, checked only for the steps a day the date parts accepted
// actually holds.
const withinTimes = (instant: number, rule: ParsedRecurrenceRule, timezone: string): boolean => {
  if (rule.hours === null && rule.minutes === null) {
    return true;
  }

  const clock = wallClockOf(new Date(instant), timezone);

  if (rule.hours !== null && !rule.hours.includes(clock.hour)) {
    return false;
  }

  return rule.minutes === null || rule.minutes.includes(clock.minute);
};

/*****************************************************************************************************************/

// The instants a step expands to: the minutes named within the step's own hour, placed at the offset the zone
// keeps at the step rather than resolved from the wall clock, so an hour a fall back repeats expands twice
// over, once at each offset, where the timezone core would read both as the first. Each is read back before
// it is trusted: a minute the zone skips at that offset, which only a transition inside the hour leaves, goes
// to the core after all and lands where RFC 5545 puts a wall time that does not exist.
const minutesWithin = (
  step: number,
  clock: WallClock,
  minutes: number[],
  timezone: string,
): number[] => {
  const offset = offsetInMilliseconds(step, timezone);

  const instants = minutes.map(minute => {
    const wall = { year: clock.year, month: clock.month, day: clock.day, hour: clock.hour, minute };

    const derived = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute) - offset;

    return offsetInMilliseconds(derived, timezone) === offset
      ? derived
      : instantOf(wall, timezone).getTime();
  });

  return [...new Set(instants)].toSorted((first, second) => first - second);
};

/*****************************************************************************************************************/

// The first occurrence of a day an hourly rule naming minutes holds. The day is gathered and ordered before
// one is chosen, because a minute a step expands to can sit earlier in the hour than the step it came from,
// so meeting the steps in order is not the same as meeting the occurrences in order. BYHOUR still narrows
// while BYMINUTE expands: a step outside the hours named yields nothing.
const expandedWithin = (
  after: number,
  rule: ParsedRecurrenceRule,
  minutes: number[],
  from: number,
  span: number,
  dayNumber: number,
  timezone: string,
): number | null => {
  const opening = startOfDay(dayNumber, timezone);

  const closing = startOfDay(dayNumber + 1, timezone);

  const found: number[] = [];

  for (
    let step = Math.max(Math.ceil((opening - from) / span), 0);
    from + step * span < closing;
    step += 1
  ) {
    const instant = from + step * span;

    const clock = wallClockOf(new Date(instant), timezone);

    if (rule.hours !== null && !rule.hours.includes(clock.hour)) {
      continue;
    }

    for (const occurrence of minutesWithin(instant, clock, minutes, timezone)) {
      if (occurrence > after && occurrence >= opening && occurrence < closing) {
        found.push(occurrence);
      }
    }
  }

  return found.toSorted((first, second) => first - second)[0] ?? null;
};

/*****************************************************************************************************************/

// The first step of a day that lies after the instant given, or null when the day holds none.
const stepWithin = (
  after: number,
  rule: ParsedRecurrenceRule,
  from: number,
  span: number,
  dayNumber: number,
  timezone: string,
): number | null => {
  const opening = Math.max(startOfDay(dayNumber, timezone), after + 1);

  const closing = startOfDay(dayNumber + 1, timezone);

  for (
    let step = Math.max(Math.ceil((opening - from) / span), 0);
    from + step * span < closing;
    step += 1
  ) {
    const instant = from + step * span;

    if (instant > after && withinTimes(instant, rule, timezone)) {
      return instant;
    }
  }

  return null;
};

/*****************************************************************************************************************/

// The first stepped instant after the one given, or null once the walk runs past the days it will examine or
// past the horizon, where the day after a candidate can no longer be resolved to close it.
export const nextByInstant = (
  after: number,
  rule: ParsedRecurrenceRule,
  from: number,
  timezone: string,
): number | null => {
  const span = (rule.frequency === 'minutely' ? 1 : 60) * rule.interval * MILLISECONDS_IN_MINUTE;

  const minutes = rule.frequency === 'hourly' ? rule.minutes : null;

  const opening = dayNumberOf(wallClockOf(new Date(Math.max(after, from)), timezone));

  for (let day = 0; day < SEARCH_LIMIT_IN_DAYS; day += 1) {
    const dayNumber = opening + day;

    if ((dayNumber + 1) * MILLISECONDS_IN_DAY > HORIZON_IN_MILLISECONDS) {
      return null;
    }

    if (!withinLimits(dayNumber, rule, wallDateOf(dayNumber))) {
      continue;
    }

    const instant =
      minutes === null
        ? stepWithin(after, rule, from, span, dayNumber, timezone)
        : expandedWithin(after, rule, minutes, from, span, dayNumber, timezone);

    if (instant !== null) {
      return instant;
    }
  }

  return null;
};

/*****************************************************************************************************************/
