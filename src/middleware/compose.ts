/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/middleware
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import type { Outcome } from '../events/index';

import type { Middleware } from './middleware';

/*****************************************************************************************************************/

// Folds a list of layers into one. The first layer is outermost, an empty list is the identity, and a layer
// that never calls next() short-circuits everything inside it. Calling next() twice in one layer rejects: a
// layer that runs its inner chain twice would settle one message twice.
export const compose = <Body>(middlewares: readonly Middleware<Body>[]): Middleware<Body> => {
  return (message, context, next) => {
    const dispatch = (index: number): Promise<Outcome> => {
      const layer = middlewares[index];

      if (layer === undefined) {
        return next();
      }

      let called = false;

      return Promise.resolve(
        layer(message, context, () => {
          if (called) {
            return Promise.reject(
              new Error('next() was called twice in the same middleware layer'),
            );
          }

          called = true;

          return dispatch(index + 1);
        }),
      );
    };

    return dispatch(0);
  };
};

/*****************************************************************************************************************/
