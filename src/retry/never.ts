/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/retry
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import type { RetryPolicy } from './decision';

/*****************************************************************************************************************/

// No retries at all: any throw discards the message deliberately. For handlers whose work is not safe or not
// worth repeating, such as sending an email.
export const withoutRetry = (): RetryPolicy => {
  return () => {
    return { action: 'discard', reason: 'retries are disabled' };
  };
};

/*****************************************************************************************************************/
