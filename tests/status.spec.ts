/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, it } from 'vitest';

import { statusOf, type Event } from '../src/index';

/*****************************************************************************************************************/

const received = (at: number): Event => ({
  type: 'batch.received',
  queue: 'orderly',
  size: 1,
  lagMs: 0,
  at,
});

const started = (id: string, at: number): Event => ({
  type: 'message.started',
  id,
  attempts: 1,
  at,
});

const succeeded = (id: string, at: number): Event => ({
  type: 'message.succeeded',
  id,
  durationMs: 1,
  at,
});

const failed = (id: string, at: number): Event => ({
  type: 'message.failed',
  id,
  error: { name: 'Error', message: 'boom' },
  at,
});

const retried = (id: string, at: number): Event => ({
  type: 'message.retried',
  id,
  delaySeconds: 0,
  at,
});

const discarded = (id: string, at: number): Event => ({
  type: 'message.discarded',
  id,
  reason: 'exhausted',
  at,
});

const rejected = (id: string, at: number): Event => ({ type: 'message.rejected', id, at });

/*****************************************************************************************************************/

describe('status inference', () => {
  it('reports pending for an empty log', () => {
    expect(statusOf([])).toBe('pending');
  });

  it('reports pending when only a batch has been received, since batch.received has no subject', () => {
    expect(statusOf([received(1000)])).toBe('pending');
  });

  it('reports running while a message has started but not settled', () => {
    expect(statusOf([started('m1', 1000)])).toBe('running');
  });

  it('reports succeeded once a started message settles', () => {
    expect(statusOf([started('m1', 1000), succeeded('m1', 2000)])).toBe('succeeded');
  });

  it('reports failed while a throw has no decision recorded after it', () => {
    expect(statusOf([started('m1', 1000), failed('m1', 2000)])).toBe('failed');
  });

  it('reports succeeded for the deliberate terminals, discarded and rejected alike', () => {
    expect(statusOf([started('m1', 1000), discarded('m1', 2000)])).toBe('succeeded');

    expect(statusOf([rejected('m1', 1000)])).toBe('succeeded');
  });
});

/*****************************************************************************************************************/

// The latest event for each message decides its state, never its history: these are the redelivery and rerun
// shapes that set membership misclassifies, which is the defect the durable object spike caught and the rule
// this function now owns.
describe('status inference across retries and reruns', () => {
  it('reports running once a decision to retry has been recorded after a throw', () => {
    expect(statusOf([started('m1', 1000), failed('m1', 2000), retried('m1', 3000)])).toBe(
      'running',
    );
  });

  it('reports running while a retried message is being redelivered', () => {
    const log = [started('m1', 1000), failed('m1', 2000), retried('m1', 3000), started('m1', 4000)];

    expect(statusOf(log)).toBe('running');
  });

  it('reports running while a settled message is rerunning', () => {
    expect(statusOf([started('m1', 1000), succeeded('m1', 2000), started('m1', 3000)])).toBe(
      'running',
    );
  });

  it('trusts append order rather than timestamps when events share a millisecond', () => {
    expect(statusOf([started('m1', 1000), succeeded('m1', 1000)])).toBe('succeeded');
  });
});

/*****************************************************************************************************************/

describe('status inference across a batch', () => {
  it('reports running while any message is still in flight', () => {
    const log = [started('m1', 1000), succeeded('m1', 2000), started('m2', 3000)];

    expect(statusOf(log)).toBe('running');
  });

  it('reports failed over running when any message failed without a decision', () => {
    const log = [started('m1', 1000), failed('m1', 2000), started('m2', 3000)];

    expect(statusOf(log)).toBe('failed');
  });

  it('reports succeeded only once every message has settled', () => {
    const log = [
      started('m1', 1000),
      succeeded('m1', 2000),
      started('m2', 3000),
      discarded('m2', 4000),
    ];

    expect(statusOf(log)).toBe('succeeded');
  });
});

/*****************************************************************************************************************/
