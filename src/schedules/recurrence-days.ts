/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/schedules
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import {
  dayNumberOf,
  daysInMonth,
  modulo,
  type WallDate,
  wallDateOf,
  weekdayOf,
} from './candidates';

import type { ParsedRecurrenceRule, RecurrenceWeekday } from './recurrence';

/*****************************************************************************************************************/

// Which days one period of a rule's frequency names. RFC 5545 gives each BY part one of two jobs, and which
// job depends on the frequency: a part narrows the days the period already holds, or it expands the period
// into the days it names. BYMONTH expands a yearly period and narrows every other; BYMONTHDAY expands a monthly
// or yearly period and narrows a daily one; BYDAY expands a weekly, monthly or yearly period and narrows a
// daily one, and narrows a monthly one once BYMONTHDAY is named beside it. A part the rule never wrote takes
// its value from the anchor, which is the role DTSTART plays in the notation.

/*****************************************************************************************************************/

// The instant a rule counts from, read as the calendar reads it: every part the rule leaves unwritten is taken
// from here.
export type RecurrenceAnchor = {
  // The instant it stands at, read down to the whole minute it falls in.
  instant: number;
  // The day the anchor falls on, counted from 1970-01-01.
  dayNumber: number;
  // The weekday it falls on, 1 through 7 with Monday first.
  weekday: number;
  // The calendar date it reads as.
  wall: WallDate;
  // The time of day it reads, as minutes from midnight.
  minuteOfDay: number;
};

/*****************************************************************************************************************/

// The frequencies whose periods are made of whole days; the rest step in instants and never come here.
export type CalendarFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

/*****************************************************************************************************************/

// A day of the month resolved against the month it falls in, counting from the end when negative, or zero when
// the month is too short to hold it: the thirty first of February is no day at all.
const dayOfMonthWithin = (year: number, month: number, written: number): number => {
  const length = daysInMonth(year, month);

  const resolved = written > 0 ? written : length + written + 1;

  return resolved >= 1 && resolved <= length ? resolved : 0;
};

/*****************************************************************************************************************/

// Every day of a span that the weekday entries name: all of them for an entry carrying no ordinal, and
// otherwise the one it counts to, from the start of the span or, when the ordinal is negative, from its end.
const daysMatching = (first: number, length: number, entries: RecurrenceWeekday[]): number[] => {
  return entries.flatMap(entry => {
    const matching: number[] = [];

    for (let offset = 0; offset < length; offset += 1) {
      if (weekdayOf(first + offset) === entry.weekday) {
        matching.push(first + offset);
      }
    }

    if (entry.ordinal === null) {
      return matching;
    }

    const chosen = matching.at(entry.ordinal > 0 ? entry.ordinal - 1 : entry.ordinal);

    return chosen === undefined ? [] : [chosen];
  });
};

/*****************************************************************************************************************/

// The days one month holds, by whichever of BYMONTHDAY and BYDAY the rule wrote: both together read as the
// days of the month falling on those weekdays, and neither reads as the anchor's own day of the month.
const daysOfMonth = (
  year: number,
  month: number,
  rule: ParsedRecurrenceRule,
  anchor: RecurrenceAnchor,
): number[] => {
  const written = rule.daysOfMonth;

  const weekdays = rule.daysOfWeek;

  if (written === null) {
    if (weekdays === null) {
      const day = dayOfMonthWithin(year, month, anchor.wall.day);

      return day === 0 ? [] : [dayNumberOf({ year, month, day })];
    }

    return daysMatching(dayNumberOf({ year, month, day: 1 }), daysInMonth(year, month), weekdays);
  }

  const days = written
    .map(entry => dayOfMonthWithin(year, month, entry))
    .filter(day => day !== 0)
    .map(day => dayNumberOf({ year, month, day }));

  if (weekdays === null) {
    return days;
  }

  const allowed = new Set(weekdays.map(entry => entry.weekday));

  return days.filter(day => allowed.has(weekdayOf(day)));
};

/*****************************************************************************************************************/

// The months a yearly period expands into: those it names, or every month once a day part has to be looked for
// across the year, or the anchor's own month when nothing narrows it at all.
const monthsOfYear = (rule: ParsedRecurrenceRule, anchor: RecurrenceAnchor): number[] => {
  if (rule.months !== null) {
    return rule.months;
  }

  if (rule.daysOfMonth !== null || rule.daysOfWeek !== null) {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }

  return [anchor.wall.month];
};

/*****************************************************************************************************************/

// A yearly period's days. Ordinals in BYDAY count across the year when the rule names no month, and within
// each named month when it does, which is the distinction RFC 5545 draws between the two shapes.
const daysOfYear = (
  year: number,
  rule: ParsedRecurrenceRule,
  anchor: RecurrenceAnchor,
): number[] => {
  const weekdays = rule.daysOfWeek;

  if (rule.months === null && rule.daysOfMonth === null && weekdays !== null) {
    const first = dayNumberOf({ year, month: 1, day: 1 });

    return daysMatching(first, dayNumberOf({ year: year + 1, month: 1, day: 1 }) - first, weekdays);
  }

  return monthsOfYear(rule, anchor).flatMap(month => daysOfMonth(year, month, rule, anchor));
};

