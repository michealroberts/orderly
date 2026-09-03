/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/schedules
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { MAXIMUM_INSTANT_IN_MILLISECONDS } from './constants';

import type { Schedule } from './contract';

/*****************************************************************************************************************/

// A schedule bounded to a window of time: nothing fires before the window opens, and the schedule exhausts once
// it has closed. Both ends are inclusive, an occurrence exactly at either being kept, which is how RFC 5545
// reads DTSTART and UNTIL. Either end may be left open, so a window can say only when to start or only when
// to stop.

/*****************************************************************************************************************/

export type BetweenOptions = {
  // The instant the window opens, inclusive: an occurrence exactly here is kept. The earliest instant a Date
  // can hold when omitted, which is no bound at all.
  from?: Date;
  // The instant the window closes, inclusive: an occurrence exactly here is kept, and none after it. The
  // latest instant a Date can hold when omitted, which is no bound at all.
  until?: Date;
};

/*****************************************************************************************************************/

// A bound as the instant it names, or the end of the range a Date can hold when it was left open. An invalid
// Date is refused here, at construction, rather than becoming a window that holds nothing and never says why.
const boundOf = (bound: Date | undefined, open: number, name: string): number => {
  if (bound === undefined) {
    return open;
  }

  const instant = bound.getTime();

  if (Number.isNaN(instant)) {
    throw new RangeError(`between() requires a valid Date for ${name}`);
  }

  return instant;
};

/*****************************************************************************************************************/

// The schedule within the window. The bounds are read once, so a window stays pure however the Dates it was
// built from are changed afterwards.
export const between = (schedule: Schedule, options: BetweenOptions = {}): Schedule => {
  const from = boundOf(options.from, -MAXIMUM_INSTANT_IN_MILLISECONDS, 'from');

  const until = boundOf(options.until, MAXIMUM_INSTANT_IN_MILLISECONDS, 'until');

  if (from > until) {
    throw new RangeError('between() requires a window that closes no earlier than it opens');
  }

  return {
    next: after => {
      const instant = after.getTime();

      if (Number.isNaN(instant)) {
        throw new RangeError('a window requires a valid Date to advance from');
      }

      // Nothing follows the close of the window, so the schedule is not asked past it.
      if (instant >= until) {
        return null;
      }

      // Nothing fires before the window opens, so the walk never looks earlier than the instant before it does.
      const occurrence = schedule.next(new Date(Math.max(instant, from - 1)));

      return occurrence === null || occurrence.getTime() > until ? null : occurrence;
    },
  };
};

/*****************************************************************************************************************/
