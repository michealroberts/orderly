/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/retry
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

// The largest delaySeconds the platform accepts when sending or retrying a message: 24 hours.
export const MAXIMUM_DELAY_SECONDS = 86_400;

/*****************************************************************************************************************/

// A decision uses imperative verbs; the past-tense Outcome records what was then done. A delay of zero means
// redelivery as soon as the platform allows.
export type RetryDecision =
  | { action: 'retry'; delaySeconds: number }
  | { action: 'discard'; reason: string };

/*****************************************************************************************************************/

// Pure by design: redelivery delays are not observable in the test harness, so the decision itself is what gets
// unit tested. attempts is 1-based and counts the delivery that just failed.
export type RetryPolicy = (context: { attempts: number; error: unknown }) => RetryDecision;

/*****************************************************************************************************************/
