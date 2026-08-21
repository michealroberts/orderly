---
'@observerly/orderly': minor
---

Add createConsumer() to the consumer module: per-message isolation, the middleware chain around a settling terminal, exactly one transport verb per message, and an event for everything. The returned handler never rejects.
