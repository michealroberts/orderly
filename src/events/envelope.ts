/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/events
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

// Every fact orderly emits is one of these, named `<noun>.<verb, past tense>`: two facts about progress, being
// batch.received (with lagInMilliseconds measured from the enqueue time of the oldest message in the batch) and
// message.started, and five terminal facts that mirror the Outcome union one to one. message.failed records a
// throw itself; the retried or discarded event that follows records the decision taken about it, so a failing
// message always emits two events. Timestamps are epoch milliseconds rather than Dates because events are
// records rather than API inputs: they cross serialization boundaries on their way to sinks, and a record must
// survive JSON without a reviver. For the same reason message.failed carries a serializable snapshot of the
// thrown error rather than the value itself.
export type Event =
  | { type: 'batch.received'; queue: string; size: number; lagInMilliseconds: number; at: number }
  | { type: 'message.started'; id: string; attempts: number; at: number }
  | { type: 'message.succeeded'; id: string; durationInMilliseconds: number; at: number }
  | {
      type: 'message.failed';
      id: string;
      error: { name: string; message: string; stack?: string };
      at: number;
    }
  | { type: 'message.retried'; id: string; delaySeconds: number; at: number }
  | { type: 'message.discarded'; id: string; reason: string; at: number }
  | { type: 'message.rejected'; id: string; at: number };

/*****************************************************************************************************************/
