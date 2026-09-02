/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/schedules
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { dayNumberOf, HORIZON_IN_MILLISECONDS, modulo, weekdayOf } from './candidates';

import { MILLISECONDS_IN_DAY } from './constants';

import type { Schedule } from './contract';

import { nextOn } from './cron';

import { type ParsedRecurrenceRule, parseRecurrenceRule } from './recurrence';

import {
  type CalendarFrequency,
  daysOfPeriod,
  periodOfDay,
  type RecurrenceAnchor,
} from './recurrence-days';

import { nextByInstant } from './recurrence-steps';

import { validated } from './recurrence-validation';

import { wallClockOf } from './timezone';

/*****************************************************************************************************************/

// A recurrence rule as a schedule. Every rule counts from an anchor, the role DTSTART plays in RFC 5545: the
// parts the rule leaves unwritten take their values from it, its periods are counted from the one it falls in,
// and nothing before it ever fires. The anchor is the Unix epoch unless one is given, which keeps recurrence
// aligned the way every other constructor here is. A frequency of a day or longer walks the timezone's
// calendar and inherits its daylight saving policies; the two below a day step in instants instead, so an
// hourly rule stays hourly across a transition rather than repeating or skipping an hour of wall clock.

/*****************************************************************************************************************/

export type RecurrenceRuleOptions = {
  // The instant the rule counts from, the role DTSTART plays in the notation; the Unix epoch when omitted. It
  // is read down to the whole minute it falls in, since the notation names no seconds.
  from?: Date;
  // The IANA timezone the rule's days and wall times are read in; UTC when omitted.
  timezone?: string;
};

/*****************************************************************************************************************/

// How far the walk looks before calling a rule impossible, as days rather than periods: a rule narrowed to
// the twenty ninth of February waits four years for one, and eight when a century skips its own leap year, so
// ten years of days settles every rule the notation can express. Counting in days rather than periods matters
// because a period of one day needs thousands of them to cover that span where a period of a year needs ten.
const SEARCH_SPAN_IN_DAYS = 3653;

/*****************************************************************************************************************/

// Roughly how many days one period of a frequency spans, taken short rather than long so the walk always
// examines at least as many periods as the span asks for.
const PERIOD_IN_DAYS: Record<CalendarFrequency, number> = {
  daily: 1,
  weekly: 7,
  monthly: 28,
  yearly: 365,
};

/*****************************************************************************************************************/

// The fewest periods the walk examines however much calendar each one spans. A cadence of a thousand days
// crosses ten years in four turns, far too few for the months and days it names to come round, so a sparse
// rule is given turns of its own cadence rather than time alone: the two conditions answer different ways a
// rule can be rare, and the walk honours whichever asks for more.
const SEARCH_MINIMUM_IN_PERIODS = 800;

/*****************************************************************************************************************/

// How many periods a rule is walked before it is called impossible: enough to span the calendar a rule
// narrowed to a rare day needs, and enough turns for a sparse cadence to bring its narrowing parts round.
const searchLimitOf = (frequency: CalendarFrequency, interval: number): number => {
  const spanning = Math.ceil(SEARCH_SPAN_IN_DAYS / (PERIOD_IN_DAYS[frequency] * interval));

  return Math.max(spanning, SEARCH_MINIMUM_IN_PERIODS);
};

/*****************************************************************************************************************/

// The frequency as one whose periods are whole days, or null for the two that step in instants instead.
const calendarFrequencyOf = (rule: ParsedRecurrenceRule): CalendarFrequency | null => {
  switch (rule.frequency) {
    case 'daily':
    case 'weekly':
    case 'monthly':
    case 'yearly': {
      return rule.frequency;
    }

    default: {
      return null;
    }
  }
};

/*****************************************************************************************************************/

// The anchor read as the calendar reads it, every unwritten part of the rule taking its value from here. It
// is read down to the whole minute it falls in, because the notation this module honours names no seconds:
// carrying them would put the anchor a moment after the occurrence it stands for, and a rule would then step
// over its own first occurrence rather than firing it.
const anchorOf = (from: Date, timezone: string): RecurrenceAnchor => {
  if (Number.isNaN(from.getTime())) {
    throw new RangeError('a recurrence rule requires a valid Date to count from');
  }

  const clock = wallClockOf(from, timezone);

  const wall = { year: clock.year, month: clock.month, day: clock.day };

  const dayNumber = dayNumberOf(wall);

  return {
    instant: from.getTime() - (clock.second * 1000 + modulo(from.getTime(), 1000)),
    dayNumber,
    weekday: weekdayOf(dayNumber),
    wall,
    minuteOfDay: clock.hour * 60 + clock.minute,
  };
};

