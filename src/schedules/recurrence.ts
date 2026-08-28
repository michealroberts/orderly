/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/schedules
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

// The recurrence rule notation of RFC 5545, the grammar calendars speak, parsed to the subset this module
// means to honour: a frequency, how many of it between occurrences, an end by count or by date, and the BY
// parts that narrow which months, days, hours and minutes count. Weekdays are normalized to the module's
// Monday first numbering, and the parts left out, BYSECOND, BYYEARDAY, BYWEEKNO and BYSETPOS among them, are
// refused by name rather than ignored, because a rule silently stripped of what narrows it fires far more
// often than it was asked to. A parsed rule is data, not a schedule: the recurrence constructor turns it into
// one.

/*****************************************************************************************************************/

import {
  instantIn,
  numbersIn,
  positiveNumberIn,
  type RecurrenceWeekday,
  weekdaysIn,
  weekStartIn,
} from './recurrence-values';

/*****************************************************************************************************************/

export type { RecurrenceWeekday } from './recurrence-values';

/*****************************************************************************************************************/

// How often a rule recurs before its BY parts narrow it.
export type RecurrenceFrequency = 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

/*****************************************************************************************************************/

// A recurrence rule expanded to what each part names. A part the rule left out is null, which is not the same
// as a part naming every value: an absent part takes its values from the instant a schedule counts from,
// while a written one narrows.
export type ParsedRecurrenceRule = {
  // The frequency the rule recurs at, the one part every rule must carry.
  frequency: RecurrenceFrequency;
  // How many periods of that frequency between occurrences; 1 when the rule leaves it out.
  interval: number;
  // How many occurrences the rule yields before exhausting, or null when it does not end by counting.
  count: number | null;
  // The instant after which the rule yields nothing, or null when it does not end by date.
  until: Date | null;
  // Months of the year the rule narrows to, 1 through 12.
  months: number[] | null;
  // Days of the month the rule narrows to, 1 through 31, or -1 through -31 counting from the month's end.
  daysOfMonth: number[] | null;
  // Weekdays the rule narrows to, each optionally an ordinal occurrence within the period.
  daysOfWeek: RecurrenceWeekday[] | null;
  // Hours of the day the rule narrows to, 0 through 23.
  hours: number[] | null;
  // Minutes of the hour the rule narrows to, 0 through 59.
  minutes: number[] | null;
  // The day the rule counts weeks from, 1 through 7 with Monday first; Monday when the rule leaves it out, as
  // RFC 5545 has it.
  weekStart: number;
};

/*****************************************************************************************************************/

const FREQUENCIES: Record<string, RecurrenceFrequency> = {
  MINUTELY: 'minutely',
  HOURLY: 'hourly',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
};

/*****************************************************************************************************************/

// The parts of the notation this module does not honour, refused by name so a rule is never quietly widened.
const UNSUPPORTED = new Set(['BYSECOND', 'BYYEARDAY', 'BYWEEKNO', 'BYSETPOS']);

/*****************************************************************************************************************/

// The parts of a rule, split on their semicolons and read into a map, each part refused if it is written more
// than once, unreadable, empty, or one this module does not honour.
const partsOf = (rule: string): Map<string, string> => {
  const body = rule.trim().replace(/^RRULE:/iu, '');

  const parts = new Map<string, string>();

  for (const piece of body.split(';')) {
    const separator = piece.indexOf('=');

    const name = (separator === -1 ? piece : piece.slice(0, separator)).trim().toUpperCase();

    const value = separator === -1 ? '' : piece.slice(separator + 1).trim();

    if (piece.trim() === '') {
      throw new RangeError(`a recurrence rule cannot hold an empty part: got "${body}"`);
    }

    if (name === '' || value === '') {
      throw new RangeError(`a recurrence rule takes parts such as FREQ=DAILY: got "${piece}"`);
    }

    if (UNSUPPORTED.has(name)) {
      throw new RangeError(`${name} is not supported: got "${piece}"`);
    }

    if (parts.has(name)) {
      throw new RangeError(`${name} was written more than once`);
    }

    parts.set(name, value);
  }

  return parts;
};

/*****************************************************************************************************************/

const KNOWN = new Set([
  'FREQ',
  'INTERVAL',
  'COUNT',
  'UNTIL',
  'BYMONTH',
  'BYMONTHDAY',
  'BYDAY',
  'BYHOUR',
  'BYMINUTE',
  'WKST',
]);

/*****************************************************************************************************************/

// The BY parts, each read only when the rule wrote it, and null everywhere it did not.
const narrowingPartsOf = (
  parts: Map<string, string>,
): Pick<ParsedRecurrenceRule, 'months' | 'daysOfMonth' | 'daysOfWeek' | 'hours' | 'minutes'> => {
  const months = parts.get('BYMONTH');

  const daysOfMonth = parts.get('BYMONTHDAY');

  const daysOfWeek = parts.get('BYDAY');

  const hours = parts.get('BYHOUR');

  const minutes = parts.get('BYMINUTE');

  return {
    months: months === undefined ? null : numbersIn(months, 'BYMONTH', 1, 12),
    daysOfMonth: daysOfMonth === undefined ? null : numbersIn(daysOfMonth, 'BYMONTHDAY', -31, 31),
    daysOfWeek: daysOfWeek === undefined ? null : weekdaysIn(daysOfWeek, 'BYDAY'),
    hours: hours === undefined ? null : numbersIn(hours, 'BYHOUR', 0, 23),
    minutes: minutes === undefined ? null : numbersIn(minutes, 'BYMINUTE', 0, 59),
  };
};

/*****************************************************************************************************************/

export const parseRecurrenceRule = (rule: string): ParsedRecurrenceRule => {
  const parts = partsOf(rule);

  for (const name of parts.keys()) {
    if (!KNOWN.has(name)) {
      throw new RangeError(`a recurrence rule has no part named ${name}`);
    }
  }

  const written = parts.get('FREQ');

  const frequency = FREQUENCIES[written?.toUpperCase() ?? ''];

  if (frequency === undefined) {
    throw new RangeError(
      `FREQ is required and takes MINUTELY, HOURLY, DAILY, WEEKLY, MONTHLY or YEARLY: got "${written ?? ''}"`,
    );
  }

  const count = parts.get('COUNT');

  const until = parts.get('UNTIL');

  if (count !== undefined && until !== undefined) {
    throw new RangeError('a recurrence rule ends by COUNT or by UNTIL, never by both');
  }

  const interval = parts.get('INTERVAL');

  const weekStart = parts.get('WKST');

  return {
    frequency,
    interval: interval === undefined ? 1 : positiveNumberIn(interval, 'INTERVAL'),
    count: count === undefined ? null : positiveNumberIn(count, 'COUNT'),
    until: until === undefined ? null : instantIn(until, 'UNTIL'),
    ...narrowingPartsOf(parts),
    weekStart: weekStart === undefined ? 1 : weekStartIn(weekStart),
  };
};

/*****************************************************************************************************************/
