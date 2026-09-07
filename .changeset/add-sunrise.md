---
'@observerly/orderly': minor
---

Add sunrise(observer), a schedule of the sunrises seen from a place on Earth, resolved with @observerly/astrometry to the standard almanac convention: latitude, longitude and an optional elevation in metres are validated up front, each next occurrence lies strictly after the instant asked from, the days of a polar day or a polar night are walked past, and the schedule exhausts where no sunrise falls within four hundred days, as at the poles.
