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

/*****************************************************************************************************************/

// The fixed cadence constructor: every(5).minutes() is a schedule whose occurrences are aligned to the Unix
// epoch, not to when the schedule was built. Alignment is the decision that keeps next() pure: every worker on
// every replay computes the same series, so five minute ticks land at :00, :05 and :10 for everyone, and two
// deploys of the same schedule can never drift apart. A cadence anchored to a chosen instant instead arrives
// with at().every(), built on top of this. A tick past the furthest instant a Date can hold means the cadence
// has outlived time as a Date can express it, which is exhaustion, not an error.

/*****************************************************************************************************************/

// An interval is the cadence with its unit still unspoken: like an Anchor, every(count) alone is an unfinished
// sentence, so the type system refuses it anywhere a Schedule goes until a unit finishes it.
export interface Interval {
  // Occurrences every count minutes, aligned to the epoch: every(5).minutes() ticks at :00, :05 and :10.
  minutes: () => Schedule;
  // Occurrences every count hours, aligned to the epoch: every(6).hours() ticks at 00:00, 06:00, 12:00 and
  // 18:00 UTC.
  hours: () => Schedule;
}

/*****************************************************************************************************************/

// A schedule ticking once per period from the epoch. The period is floored to whole milliseconds and must be
// one a number counts exactly: past Number.MAX_SAFE_INTEGER, overflow to Infinity included, tick arithmetic
// would drift, so exactness is enforced here rather than promised. A period that floors to nothing would never
// advance. Both are refused loudly rather than becoming schedules that violate the contract.
const aligned = (periodInMilliseconds: number): Schedule => {
  const period = Math.floor(periodInMilliseconds);

  if (!Number.isSafeInteger(period)) {
    throw new RangeError('an interval must span whole milliseconds a number can count exactly');
  }

  if (period < 1) {
    throw new RangeError('an interval must span at least one whole millisecond');
  }

  return {
    next: after => {
      const instant = after.getTime();

      if (Number.isNaN(instant)) {
        throw new RangeError('an interval schedule requires a valid Date to advance from');
      }

      const occurrence = Math.floor(instant / period) * period + period;

      return occurrence > MAXIMUM_INSTANT_IN_MILLISECONDS ? null : new Date(occurrence);
    },
  };
};

/*****************************************************************************************************************/

// The cadence: how many of a unit between occurrences. Counts may be fractional, half an hour being a legal way
// to say thirty minutes, but zero, negative and non-finite counts are refused loudly here rather than becoming
// a schedule that never advances.
export const every = (count: number): Interval => {
  if (!Number.isFinite(count) || count <= 0) {
    throw new RangeError('every() requires a finite count greater than zero');
  }

  return {
    minutes: () => aligned(count * MILLISECONDS_IN_MINUTE),
    hours: () => aligned(count * MILLISECONDS_IN_HOUR),
  };
};

/*****************************************************************************************************************/
