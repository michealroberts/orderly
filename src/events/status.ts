/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/events
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import type { Event } from './envelope';

/*****************************************************************************************************************/

export type Status = 'pending' | 'running' | 'succeeded' | 'failed';

/*****************************************************************************************************************/

// Status is derived from the event log on every read and is never written down: a stored status goes stale the
// moment an isolate dies mid message, which is exactly the case that matters. The latest event for each message
// decides that message's state, never set membership across its history, because a message that settled and then
// started again is a redelivery in flight, whatever its history says. The log's array order is authoritative and
// no sorting by timestamp happens here: two events can share a millisecond, and append order is what the log
// means. From those per-message states the aggregate reads: any message whose latest event is a failure with no
// decision recorded yet means failed, any message still in flight (started, or retried and awaiting redelivery)
// means running, every message settled (succeeded, discarded or rejected, which are three deliberate terminals,
// not three failures) means succeeded, and an empty log means pending. batch.received carries no subject, so it
// never influences status.
// The disable that follows is scoped and deliberate: prefer-readonly-parameter-types wants readonly on every
// nested envelope field, which is the Event type's own concern. readonly Event[] states the real contract here,
// being that the log is read and never mutated.
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
export const statusOf = (events: readonly Event[]): Status => {
  const latest = new Map<string, Event['type']>();

  for (const event of events) {
    if (event.type === 'batch.received') {
      continue;
    }

    latest.set(event.id, event.type);
  }

  if (latest.size === 0) {
    return 'pending';
  }

  const kinds = [...latest.values()];

  if (kinds.some(kind => kind === 'message.failed')) {
    return 'failed';
  }

  if (kinds.some(kind => kind === 'message.started' || kind === 'message.retried')) {
    return 'running';
  }

  return 'succeeded';
};

/*****************************************************************************************************************/
