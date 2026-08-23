/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/schedules
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

// A span of time as named parts, every part optional and additive. Parts may be fractional: half a day is a
// legal way to say twelve hours. A span is a magnitude, never an instant: instants are Dates, everywhere. A
// type alias rather than an interface, so the shape stays closed to declaration merging.
export type Duration = {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
};

/*****************************************************************************************************************/

// A part that is not finite counts as zero rather than poisoning the whole span.
const part = (value: number): number => (Number.isFinite(value) ? value : 0);

/*****************************************************************************************************************/

// Normalizes a span to whole milliseconds: parts summed, the total floored, and never negative. A total that
// overflows past what a number can hold normalizes to zero, so finite parts can never yield an infinite span.
export const durationInMilliseconds = (duration: Duration): number => {
  const { days = 0, hours = 0, minutes = 0, seconds = 0, milliseconds = 0 } = duration;

  const total =
    part(days) * 86_400_000 +
    part(hours) * 3_600_000 +
    part(minutes) * 60_000 +
    part(seconds) * 1_000 +
    part(milliseconds);

  return Number.isFinite(total) ? Math.max(Math.floor(total), 0) : 0;
};

/*****************************************************************************************************************/
