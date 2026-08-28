/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/schedules
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

// The wall clock and instant resolution core, on the runtime's own IANA data through Intl, with the two daylight
// saving policies decided once here: a wall clock inside a spring forward gap resolves to the instant the gap's
// span later, and a wall clock a fall back repeats resolves to its first occurrence. Internal to the schedules
// module: the calendar, cron and rrule constructors consume it, nothing outside does.

/*****************************************************************************************************************/

// One formatter per timezone, cached: constructing Intl.DateTimeFormat is far more expensive than using it, and
// a formatter is pure with respect to the instants it formats. h23 forces midnight to read 00 rather than 24.
const formatters = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (timezone: string): Intl.DateTimeFormat => {
  const cached = formatters.get(timezone);

  if (cached !== undefined) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  });

  formatters.set(timezone, formatter);

  return formatter;
};

/*****************************************************************************************************************/

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/*****************************************************************************************************************/

// What a clock on the wall reads in a timezone: month 1 to 12, weekday 1 to 7 with Monday first.
export type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

/*****************************************************************************************************************/

// The hour and minute of a wall clock reading, the moment in a day a calendar occurrence lands on.
export type WallTime = {
  // The hour of the day, a whole number from 0 through 23 on a twenty four hour clock.
  hour: number;
  // The minute of the hour, a whole number from 0 through 59.
  minute: number;
};

/*****************************************************************************************************************/

// A day of the week by its full name, Monday first, matching the weekday numbering of WallClock.
export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

/*****************************************************************************************************************/

export const wallClockOf = (instant: Date, timezone: string): WallClock => {
  const parts = new Map(
    formatterFor(timezone)
      .formatToParts(instant)
      .map(piece => [piece.type, piece.value]),
  );

  const numeric = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.get(type));

  const token = parts.get('weekday') ?? '';

  const weekday = WEEKDAYS[token];

  if (weekday === undefined) {
    throw new RangeError(`unrecognised weekday "${token}" for timezone ${timezone}`);
  }

  return {
    year: numeric('year'),
    month: numeric('month'),
    day: numeric('day'),
    hour: numeric('hour'),
    minute: numeric('minute'),
    second: numeric('second'),
    weekday,
  };
};

/*****************************************************************************************************************/

// The zone's offset at an instant, derived by reading the wall clock there and treating it as if it were UTC.
export const offsetInMilliseconds = (instant: number, timezone: string): number => {
  const wall = wallClockOf(new Date(instant), timezone);

  return (
    Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second) - instant
  );
};

/*****************************************************************************************************************/

const matches = (
  wall: WallClock,
  requested: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  },
): boolean => {
  return (
    wall.year === requested.year &&
    wall.month === requested.month &&
    wall.day === requested.day &&
    wall.hour === requested.hour &&
    wall.minute === requested.minute &&
    wall.second === requested.second
  );
};

/*****************************************************************************************************************/

// The inverse: the instant at which a timezone's clocks read the wall time given. The offset is sampled a day
// before and a day after a UTC interpretation of the wall time, which straddles any transition near it and so
// yields a candidate instant for each offset in play: a repeated wall time resolves to the earliest candidate
// that matches, and one inside a gap, which no candidate matches, resolves with the offset from before the
// transition, landing the gap's span later.
export const instantOf = (
  wall: { year: number; month: number; day: number; hour: number; minute: number; second?: number },
  timezone: string,
): Date => {
  const requested = { ...wall, second: wall.second ?? 0 };

  const guess = Date.UTC(
    requested.year,
    requested.month - 1,
    requested.day,
    requested.hour,
    requested.minute,
    requested.second,
  );

  const before = offsetInMilliseconds(guess - 86_400_000, timezone);

  const after = offsetInMilliseconds(guess + 86_400_000, timezone);

  const candidates = [...new Set([guess - before, guess - after])];

  const matching = candidates
    .filter(candidate => matches(wallClockOf(new Date(candidate), timezone), requested))
    .toSorted((first, second) => first - second);

  const earliest = matching[0];

  if (earliest !== undefined) {
    return new Date(earliest);
  }

  return new Date(guess - Math.min(before, after));
};

/*****************************************************************************************************************/
