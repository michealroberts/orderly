/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/schedules
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import type { Schedule } from './contract';

/*****************************************************************************************************************/

// The earliest next occurrence across several schedules: a union fires whenever any member does, and exhausts
// only once every member has. Two members naming the same instant fire once, because the union answers with
// the instant rather than with who named it. An empty list is the identity, a schedule with no occurrences,
// the way compose() reads an empty list of layers. The list is copied, so a union stays pure however the list
// it was built from is changed afterwards.
export const union = (schedules: readonly Schedule[]): Schedule => {
  const members = [...schedules];

  return {
    next: after => {
      if (Number.isNaN(after.getTime())) {
        throw new RangeError('a union requires a valid Date to advance from');
      }

      let earliest: Date | null = null;

      for (const member of members) {
        const occurrence = member.next(after);

        if (
          occurrence !== null &&
          (earliest === null || occurrence.getTime() < earliest.getTime())
        ) {
          earliest = occurrence;
        }
      }

      return earliest;
    },
  };
};

/*****************************************************************************************************************/
