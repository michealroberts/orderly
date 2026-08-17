/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/events
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

// The four terminal outcomes of consuming a message. Every message a consumer receives resolves to exactly one
// of these, always explicitly: a message that is never decided is the failure mode this type exists to remove.
// The word ack appears nowhere here deliberately. succeeded and discarded both acknowledge the message at the
// transport while meaning opposite things, and collapsing them into one word is precisely the information a raw
// consumer erases. retried carries the decided delay, with zero meaning redelivery as soon as the platform
// allows. rejected means the body failed validation and never reached the handler at all, and carries whatever
// the schema threw, which orderly does not own and so cannot narrow.
export type Outcome =
  | { type: 'succeeded' }
  | { type: 'retried'; delaySeconds: number }
  | { type: 'discarded'; reason: string }
  | { type: 'rejected'; error: unknown };

/*****************************************************************************************************************/