/*****************************************************************************************************************/

// The times of day a rule names, as minutes from midnight: the hours and minutes it wrote, crossed, and the
// anchor's own time of day wherever it wrote neither.
const minutesOfDayOf = (rule: ParsedRecurrenceRule, anchor: RecurrenceAnchor): number[] => {
  const hours = rule.hours ?? [Math.floor(anchor.minuteOfDay / 60)];

  const minutes = rule.minutes ?? [anchor.minuteOfDay % 60];

  const times = hours.flatMap(hour => minutes.map(minute => hour * 60 + minute));

  return [...new Set(times)].toSorted((first, second) => first - second);
};

/*****************************************************************************************************************/

// A frequency of a day or longer, walked on the timezone's calendar: each period proposes the days it names,
// and each day resolves its times of day through the timezone core.
const nextByCalendar = (
  after: number,
  frequency: CalendarFrequency,
  rule: ParsedRecurrenceRule,
  anchor: RecurrenceAnchor,
  minutesOfDay: number[],
  timezone: string,
): number | null => {
  const reached = dayNumberOf(wallClockOf(new Date(after), timezone));

  // The period the instant falls in is computed rather than guessed, and the walk still opens one period
  // early, so a rule whose period holds days on both sides of that instant can never be stepped over.
  const opening = Math.max(periodOfDay(reached, frequency, rule, anchor) - 1, 0);

  const limit = searchLimitOf(frequency, rule.interval);

  for (let step = 0; step < limit; step += 1) {
    for (const dayNumber of daysOfPeriod(opening + step, frequency, rule, anchor)) {
      if (dayNumber < anchor.dayNumber) {
        continue;
      }

      // A day past the horizon is exhaustion rather than an error, the same surrender every schedule here
      // makes at the end of the year 275760; days come in order, so the first such day settles the rest.
      if (dayNumber * MILLISECONDS_IN_DAY > HORIZON_IN_MILLISECONDS) {
        return null;
      }

      const occurrence = nextOn(dayNumber, minutesOfDay, timezone, after);

      if (occurrence !== null) {
        return occurrence;
      }
    }
  }

  return null;
};

/*****************************************************************************************************************/

// A counted rule is an ordinal from its anchor, so the walk starts there and stops the moment the count is
// spent, whether or not the instant asked from has been reached. There is no cheaper way to honour COUNT from
// a schedule that keeps no state of its own.
const nextOfCount = (
  after: number,
  count: number,
  floor: number,
  occurrenceAfter: (instant: number) => number | null,
): Date | null => {
  let cursor = floor;

  for (let taken = 0; taken < count; taken += 1) {
    const found = occurrenceAfter(cursor);

    if (found === null) {
      return null;
    }

    if (found > after) {
      return new Date(found);
    }

    cursor = found;
  }

  return null;
};

/*****************************************************************************************************************/

// A schedule from a recurrence rule, counted from an anchor and read in a timezone.
export const recurrenceRule = (rule: string, options: RecurrenceRuleOptions = {}): Schedule => {
  const parsed = validated(parseRecurrenceRule(rule));

  const timezone = options.timezone ?? 'UTC';

  const from = options.from ?? new Date(0);

  const anchor = anchorOf(from, timezone);

  const minutesOfDay = minutesOfDayOf(parsed, anchor);

  const frequency = calendarFrequencyOf(parsed);

  // Nothing before the anchor ever fires, so the walk never looks earlier than the instant before it.
  const floor = anchor.instant - 1;

  const occurrenceAfter = (instant: number): number | null => {
    const reached = Math.max(instant, floor);

    const found =
      frequency === null
        ? nextByInstant(reached, parsed, anchor.instant, timezone)
        : nextByCalendar(reached, frequency, parsed, anchor, minutesOfDay, timezone);

    if (found === null || (parsed.until !== null && found > parsed.until.getTime())) {
      return null;
    }

    return found;
  };

  return {
    next: after => {
      const instant = after.getTime();

      if (Number.isNaN(instant)) {
        throw new RangeError('a recurrence rule requires a valid Date to advance from');
      }

      if (parsed.count !== null) {
        return nextOfCount(instant, parsed.count, floor, occurrenceAfter);
      }

      const found = occurrenceAfter(instant);

      return found === null ? null : new Date(found);
    },
  };
};

/*****************************************************************************************************************/
