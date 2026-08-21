/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/consumer
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import type { Outcome } from '../events/index';

/*****************************************************************************************************************/

// The one place in orderly that touches the transport verbs. succeeded, discarded and rejected all acknowledge,
// which is three meanings behind one platform verb: the distinction lives in the events, never the transport.
// Every branch returns after exactly one verb call, so a message can never be settled twice from here.
export const applyOutcome = (message: Message, outcome: Outcome): void => {
  switch (outcome.type) {
    case 'succeeded':
    case 'discarded':
    case 'rejected': {
      message.ack();

      return;
    }
    case 'retried': {
      message.retry({ delaySeconds: outcome.delaySeconds });
    }
  }
};

/*****************************************************************************************************************/
