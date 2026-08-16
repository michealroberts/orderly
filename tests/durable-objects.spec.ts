/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';

import { env } from 'cloudflare:workers';

import { describe, expect, it } from 'vitest';

import type { Run } from './fixtures/worker';

/*****************************************************************************************************************/

const stub = (name: string) => env.RUN.get(env.RUN.idFromName(name));

/*****************************************************************************************************************/

describe('durable object binding', () => {
  it('reaches a stub and starts empty', async () => {
    await runInDurableObject(stub('empty'), (instance: Run) => {
      expect(instance.steps()).toStrictEqual([]);
    });
  });
});

/*****************************************************************************************************************/

describe('run status inference', () => {
  it('reports pending with no steps recorded', async () => {
    await runInDurableObject(stub('pending'), (instance: Run) => {
      expect(instance.status()).toBe('pending');
    });
  });

  it('reports running while a step has started but not settled', async () => {
    await runInDurableObject(stub('running'), (instance: Run) => {
      instance.record('charge', 'started', 1000);

      expect(instance.status()).toBe('running');
    });
  });

  it('reports succeeded once every started step has settled', async () => {
    await runInDurableObject(stub('succeeded'), (instance: Run) => {
      instance.record('charge', 'started', 1000);
      instance.record('charge', 'succeeded', 2000);

      expect(instance.status()).toBe('succeeded');
    });
  });

  it('reports failed when any step failed', async () => {
    await runInDurableObject(stub('failed'), (instance: Run) => {
      instance.record('charge', 'started', 1000);
      instance.record('charge', 'failed', 2000);

      expect(instance.status()).toBe('failed');
    });
  });

  // The case the whole idea rests on. A run whose isolate died mid step leaves
  // a started event with nothing after it, and that is enough to tell without
  // any status having been written down or any reaper process running.
  it('infers an interrupted run from the log alone', async () => {
    await runInDurableObject(stub('interrupted'), (instance: Run) => {
      instance.record('first', 'started', 1000);
      instance.record('first', 'succeeded', 2000);
      instance.record('second', 'started', 3000);

      expect(instance.status()).toBe('running');
      expect(instance.steps()).toHaveLength(3);
    });
  });
});

/*****************************************************************************************************************/

// Status has to follow the latest event for each step name, not whether a name
// has ever settled. A step running again after settling is in flight, whatever
// its history says.
describe('run status inference across reruns', () => {
  it('reports running while a settled step is rerunning', async () => {
    await runInDurableObject(stub('rerunning'), (instance: Run) => {
      instance.record('charge', 'started', 1000);
      instance.record('charge', 'succeeded', 2000);
      instance.record('charge', 'started', 3000);

      expect(instance.status()).toBe('running');
    });
  });

  it('reports running while a failed step is retrying', async () => {
    await runInDurableObject(stub('retrying'), (instance: Run) => {
      instance.record('charge', 'started', 1000);
      instance.record('charge', 'failed', 2000);
      instance.record('charge', 'started', 3000);

      expect(instance.status()).toBe('running');
    });
  });
});

/*****************************************************************************************************************/

describe('alarms', () => {
  it('stores an alarm at an exact millisecond', async () => {
    const at = 1_900_000_000_123;

    await runInDurableObject(stub('scheduled'), async (instance: Run) => {
      await instance.scheduleAt(at);

      expect(await instance.scheduledFor()).toBe(at);
    });
  });

  it('runs the alarm handler and records it', async () => {
    const target = stub('firing');

    await runInDurableObject(target, async (instance: Run) => {
      await instance.scheduleAt(Date.now() + 60_000);
    });

    expect(await runDurableObjectAlarm(target)).toBe(true);

    await runInDurableObject(target, (instance: Run) => {
      expect(instance.steps().map(step => step.name)).toStrictEqual(['alarm']);
    });
  });
});

/*****************************************************************************************************************/
