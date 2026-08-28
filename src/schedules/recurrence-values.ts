/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/schedules
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

// How a recurrence rule's parts read their values: the numbers, weekdays, counts and instants the notation
// writes, each refused loudly and by name when it is not what the part allows. The rule itself is assembled a
// module over, which keeps the shapes of the notation apart from the reading of them.

/*****************************************************************************************************************/

// A weekday a rule names, on its own or as an occurrence within the period: the second Monday is an ordinal of
// 2, and the last Friday is an ordinal of -1.
export type RecurrenceWeekday = {
  // The day of the week, 1 through 7 with Monday first, the numbering WallClock reads.
  weekday: number;
  // Which occurrence of that weekday within the period counts, counted from the end when negative; every one
  // when null.
  ordinal: number | null;
};

/*****************************************************************************************************************/

const WEEKDAYS: Record<string, number> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 7 };

/*****************************************************************************************************************/

// Whole numbers within a part's range, as a list. A part counting from both ends of a period, BYMONTHDAY
// alone here, spans zero without ever meaning it, so zero is refused there and nowhere else: BYHOUR and
// BYMINUTE both mean it, at midnight and on the hour.
export const numbersIn = (
  value: string,
  name: string,
  lowest: number,
  highest: number,
): number[] => {
  return value.split(',').map(token => {
    if (!/^[+-]?\d+$/u.test(token)) {
      throw new RangeError(`${name} takes whole numbers: got "${token}"`);
    }

    const number = Number(token);

    if (number < lowest || number > highest || (lowest < 0 && number === 0)) {
      throw new RangeError(`${name} allows ${lowest} through ${highest}: got "${token}"`);
    }

    return number;
  });
};

/*****************************************************************************************************************/

// A weekday, alone or behind the occurrence of it the rule wants: MO, 2MO and -1FR all read here.
export const weekdaysIn = (value: string, name: string): RecurrenceWeekday[] => {
  return value.split(',').map(token => {
    const matched = /^(?<ordinal>[+-]?\d+)?(?<day>[A-Z]{2})$/u.exec(token.toUpperCase());

    const weekday = WEEKDAYS[matched?.groups?.['day'] ?? ''];

    if (weekday === undefined) {
      throw new RangeError(`${name} takes weekdays such as MO, 2MO or -1FR: got "${token}"`);
    }

    const written = matched?.groups?.['ordinal'];

    if (written === undefined) {
      return { weekday, ordinal: null };
    }

    const ordinal = Number(written);

    if (ordinal === 0 || Math.abs(ordinal) > 53) {
      throw new RangeError(`${name} counts occurrences from 1 or -1 through 53: got "${token}"`);
    }

    return { weekday, ordinal };
  });
};

/*****************************************************************************************************************/

// A positive whole number, the shape INTERVAL and COUNT both take, held to what a number counts exactly so a
// rule can never carry a count or an interval its arithmetic would drift on.
export const positiveNumberIn = (value: string, name: string): number => {
  const number = Number(value);

  if (!/^\d+$/u.test(value) || !Number.isSafeInteger(number) || number < 1) {
    throw new RangeError(
      `${name} takes a whole number of at least one that a number counts exactly: got "${value}"`,
    );
  }

  return number;
};

/*****************************************************************************************************************/

// An instant in the notation's own form: a bare calendar date, 20260115, which reads as midnight UTC, or a
// time of day that says so, 20260115T090000Z. A time of day without the Z is a floating local time in RFC
// 5545, an instant only a calendar's own timezone can place, so it is refused here rather than quietly read
// as UTC and fired hours from where it was meant.
export const instantIn = (value: string, name: string): Date => {
  const matched =
    /^(?<year>\d{4})(?<month>\d{2})(?<day>\d{2})(?:T(?<hour>\d{2})(?<minute>\d{2})(?<second>\d{2})Z)?$/u.exec(
      value.toUpperCase(),
    );

  const groups = matched?.groups;

  if (groups === undefined) {
    throw new RangeError(
      `${name} takes a date such as 20260115, or a time of day in UTC such as 20260115T090000Z: got "${value}"`,
    );
  }

  const year = Number(groups['year']);

  const month = Number(groups['month']);

  const day = Number(groups['day']);

  const hour = Number(groups['hour'] ?? 0);

  const minute = Number(groups['minute'] ?? 0);

  const second = Number(groups['second'] ?? 0);

  const instant = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  // Date.UTC rolls an impossible reading over rather than refusing it, the thirty first of February becoming
  // the third of March, so the instant is read back and must say exactly what was written.
  const real =
    instant.getUTCFullYear() === year &&
    instant.getUTCMonth() + 1 === month &&
    instant.getUTCDate() === day &&
    instant.getUTCHours() === hour &&
    instant.getUTCMinutes() === minute &&
    instant.getUTCSeconds() === second;

  if (!real) {
    throw new RangeError(`${name} was handed a date that is not a real instant: got "${value}"`);
  }

  return instant;
};

/*****************************************************************************************************************/

// The day a rule counts its weeks from, which only WKST writes.
export const weekStartIn = (value: string): number => {
  const weekStart = WEEKDAYS[value.toUpperCase()];

  if (weekStart === undefined) {
    throw new RangeError(`WKST takes a weekday such as MO or SU: got "${value}"`);
  }

  return weekStart;
};

/*****************************************************************************************************************/
