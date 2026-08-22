/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/consumer
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import type { Event } from '../events/index';

import { MAXIMUM_DELAY_SECONDS, type RetryDecision } from '../retry/index';

import type { MessageContext } from './context';

import type { StandardSchema } from '../schema/index';

import { applyOutcome } from './transport';

/*****************************************************************************************************************/

// What validates a body: any Standard Schema, or a plain function that returns the parsed value and throws on a
// bad one.
export type BodySchema<Body> = StandardSchema<unknown, Body> | ((value: unknown) => Body);

/*****************************************************************************************************************/

// What to do about a rejection.
export type RejectionDecider = (rejection: {
  raw: unknown;
  error: unknown;
  context: MessageContext;
}) => RetryDecision;

/*****************************************************************************************************************/

// Normalizes both schema forms to one never-throwing parse. A failing Standard Schema hands back its issues; a
// throwing function or a rejecting async validate hands back what it threw.
export const parseBody = async <Body>(
  schema: BodySchema<Body>,
  value: unknown,
): Promise<{ parsed: true; value: Body } | { parsed: false; error: unknown }> => {
  try {
    if (typeof schema === 'function') {
      return { parsed: true, value: schema(value) };
    }

    const result = await schema['~standard'].validate(value);

    if (result.issues === undefined) {
      return { parsed: true, value: result.value };
    }

    return { parsed: false, error: result.issues };
  } catch (error) {
    return { parsed: false, error };
  }
};

/*****************************************************************************************************************/

// The rejection path: the fact is always the rejected event, and the default outcome acknowledges it as its own
// terminal. onRejected can convert the rejection into an explicit discard, or a retry for the case where the
// schema deploying is what made the body invalid, with the delay clamped exactly as settle clamps a policy's.
export const settleRejection = (
  message: Message,
  error: unknown,
  context: MessageContext,
  emit: (event: Event) => void,
  onRejected: RejectionDecider | undefined,
): void => {
  const { id } = message;

  emit({ type: 'message.rejected', id, at: Date.now() });

  let decision: RetryDecision | null = null;

  if (onRejected !== undefined) {
    try {
      decision = onRejected({ raw: message.body, error, context });
    } catch {
      // A throwing observer must never affect settlement; the default stands.
    }
  }

  if (decision === null) {
    applyOutcome(message, { type: 'rejected', error });

    return;
  }

  if (decision.action === 'discard') {
    emit({ type: 'message.discarded', id, reason: decision.reason, at: Date.now() });

    applyOutcome(message, { type: 'discarded', reason: decision.reason });

    return;
  }

  const delaySeconds = Math.floor(
    Math.max(Math.min(decision.delaySeconds, MAXIMUM_DELAY_SECONDS), 0),
  );

  emit({ type: 'message.retried', id, delaySeconds, at: Date.now() });

  applyOutcome(message, { type: 'retried', delaySeconds });
};

/*****************************************************************************************************************/

// Resolves what the chain and the handler will see: the raw body when no schema is configured, the parsed value
// when one is, and no body at all when parsing fails, in which case the message has already settled.
export const resolveBody = async <Body>(
  message: Message,
  schema: BodySchema<Body> | undefined,
  context: MessageContext,
  emit: (event: Event) => void,
  onRejected: RejectionDecider | undefined,
): Promise<{ proceed: true; body: Body } | { proceed: false }> => {
  if (schema === undefined) {
    // The raw trust path: without a schema, the consumer's word is taken for the wire type, and this assertion
    // is that promise made visible.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return { proceed: true, body: message.body as Body };
  }

  const attempt = await parseBody(schema, message.body);

  if (attempt.parsed) {
    return { proceed: true, body: attempt.value };
  }

  settleRejection(message, attempt.error, context, emit, onRejected);

  return { proceed: false };
};

/*****************************************************************************************************************/
