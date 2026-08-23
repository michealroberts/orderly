/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/schedules
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import type { Schedule } from './contract';

/*****************************************************************************************************************/

export interface PreviewOptions {
  // The instant to walk from, exclusive: the first occurrence returned is strictly after it.
  after: Date;
  // How many occurrences to return at most; a schedule that exhausts first returns fewer. Floored, never below
  // zero, and a value that is not finite means none, because a never-exhausting schedule would walk forever.
  take: number;
}

/*****************************************************************************************************************/

// The dry run: walks next() from the instant given, each occurrence becoming the cursor for the one after it.
// A schedule whose occurrence fails to advance past its cursor is broken, and this is the debugging tool, so it
// says so loudly rather than looping forever.
export const preview = (schedule: Schedule, options: PreviewOptions): Date[] => {
  const { after, take } = options;

  if (Number.isNaN(after.getTime())) {
    throw new RangeError('preview() requires a valid after Date');
  }

  const count = Number.isFinite(take) ? Math.max(Math.floor(take), 0) : 0;

  const occurrences: Date[] = [];

  let cursor = after;

  while (occurrences.length < count) {
    const occurrence = schedule.next(cursor);

    if (occurrence === null) {
      break;
    }

    if (occurrence.getTime() <= cursor.getTime()) {
      throw new RangeError('preview() was handed a schedule whose occurrences do not advance');
    }

    occurrences.push(occurrence);

    cursor = occurrence;
  }

  return occurrences;
};

/*****************************************************************************************************************/
