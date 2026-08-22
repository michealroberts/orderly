---
'@observerly/orderly': minor
---

Add schema validation to createConsumer: a schema option accepting any Standard Schema or a plain parse function, with failing bodies settled as rejected before they reach the middleware or the handler, and an onRejected decision to convert a rejection into a discard or a clamped retry.
