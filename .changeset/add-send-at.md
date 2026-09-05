---
'@observerly/orderly': minor
---

Add an at option to a producer's send(): the message is held back until the instant given, rounded up so it never arrives early, and refused rather than clamped when the instant lies further away than a queue holds a message back.