/*****************************************************************************************************************/

// Whether a day survives the parts that narrow rather than expand: the month it falls in, its day of the
// month, and its weekday, each checked only when the rule wrote it.
export const withinLimits = (
  dayNumber: number,
  rule: ParsedRecurrenceRule,
  wall: WallDate,
): boolean => {
  if (rule.months !== null && !rule.months.includes(wall.month)) {
    return false;
  }

  if (
    rule.daysOfMonth !== null &&
    !rule.daysOfMonth.some(written => dayOfMonthWithin(wall.year, wall.month, written) === wall.day)
  ) {
    return false;
  }

  return (
    rule.daysOfWeek === null ||
    rule.daysOfWeek.some(entry => entry.weekday === weekdayOf(dayNumber))
  );
};

/*****************************************************************************************************************/

// The week a day belongs to, as the day its week starts on, which WKST decides.
export const weekStartingOn = (dayNumber: number, weekStart: number): number => {
  return dayNumber - modulo(weekdayOf(dayNumber) - weekStart, 7);
};

/*****************************************************************************************************************/

// The days a weekly period holds: the weekdays it names, or the anchor's own weekday when it names none.
const daysOfWeek = (
  first: number,
  rule: ParsedRecurrenceRule,
  anchor: RecurrenceAnchor,
): number[] => {
  const weekdays = rule.daysOfWeek?.map(entry => entry.weekday) ?? [anchor.weekday];

  return weekdays.map(weekday => first + modulo(weekday - rule.weekStart, 7));
};

/*****************************************************************************************************************/

// The month a day falls in, counted from January 1970, which is how monthly periods are numbered.
const monthNumberOf = (wall: WallDate): number => (wall.year - 1970) * 12 + (wall.month - 1);

/*****************************************************************************************************************/

// Which period of a rule a day falls in, counted exactly rather than guessed at from a span of days, so a
// month of thirty one days and a leap year never push the walk past the period it was looking for.
export const periodOfDay = (
  dayNumber: number,
  frequency: CalendarFrequency,
  rule: ParsedRecurrenceRule,
  anchor: RecurrenceAnchor,
): number => {
  const wall = wallDateOf(dayNumber);

  if (frequency === 'daily') {
    return Math.floor((dayNumber - anchor.dayNumber) / rule.interval);
  }

  if (frequency === 'weekly') {
    const days =
      weekStartingOn(dayNumber, rule.weekStart) - weekStartingOn(anchor.dayNumber, rule.weekStart);

    return Math.floor(days / 7 / rule.interval);
  }

  if (frequency === 'monthly') {
    return Math.floor((monthNumberOf(wall) - monthNumberOf(anchor.wall)) / rule.interval);
  }

  return Math.floor((wall.year - anchor.wall.year) / rule.interval);
};

/*****************************************************************************************************************/

// The days a period holds before anything narrows them, by the frequency's own way of counting periods from
// the anchor: days, weeks starting on WKST, months from January 1970, or years.
const daysOf = (
  step: number,
  frequency: CalendarFrequency,
  rule: ParsedRecurrenceRule,
  anchor: RecurrenceAnchor,
): number[] => {
  if (frequency === 'daily') {
    return [anchor.dayNumber + step];
  }

  if (frequency === 'weekly') {
    return daysOfWeek(weekStartingOn(anchor.dayNumber, rule.weekStart) + step * 7, rule, anchor);
  }

  if (frequency === 'monthly') {
    const months = monthNumberOf(anchor.wall) + step;

    return daysOfMonth(1970 + Math.floor(months / 12), modulo(months, 12) + 1, rule, anchor);
  }

  return daysOfYear(anchor.wall.year + step, rule, anchor);
};

/*****************************************************************************************************************/

// The days one period of a calendar frequency names, ascending and without repeats. Periods are counted from
// the anchor's own, so period zero is the one the anchor falls in and every other is a whole number of
// intervals away from it.
export const daysOfPeriod = (
  period: number,
  frequency: CalendarFrequency,
  rule: ParsedRecurrenceRule,
  anchor: RecurrenceAnchor,
): number[] => {
  const days = daysOf(period * rule.interval, frequency, rule, anchor);

  const narrowed =
    frequency === 'daily'
      ? days.filter(day => withinLimits(day, rule, wallDateOf(day)))
      : days.filter(day => rule.months === null || rule.months.includes(wallDateOf(day).month));

  return [...new Set(narrowed)].toSorted((first, second) => first - second);
};

/*****************************************************************************************************************/
