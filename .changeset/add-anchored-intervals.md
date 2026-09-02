---
'@observerly/orderly': minor
---

Add at().every() to the schedules module: fixed cadences in minutes or hours counted from the anchored instant rather than the Unix epoch, the anchor the first occurrence, exact to the millisecond across the whole range a Date can hold. at().once() now refuses an invalid Date to advance from, as every other schedule does, rather than answering with exhaustion.
