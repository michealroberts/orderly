/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/schedules
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

// The one contract every schedule reduces to. next(after) returns the first occurrence strictly after the
// instant given — strictly, so re-arming from a fired occurrence can never return that occurrence again — and
// null once the schedule is exhausted, meaning no occurrence will ever follow and nothing should re-arm.
// Implementations must be pure: the same instant in always yields the same answer out, because everything
// downstream, from previews to alarms, replays this method and trusts it not to drift.
export interface Schedule {
  next: (after: Date) => Date | null;
}

/*****************************************************************************************************************/
