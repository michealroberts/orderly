---
'@observerly/orderly': minor
---

Add parseRecurrenceRule() to the schedules module: the recurrence rule notation of RFC 5545 read into the subset the module honours, weekdays normalized to Monday first numbering and ordinal occurrences kept, refusing by name every part it does not support rather than quietly widening a rule.
