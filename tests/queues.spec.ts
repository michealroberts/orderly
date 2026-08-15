/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { createExecutionContext, createMessageBatch, getQueueResult } from 'cloudflare:test';

import { env } from 'cloudflare:workers';

import { describe, expect, it } from 'vitest';

/*****************************************************************************************************************/

// A stand-in consumer. orderly's middleware does not exist yet, so this exists
// only to prove the harness can observe ack and retry decisions at all. When
// the middleware lands it replaces this, and the assertions below still hold.
const consume = (batch: MessageBatch): void => {
  for (const message of batch.messages) {
    if (String(message.body).startsWith('retry')) {
      message.retry();
    } else {
      message.ack();
    }
  }
};

/*****************************************************************************************************************/

describe('queue producer binding', () => {
  it('accepts a message sent through the binding', async () => {
    // send resolves with the queue's realtime metrics rather than void, so a
    // defined result is what confirms the binding is wired and accepting.
    await expect(env.QUEUE.send({ hello: 'world' })).resolves.toBeDefined();
  });
});

/*****************************************************************************************************************/

describe('queue consumer harness', () => {
  it('observes per message ack and retry decisions', async () => {
    const batch = createMessageBatch('orderly', [
      { id: 'message-1', timestamp: new Date(1000), body: 'ack-me', attempts: 1 },
      { id: 'message-2', timestamp: new Date(2000), body: 'retry-me', attempts: 1 },
    ]);

    const context = createExecutionContext();

    consume(batch);

    const result = await getQueueResult(batch, context);

    expect(result.explicitAcks).toStrictEqual(['message-1']);

    // Retry entries carry only msgId. A delaySeconds passed to retry() is not
    // reflected here, so this harness can prove that a message was retried but
    // not with what backoff. Asserting on delay needs a spy over retry itself.
    expect(result.retryMessages).toStrictEqual([{ msgId: 'message-2' }]);

    expect(result.ackAll).toBe(false);
    expect(result.retryBatch).toMatchObject({ retry: false });
  });

  it('observes a batch level retry', async () => {
    const batch = createMessageBatch('orderly', [
      { id: 'message-1', timestamp: new Date(1000), body: 'anything', attempts: 1 },
    ]);

    const context = createExecutionContext();

    batch.retryAll();

    const result = await getQueueResult(batch, context);

    expect(result.retryBatch).toMatchObject({ retry: true });
    expect(result.ackAll).toBe(false);
    expect(result.explicitAcks).toStrictEqual([]);
  });
});

/*****************************************************************************************************************/
