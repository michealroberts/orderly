/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/schedules
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import type { ParsedRecurrenceRule } from './recurrence';

/*****************************************************************************************************************/

// What a parsed rule must not say before it can become a schedule: the combinations RFC 5545 forbids, and the
// one ceiling this module imposes of its own. Each is refused at construction rather than read into something
// the notation does not mean.

/*****************************************************************************************************************/

// The largest count this module will honour. COUNT is an ordinal from the anchor, so answering anything about
// a counted rule means walking it from the beginning, and the walk costs a search for every occurrence it
// passes: a rule spent long ago takes the whole count to prove itself finished, which at this ceiling is
// measured in seconds rather than milliseconds. A rule counting past it is refused rather than quietly
// exhausting early, which would be a schedule that lies about when it ends.
export const COUNT_LIMIT = 10_000;

/*****************************************************************************************************************/

export const validated = (rule: ParsedRecurrenceRule): ParsedRecurrenceRule => {
  if (rule.frequency === 'weekly' && rule.daysOfMonth !== null) {
    throw new RangeError('BYMONTHDAY cannot narrow a weekly rule');
  }

  const counts = rule.daysOfWeek?.some(entry => entry.ordinal !== null) ?? false;

  if (counts && rule.frequency !== 'monthly' && rule.frequency !== 'yearly') {
    throw new RangeError('BYDAY counts occurrences only in a monthly or yearly rule');
  }

  if (counts && rule.daysOfMonth !== null) {
    throw new RangeError('BYDAY cannot count occurrences while BYMONTHDAY narrows the same rule');
  }

  if (rule.count !== null && rule.count > COUNT_LIMIT) {
    throw new RangeError(`COUNT is honoured up to ${COUNT_LIMIT}: got ${rule.count}`);
  }

  return rule;
};

/*****************************************************************************************************************/
