# @observerly/orderly

## 0.1.0

### Minor Changes

- [#23](https://github.com/michealroberts/orderly/pull/23) [`cdc476a`](https://github.com/michealroberts/orderly/commit/cdc476a4e5733182c9195ee237d91f1912900845) Thanks [@michealroberts](https://github.com/michealroberts)! - Add the Outcome type to the events module: the four terminal outcomes a consumed message resolves to (succeeded, retried, discarded, rejected).

- [#25](https://github.com/michealroberts/orderly/pull/25) [`ac2bb53`](https://github.com/michealroberts/orderly/commit/ac2bb538a68e1fdb363e5e425fee61c4fdd6b12e) Thanks [@michealroberts](https://github.com/michealroberts)! - Add the Event envelope to the events module: the closed union of facts a consumer emits (batch.received, message.started, and the five terminal events mirroring Outcome).

- [#26](https://github.com/michealroberts/orderly/pull/26) [`f63f9ca`](https://github.com/michealroberts/orderly/commit/f63f9ca72e352a94ec85ca1eafcdda9f37e317bd) Thanks [@michealroberts](https://github.com/michealroberts)! - Add statusOf() to the events module: status derived from an event log on every read, with the latest event per message deciding its state, never stored.

- [#27](https://github.com/michealroberts/orderly/pull/27) [`b281522`](https://github.com/michealroberts/orderly/commit/b281522917f38f9c5b093af74092edd7b4181016) Thanks [@michealroberts](https://github.com/michealroberts)! - Add the RetryPolicy and RetryDecision types and the platform delay ceiling to the retry module.

- [#28](https://github.com/michealroberts/orderly/pull/28) [`e729f3c`](https://github.com/michealroberts/orderly/commit/e729f3cf2d1c0262947799a0f98d216fb49ef90d) Thanks [@michealroberts](https://github.com/michealroberts)! - Add withExponentialRetryBackoff() to the retry module: exponential backoff with an attempt limit, full jitter with injectable randomness, and delays capped at the platform ceiling.

- [#29](https://github.com/michealroberts/orderly/pull/29) [`58d6cdc`](https://github.com/michealroberts/orderly/commit/58d6cdc5f7bac28afa4a04d776ec9158ce5a1cdb) Thanks [@michealroberts](https://github.com/michealroberts)! - Add withFixedRetryBackoff() to the retry module: the same delay before every retry, with an optional attempt limit and the platform ceiling applied.

- [#30](https://github.com/michealroberts/orderly/pull/30) [`bdf1dd3`](https://github.com/michealroberts/orderly/commit/bdf1dd339f2764e359ffee5fe6959c5fd34c7a8a) Thanks [@michealroberts](https://github.com/michealroberts)! - Add withImmediateRetry() to the retry module: redelivery as soon as the platform allows, with an optional attempt limit.

- [#31](https://github.com/michealroberts/orderly/pull/31) [`e3e99d2`](https://github.com/michealroberts/orderly/commit/e3e99d28b59f675188ec060844b95002446dd290) Thanks [@michealroberts](https://github.com/michealroberts)! - Add withoutRetry() to the retry module: any throw discards the message deliberately, for work that is not safe to repeat.

- [#33](https://github.com/michealroberts/orderly/pull/33) [`c7f3f36`](https://github.com/michealroberts/orderly/commit/c7f3f3613d38919c0eb923109cd3cc3c7b9a932e) Thanks [@michealroberts](https://github.com/michealroberts)! - Add the MessageContext type to the consumer module: the delivery facts a handler may know, with the transport verbs deliberately absent.

- [#34](https://github.com/michealroberts/orderly/pull/34) [`ffbdc77`](https://github.com/michealroberts/orderly/commit/ffbdc7752e79647663512cc73966af8439ca6d62) Thanks [@michealroberts](https://github.com/michealroberts)! - Add compose() to the middleware module: folds a list of layers into one, outermost first, with double next() calls rejected.

- [#34](https://github.com/michealroberts/orderly/pull/34) [`0f44f66`](https://github.com/michealroberts/orderly/commit/0f44f665a5771c4c49f6181bca1abcbbb297a558) Thanks [@michealroberts](https://github.com/michealroberts)! - Add the Middleware type to the middleware module: one layer around one message, observing or substituting the outcome the inner layers produced.

- [#35](https://github.com/michealroberts/orderly/pull/35) [`3f4d3aa`](https://github.com/michealroberts/orderly/commit/3f4d3aab9286d4982a2d5ca026aacdc92db5a026) Thanks [@michealroberts](https://github.com/michealroberts)! - Add settle() to the consumer module: turns what a handler did into exactly one terminal outcome and its events, purely, with policy delays clamped and throwing policies contained.

- [#36](https://github.com/michealroberts/orderly/pull/36) [`9a7a9b3`](https://github.com/michealroberts/orderly/commit/9a7a9b3cfb587bd4b81580f13482f86b10e4064c) Thanks [@michealroberts](https://github.com/michealroberts)! - Add applyOutcome() to the consumer module: the one place an Outcome touches the transport, exactly one verb call per message.

- [#37](https://github.com/michealroberts/orderly/pull/37) [`7889c82`](https://github.com/michealroberts/orderly/commit/7889c82ae34f2e8f9e94712c4467755fcefb4495) Thanks [@michealroberts](https://github.com/michealroberts)! - Add bounded concurrency to createConsumer: a concurrency option settling at most that many messages at once, with 1 meaning one at a time in batch order and absent meaning the whole batch together.

- [#38](https://github.com/michealroberts/orderly/pull/38) [`d7197a8`](https://github.com/michealroberts/orderly/commit/d7197a8035bb91a4dc1f9bcbe64919a18189bfb6) Thanks [@michealroberts](https://github.com/michealroberts)! - Add createConsumer() to the consumer module: per-message isolation, the middleware chain around a settling terminal, exactly one transport verb per message, and an event for everything. The returned handler never rejects.

- [#39](https://github.com/michealroberts/orderly/pull/39) [`eafcb76`](https://github.com/michealroberts/orderly/commit/eafcb76e8aeb6f14b42ffcf4d556e75df535030e) Thanks [@michealroberts](https://github.com/michealroberts)! - Add the StandardSchema type family to the schema module: the Standard Schema v1 interface declared structurally, so any conforming validation library is accepted without orderly depending on one.

- [#40](https://github.com/michealroberts/orderly/pull/40) [`272ccd2`](https://github.com/michealroberts/orderly/commit/272ccd29e0915f7d5041d4d2d3e16a7ff54ef5bc) Thanks [@michealroberts](https://github.com/michealroberts)! - Add schema validation to createConsumer: a schema option accepting any Standard Schema or a plain parse function, with failing bodies settled as rejected before they reach the middleware or the handler, and an onRejected decision to convert a rejection into a discard or a clamped retry.

- [#41](https://github.com/michealroberts/orderly/pull/41) [`f8de98f`](https://github.com/michealroberts/orderly/commit/f8de98fd465d58013dfb5eb55e17bc4dbfbb0167) Thanks [@michealroberts](https://github.com/michealroberts)! - Add createProducer() to the queues module: the typed producing end, with delays clamped to the platform bounds and an optional schema that refuses to enqueue a bad body.

- [#42](https://github.com/michealroberts/orderly/pull/42) [`b8114be`](https://github.com/michealroberts/orderly/commit/b8114be8ed9ad62400de74bcd323bbb226401529) Thanks [@michealroberts](https://github.com/michealroberts)! - Add defineQueue() to the queues module: the shared contract declaring the payload type and schema once, with the producing and consuming ends derived from it so neither side can drift alone.

- [#43](https://github.com/michealroberts/orderly/pull/43) [`d8c37f4`](https://github.com/michealroberts/orderly/commit/d8c37f49c8de5f4d3dde73868e0e8a9be2b0eecc) Thanks [@michealroberts](https://github.com/michealroberts)! - Rename lagMs to lagInMilliseconds and durationMs to durationInMilliseconds across the Event envelope and the onBatch facts. Breaking for consumers reading either field.
