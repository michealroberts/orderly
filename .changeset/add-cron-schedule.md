---
'@observerly/orderly': minor
---

Add cron() to the schedules module: a crontab expression as a schedule, read in any timezone, following classic cron's rule that a written day of month and day of week match a day when either matches, and ordering each day's occurrences so daylight saving can neither skip nor repeat one.
