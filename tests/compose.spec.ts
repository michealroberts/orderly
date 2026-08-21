/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { compose, type MessageContext, type Middleware, type Outcome } from '../src/index';

/*****************************************************************************************************************/

const succeeded: Outcome = { type: 'succeeded' };

const context: MessageContext = {
  id: 'm1',
  attempts: 1,
  timestamp: new Date(0),
  queue: 'orderly',
  signal: new AbortController().signal,
};

const terminal = () => Promise.resolve(succeeded);

const recording = (order: string[], name: string): Middleware<string> => {
  return async (_message, _innerContext, next) => {
    order.push(`${name} before`);

    const outcome = await next();

    order.push(`${name} after`);

    return outcome;
  };
};

/*****************************************************************************************************************/

describe('compose order and identity', () => {
  it('runs the first layer outermost and the terminal innermost', async () => {
    const order: string[] = [];

    const chain = compose([recording(order, 'outer'), recording(order, 'inner')]);

    await expect(
      chain('body', context, () => {
        order.push('terminal');

        return Promise.resolve(succeeded);
      }),
    ).resolves.toStrictEqual(succeeded);

    expect(order).toStrictEqual([
      'outer before',
      'inner before',
      'terminal',
      'inner after',
      'outer after',
    ]);
  });

  it('is the identity for an empty list', async () => {
    const chain = compose([]);

    await expect(chain('body', context, terminal)).resolves.toStrictEqual(succeeded);
  });

  it('accepts synchronous layers', async () => {
    const chain = compose<string>([() => ({ type: 'discarded', reason: 'sync' })]);

    await expect(chain('body', context, terminal)).resolves.toStrictEqual({
      type: 'discarded',
      reason: 'sync',
    });
  });
});

/*****************************************************************************************************************/

describe('compose substitution and misuse', () => {
  it('lets a layer substitute the outcome the inner layers produced', async () => {
    const chain = compose<string>([
      async (_message, _innerContext, next) => {
        await next();

        return { type: 'retried', delaySeconds: 60 };
      },
    ]);

    await expect(chain('body', context, terminal)).resolves.toStrictEqual({
      type: 'retried',
      delaySeconds: 60,
    });
  });

  it('never reaches the terminal when a layer does not call next', async () => {
    let reached = false;

    const chain = compose<string>([() => succeeded]);

    await chain('body', context, () => {
      reached = true;

      return Promise.resolve(succeeded);
    });

    expect(reached).toBe(false);
  });

  it('rejects when a layer calls next twice', async () => {
    const chain = compose<string>([
      async (_message, _innerContext, next) => {
        await next();

        return await next();
      },
    ]);

    await expect(chain('body', context, terminal)).rejects.toThrow(
      'next() was called twice in the same middleware layer',
    );
  });
});

/*****************************************************************************************************************/
