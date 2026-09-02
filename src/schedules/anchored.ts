/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/schedules
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import {
  MAXIMUM_INSTANT_IN_MILLISECONDS,
  MILLISECONDS_IN_HOUR,
  MILLISECONDS_IN_MINUTE,
} from './constants';

import type { Schedule } from './contract';

import { validatedCount, validatedPeriod } from './interval';

/*****************************************************************************************************************/

// The anchored cadence constructor: at(date).every(5).minutes() is a schedule whose occurrences are counted from
// the instant the anchor names rather than the Unix epoch, the anchor the first of them. It reads counts and
// periods exactly as every() does and refuses the same ones, so the two differ in nothing but where the
// counting starts.

/*****************************************************************************************************************/

// An anchored interval is the cadence counted from a chosen instant, its unit still unspoken: like Interval,
// every(count) on an anchor is an unfinished sentence until a unit finishes it. Only the clock units are here,
// because a cadence of days, weeks or months counted from an instant is a recurrence rule anchored there, which
// recurrenceRule() already says.
export interface AnchoredInterval {
  // Occurrences every count minutes from the anchor, the anchor the first of them: at(date).every(5).minutes()
  // ticks at the instant given and every five minutes after it, however that instant sits against the epoch.
  minutes: () => Schedule;
  // Occurrences every count hours from the anchor, the anchor the first of them.
  hours: () => Schedule;
}

/*****************************************************************************************************************/

// The furthest instant a Date can hold, as the integer the anchored arithmetic compares against.
const MAXIMUM_INSTANT = BigInt(MAXIMUM_INSTANT_IN_MILLISECONDS);

/*****************************************************************************************************************/

// A schedule ticking once per period from an anchor, the anchor itself the first tick. The distance from the
// anchor to the instant asked from is not one a number counts exactly, since the two can sit at opposite ends
// of the range a Date can hold, so the ticks are counted in integers exact at any size: a number answers a
// millisecond late at the far end, which is a tick the cadence never had.
const anchored = (anchor: number, periodInMilliseconds: number): Schedule => {
  const period = BigInt(validatedPeriod(periodInMilliseconds));

  const origin = BigInt(anchor);

  return {
    next: after => {
      const instant = after.getTime();

      if (Number.isNaN(instant)) {
        throw new RangeError('an interval schedule requires a valid Date to advance from');
      }

      if (instant < anchor) {
        return new Date(anchor);
      }

      const occurrence = origin + ((BigInt(instant) - origin) / period + 1n) * period;

      return occurrence > MAXIMUM_INSTANT ? null : new Date(Number(occurrence));
    },
  };
};

/*****************************************************************************************************************/

// The cadence counted from an anchor, the anchor the first occurrence. Reached through at(date).every(count).
export const anchoredEvery = (anchor: number, count: number): AnchoredInterval => {
  const cadence = validatedCount(count);

  return {
    minutes: () => anchored(anchor, cadence * MILLISECONDS_IN_MINUTE),
    hours: () => anchored(anchor, cadence * MILLISECONDS_IN_HOUR),
  };
};

/*****************************************************************************************************************/
