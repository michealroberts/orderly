---
'@observerly/orderly': minor
---

Add parseCron() to the schedules module: the crontab notation as Cloudflare's cron triggers read it, five fields with lists, ranges, steps and names, weekday digits counted 1 through 7 from Sunday and normalized to the module's Monday first numbering, refusing the Quartz extensions loudly.
