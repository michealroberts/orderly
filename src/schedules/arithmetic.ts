/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/schedules
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { type Duration, durationInMilliseconds } from './duration';

/*****************************************************************************************************************/

// Both directions share the same guards: the instant in must be valid, and the instant out must still be one a
// Date can hold, refused loudly rather than returned as an Invalid Date that fails somewhere far away.
const shifted = (date: Date, milliseconds: number): Date => {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('date arithmetic requires a valid Date');
  }

  const result = new Date(date.getTime() + milliseconds);

  if (Number.isNaN(result.getTime())) {
    throw new RangeError('date arithmetic produced an instant outside the range a Date can hold');
  }

  return result;
};

/*****************************************************************************************************************/

// A new instant, the span later. The Date given is never mutated.
export const add = (date: Date, duration: Duration): Date => {
  return shifted(date, durationInMilliseconds(duration));
};

/*****************************************************************************************************************/

// A new instant, the span earlier. The mirror of add: subtracting a span always undoes adding it.
export const subtract = (date: Date, duration: Duration): Date => {
  return shifted(date, -durationInMilliseconds(duration));
};

/*****************************************************************************************************************/
