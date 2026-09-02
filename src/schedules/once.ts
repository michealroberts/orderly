/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/schedules
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import type { Schedule } from './contract';

import { anchoredEvery, type AnchoredInterval } from './anchored';

/*****************************************************************************************************************/

// An anchor is deliberately not a Schedule: at(date) alone is an unfinished sentence about how many runs it
// produces, so the type system refuses it anywhere a Schedule goes until a verb finishes it.
export interface Anchor {
  // Runs once, at exactly the anchored instant, to the millisecond, then exhausts.
  once: () => Schedule;
  // Runs every count of a unit from the anchored instant, the anchor the first run, the unit still to be
  // named: at(date).every(5).minutes() is the instant given and every five minutes after it.
  every: (count: number) => AnchoredInterval;
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
        next: after => {
          const reached = after.getTime();

          if (Number.isNaN(reached)) {
            throw new RangeError('at().once() requires a valid Date to advance from');
          }

          return reached < instant ? new Date(instant) : null;
        },
      };
    },
    every: count => anchoredEvery(instant, count),
  };
};

/*****************************************************************************************************************/
