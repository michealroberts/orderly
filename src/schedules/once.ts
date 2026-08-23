/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/schedules
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import type { Schedule } from './contract';

/*****************************************************************************************************************/

// An anchor is deliberately not a Schedule: at(date) alone is an unfinished sentence about how many runs it
// produces, so the type system refuses it anywhere a Schedule goes until a verb finishes it.
export interface Anchor {
  // Runs once, at exactly the anchored instant, to the millisecond, then exhausts.
  once: () => Schedule;
}

/*****************************************************************************************************************/

// The anchor: an exact instant, taken as a Date and nothing else. An invalid Date is refused loudly here rather
// than becoming a schedule that never fires and never exhausts.
export const at = (date: Date): Anchor => {
  const instant = date.getTime();

  if (Number.isNaN(instant)) {
    throw new RangeError('at() requires a valid Date');
  }

  return {
    once: () => {
      return {
        next: after => (after.getTime() < instant ? new Date(instant) : null),
      };
    },
  };
};

/*****************************************************************************************************************/
