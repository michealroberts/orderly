/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/schedules
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import type { Schedule } from './contract';

/*****************************************************************************************************************/

// A schedule with the occurrences another schedule names taken out: the subtraction RFC 5545 makes when it
// removes exception dates from a recurrence set, where an instant is excluded only when it is named exactly,
// to the millisecond. It skips the holiday a daily rule would otherwise fire on, or the hours of a weekly
// maintenance window an hourly rule ticks through; skipping a span of time is a different sentence.

/*****************************************************************************************************************/

// How many excluded occurrences in a row the walk passes before calling the schedule exhausted. An exclusion
// naming every occurrence of what it excludes, a schedule excluded from itself being the plainest, would
// otherwise be searched forever, so a run this long is read as no occurrence left rather than searched on.
const EXCLUSION_LIMIT = 10_000;

/*****************************************************************************************************************/

// Whether the exclusion names the occurrence: its first occurrence after the millisecond before is that very
// instant. The millisecond before is always a Date, because an occurrence lies strictly after one.
const excluded = (exclusion: Schedule, occurrence: Date): boolean => {
  const instant = occurrence.getTime();

  return exclusion.next(new Date(instant - 1))?.getTime() === instant;
};

/*****************************************************************************************************************/

// The schedule less the occurrences the exclusion names: each occurrence of the first is kept unless the
// second names the same instant, in which case the walk moves on from it.
export const exclude = (schedule: Schedule, exclusion: Schedule): Schedule => {
  return {
    next: after => {
      if (Number.isNaN(after.getTime())) {
        throw new RangeError('an exclusion requires a valid Date to advance from');
      }

      let cursor = after;

      for (let passed = 0; passed < EXCLUSION_LIMIT; passed += 1) {
        const occurrence = schedule.next(cursor);

        if (occurrence === null) {
          return null;
        }

        if (!excluded(exclusion, occurrence)) {
          return occurrence;
        }

        cursor = occurrence;
      }

      return null;
    },
  };
};

/*****************************************************************************************************************/
