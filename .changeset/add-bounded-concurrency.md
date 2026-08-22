---
'@observerly/orderly': minor
---

Add bounded concurrency to createConsumer: a concurrency option settling at most that many messages at once, with 1 meaning one at a time in batch order and absent meaning the whole batch together.
