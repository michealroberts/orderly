---
'@observerly/orderly': minor
---

Add the at option to a producer's sendBatch(): every body in the batch is held back until the instant given, read the way send() reads it, rounded up so none arrives early and refused rather than clamped when the instant lies further away than a queue holds a message back.
