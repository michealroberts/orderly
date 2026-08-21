/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/middleware
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import type { MessageContext } from '../consumer/index';

import type { Outcome } from '../events/index';

/*****************************************************************************************************************/

// One layer around one message. A middleware sees the parsed body and the delivery facts, awaits next() for the
// outcome the layers inside it produced, and returns an outcome of its own, which is usually the same one passed
// straight through. Returning a different outcome substitutes the decision, which is how a layer implements
// concerns like rate limiting without touching the transport. The chain runs outermost first, per message, and
// next() is only callable once per layer.
export type Middleware<Body = unknown> = (
  message: Body,
  context: MessageContext,
  next: () => Promise<Outcome>,
) => Outcome | Promise<Outcome>;

/*****************************************************************************************************************/
