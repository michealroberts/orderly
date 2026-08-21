/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/consumer
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

// What a handler may know about a delivery. The transport verbs are deliberately absent: the consumer settles
// every message itself, exactly once, from what the handler returns or throws, so ack() and retry() can never
// be called twice, in conflict, or not at all.
export interface MessageContext {
  // The platform's identifier for the message.
  readonly id: string;
  // 1-based: the delivery being handled right now, counting every one before it.
  readonly attempts: number;
  // When the message was enqueued.
  readonly timestamp: Date;
  // The queue the batch was received from.
  readonly queue: string;
  // Fires when the batch is being torn down and the handler should stop early.
  readonly signal: AbortSignal;
}

/*****************************************************************************************************************/
