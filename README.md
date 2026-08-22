# orderly

Single file, no pushing. Type-safe middleware that brings a little bit of order to Cloudflare Queues.

orderly removes the two failure modes every raw queue consumer carries: messages that are never
decided, and one bad message crashing a whole batch. Every message resolves to exactly one explicit
outcome, every outcome is recorded as an event, and the consumer never rejects. Zero runtime
dependencies.

## Installation

```sh
pnpm add @observerly/orderly
```

```sh
npm install @observerly/orderly
```

```sh
nub add @observerly/orderly
```

```sh
bun add @observerly/orderly
```

## Quick Start

Declare the payload once, and derive both ends from it:

```ts
// contracts/emails.ts
import { defineQueue } from '@observerly/orderly';

import { z } from 'zod';

const payload = z.object({
  userId: z.string(),
  kind: z.enum(['welcome', 'digest', 'receipt']),
});

export type EmailPayload = z.infer<typeof payload>;

// Any Standard Schema library plugs in: zod, valibot, arktype, or a plain function that throws.
export const emails = defineQueue<EmailPayload>({ name: 'emails', schema: payload });
```

```ts
// worker.ts
import { withExponentialRetryBackoff } from '@observerly/orderly';

import { emails } from './contracts/emails';

export default {
  async fetch(request, env) {
    const producer = emails.producer(env.EMAILS);

    await producer.send({ userId: '42', kind: 'welcome' });

    await producer.send({ userId: '42', kind: 'digest' }, { delaySeconds: 3_600 });

    return new Response('enqueued', { status: 202 });
  },

  queue: emails.consumer({
    retry: withExponentialRetryBackoff({
      initialDelaySeconds: 5,
      factor: 2,
      maximumDelaySeconds: 600,
      jitter: 'full',
      limit: 6,
    }),

    async handle(message, context) {
      // message is a parsed EmailPayload: validated before this ran.
      // Return settles the message as succeeded; throw and the retry policy decides.
    },
  }),
} satisfies ExportedHandler<Cloudflare.Env>;
```

```jsonc
// wrangler.jsonc
{
  "queues": {
    "producers": [{ "binding": "EMAILS", "queue": "emails" }],
    "consumers": [{ "queue": "emails", "max_batch_size": 25, "max_retries": 10 }],
  },
}
```

No `ack()`, no `retry()`, no batch bookkeeping, no try/catch ceremony. The handler returns or
throws, the policy decides, the events record it, and a malformed body never reaches your code.

## The Settlement Model

Every message a consumer receives resolves to exactly one of four terminal outcomes, always
explicitly:

- **succeeded** — the handler returned. Acknowledged.
- **retried** — the handler threw and the retry policy scheduled a redelivery, with the delay it
  decided.
- **discarded** — the handler threw and the policy chose to stop. Acknowledged deliberately, with
  the reason recorded. A discard never reaches the dead letter queue: that catches only messages
  which exhausted the platform's own `max_retries`.
- **rejected** — the body failed validation and never reached the handler at all.

The word ack appears nowhere in orderly's vocabulary: succeeded and discarded both acknowledge at
the transport while meaning opposite things, and that distinction living in the events rather than
the transport is the point.

The consumer itself never rejects, because a rejected queue handler makes the platform retry the
whole batch, acknowledged messages included. One message failing, one middleware throwing, or one
observer exploding never touches a sibling's settlement.

## Retry Policies

A policy is a pure function from what happened to what to do about it:

```ts
import {
  withExponentialRetryBackoff,
  withFixedRetryBackoff,
  withImmediateRetry,
  withoutRetry,
} from '@observerly/orderly';

withExponentialRetryBackoff({
  initialDelaySeconds: 1,
  factor: 2,
  maximumDelaySeconds: 300,
  jitter: 'full',
  limit: 8,
});
withFixedRetryBackoff({ delaySeconds: 30, limit: 5 });
withImmediateRetry({ limit: 3 });
withoutRetry();
```

Or write your own — delays are floored and clamped into the platform bounds for you, and a policy
that itself throws discards rather than crashing the batch:

```ts
import type { RetryPolicy } from '@observerly/orderly';

const policy: RetryPolicy = ({ attempts, error }) =>
  attempts >= 5
    ? { action: 'discard', reason: 'exhausted' }
    : { action: 'retry', delaySeconds: 2 ** attempts };
```

## Middleware

One layer around one message, outermost first. A middleware sees the parsed body and the delivery
facts, awaits the outcome the layers inside it produced, and may pass it through or substitute it:

```ts
import type { Middleware } from '@observerly/orderly';

const timing = (): Middleware => async (message, context, next) => {
  const startedAt = Date.now();

  const outcome = await next();

  console.log(`${context.id} settled as ${outcome.type} in ${Date.now() - startedAt}ms`);

  return outcome;
};
```

## Validation

The `schema` option accepts any [Standard Schema](https://standardschema.dev) or a plain parse
function. A failing body settles as rejected before the middleware or the handler ever see it, and
`onRejected` decides what a rejection becomes:

```ts
emails.consumer({
  retry: withoutRetry(),
  handle: deliver,
  // Absent: rejections are acknowledged as their own terminal. Or convert them:
  onRejected: () => ({ action: 'retry', delaySeconds: 60 }),
});
```

## Observability

Every decision emits an event, and status is derived from the event log rather than stored:

```ts
import { statusOf, type Event } from '@observerly/orderly';

const events: Event[] = [];

emails.consumer({
  retry: withoutRetry(),
  handle: deliver,
  onEvent: event => events.push(event),
  onBatch: ({ queue, size, lagInMilliseconds, backlogCount, backlogBytes }) => {},
});

statusOf(events); // 'pending' | 'running' | 'succeeded' | 'failed'
```

The vocabulary is closed: `batch.received`, `message.started`, then a terminal mirror of the
outcome for every message, with failures recorded as fact then decision.

## Requirements

orderly runs on [workerd](https://github.com/cloudflare/workerd) and is tested inside it. It ships
as ESM with TypeScript declarations, requires nothing at runtime, and follows Standard Schema
rather than depending on any validation library.

## Contributing

orderly runs on workerd rather than Node, which shapes how it is built and tested. See
[CONTRIBUTING.md](CONTRIBUTING.md) to get set up.

## Releasing

Changes that consumers would notice need a changeset, and releases happen by pushing a version tag.
See [RELEASING.md](RELEASING.md).

## License

[MIT](LICENSE) © 2026 observerly
