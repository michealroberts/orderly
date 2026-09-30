/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { describe, expect, expectTypeOf, it } from 'vitest';

import { env } from 'cloudflare:workers';

/*****************************************************************************************************************/

// The disable that follows is scoped to this file and deliberate: prefer-readonly-parameter-types wants an
// instance, and a selector's environment, read as readonly types, and the platform declares neither that way.
// An instance is a class with methods, and `wrangler types` writes bindings as mutable properties. The harness
// reads both exactly as the platform types them, because that is what a project reads.
// oxlint-disable typescript/prefer-readonly-parameter-types

/*****************************************************************************************************************/

// Follows an instance to its end by reading its status, which is the platform's own way to watch a run. The pool
// ships an introspector that does the same, but it logs uncaught exceptions from the engine while an instance
// is still starting, so the harness stays with the binding.
const settled = async (instance: WorkflowInstance): Promise<InstanceStatus> => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    // Polling is the point: each read has to see the previous one's answer before deciding to read again.
    // oxlint-disable-next-line no-await-in-loop
    const status = await instance.status();

    if (status.status === 'complete' || status.status === 'errored') {
      return status;
    }

    // oxlint-disable-next-line no-await-in-loop
    await new Promise(resolve => {
      setTimeout(resolve, 25);
    });
  }

  throw new Error('the instance never settled');
};

/*****************************************************************************************************************/

describe('workflow binding', () => {
  it('reaches the binding and runs an instance to completion', async () => {
    const instance = await env.ECHO.create({ params: {} });

    await expect(settled(instance)).resolves.toMatchObject({ status: 'complete' });
  });

  it('mints an id that satisfies its own rule when none is given', async () => {
    const instance = await env.ECHO.create({ params: {} });

    expect(instance.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u);
  });

  // A direct create() crosses the binding by structured clone, so a Date arrives as a Date. A queue carries
  // JSON, where the same Date would arrive as a string. The two ways into a Workflow do not agree on their own,
  // and this is the fact the workflows module has to reconcile rather than assume away.
  it('hands the entrypoint its params as they were given, a Date included', async () => {
    const instance = await env.ECHO.create({
      params: { count: 1, when: new Date(), name: 'greenwich', nothing: null },
    });

    const status = await settled(instance);

    expect(status.status).toBe('complete');

    expect(status.output).toStrictEqual({
      seen: { count: 'number', when: 'Date', name: 'string', nothing: 'object' },
    });
  });
});

/*****************************************************************************************************************/

// The rule the engine enforces: at most a hundred characters, letters, digits, underscore and hyphen, and not
// led by a hyphen. A UUID satisfies it, which is what makes a minted id safe to hand back before a run starts.
describe('workflow instance ids', () => {
  it('accepts what the rule allows', async () => {
    const accepted = ['x'.repeat(100), 'ok_id-1', '_leading', '1leading', crypto.randomUUID()];

    const instances = await Promise.all(accepted.map(id => env.ECHO.create({ id, params: {} })));

    expect(instances.map(instance => instance.id)).toStrictEqual(accepted);
  });

  // A colon is the character an occurrence-derived key most plausibly carries, so it is the refusal pinned; a
  // leading hyphen and a hundred and first character are refused the same way. The engine logs each refusal it
  // makes, this one and a missing id below, as an uncaught exception of its own, which does not fail the run.
  it('refuses what it does not, before any instance exists', async () => {
    await expect(env.ECHO.create({ id: 'a:b', params: {} })).rejects.toThrow(/invalid id/u);
  });
});

/*****************************************************************************************************************/

// An id names one instance, and asking the binding for it is how existence is confirmed: never by reading an
// error's text.
describe('workflow instance identity', () => {
  it('finds an instance by id once it exists', async () => {
    await env.ECHO.create({ id: 'exists', params: {} });

    const found = await env.ECHO.get('exists');

    expect(found.id).toBe('exists');

    await expect(found.status()).resolves.toBeDefined();
  });

  it('refuses an id that was never created', async () => {
    await expect(env.ECHO.get('never-created')).rejects.toThrow('instance.not_found');
  });
});

/*****************************************************************************************************************/

// The binding's types promise that a second create() by an existing id throws, which is the platform's
// behaviour. The engine the harness runs returns the existing instance silently instead. Either way exactly one
// instance exists afterwards, with the params it was first given, and that is the fact the workflows module
// relies on and the one the harness can pin.
describe('workflow instance identity across repeats', () => {
  it('starts nothing for a second create by an id still running', async () => {
    const first = await env.ECHO.create({ id: 'running', params: { first: 1 } });

    const second = await env.ECHO.create({ id: 'running', params: { second: 2 } });

    expect(second.id).toBe('running');

    await expect(settled(first)).resolves.toMatchObject({ output: { seen: { first: 'number' } } });

    await expect(settled(second)).resolves.toMatchObject({ output: { seen: { first: 'number' } } });
  });

  it('starts nothing for a second create by an id already settled', async () => {
    const first = await env.ECHO.create({ id: 'settled', params: { first: 1 } });

    await settled(first);

    const second = await env.ECHO.create({ id: 'settled', params: { second: 2 } });

    await expect(settled(second)).resolves.toMatchObject({ output: { seen: { first: 'number' } } });

    const found = await env.ECHO.get('settled');

    await expect(settled(found)).resolves.toMatchObject({ output: { seen: { first: 'number' } } });
  });

  it('starts nothing for an id repeated within one batch', async () => {
    const [first, second] = await env.ECHO.createBatch([
      { id: 'batched', params: { first: 1 } },
      { id: 'batched', params: { second: 2 } },
    ]);

    expect(first?.id).toBe('batched');

    expect(second?.id).toBe('batched');

    const found = await env.ECHO.get('batched');

    await expect(settled(found)).resolves.toMatchObject({ output: { seen: { first: 'number' } } });
  });
});

/*****************************************************************************************************************/

type Plan = { id: string; exposures: number };

/*****************************************************************************************************************/

// A stand-in for the signature defineWorkflow() will have, which does not exist yet: generic over the params the
// schema names and over the environment a selector reads a binding from, the environment defaulting to the
// namespace `wrangler types` fills in. NoInfer is load-bearing. A binding generated by `wrangler types` has
// unknown params, and without it the selector's return would be a second inference site for Params and widen
// them to unknown. When the contract lands it replaces this, and the assertions below hold against it.
const define = <Params, Env = Cloudflare.Env>(options: {
  schema: (value: unknown) => Params;
  workflow: (env: Env) => Workflow<NoInfer<Params>>;
}) => options;

/*****************************************************************************************************************/

// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const plan = (value: unknown): Plan => value as Plan;

/*****************************************************************************************************************/

describe('workflow binding types', () => {
  it('infers the environment `wrangler types` declares from an unannotated selector', () => {
    const contract = define({ schema: plan, workflow: bindings => bindings.ECHO });

    expectTypeOf(contract.workflow).parameter(0).toEqualTypeOf<Cloudflare.Env>();
  });

  it("infers a project's own environment from an annotated selector", () => {
    interface Own {
      CLOSEDOWN: Workflow<Plan>;
    }

    const contract = define({ schema: plan, workflow: (bindings: Own) => bindings.CLOSEDOWN });

    expectTypeOf(contract.workflow).parameter(0).toEqualTypeOf<Own>();
  });

  it('keeps the params the schema names, whatever the binding says its own are', () => {
    const contract = define({ schema: plan, workflow: bindings => bindings.ECHO });

    expectTypeOf(contract.schema).returns.toEqualTypeOf<Plan>();
  });

  // The binding's methods take their params in parameter position, where TypeScript reads methods
  // bivariantly. So a binding with unknown params, as `wrangler types` writes it, is accepted, and so is one
  // whose params are wider than the schema's. Only a shape unrelated to the schema's is refused. That is the
  // check the compiler actually makes, and what the README may claim.
  it('accepts a binding typed as `wrangler types` writes it, with unknown params', () => {
    expectTypeOf<Workflow>().toExtend<Workflow<Plan>>();
  });

  it("accepts a binding whose params are wider than the schema's, which is where the check stops", () => {
    expectTypeOf<Workflow<{ id: string }>>().toExtend<Workflow<Plan>>();
  });

  it("refuses a binding whose params are unrelated to the schema's", () => {
    expectTypeOf<Workflow<{ unrelated: number }>>().not.toExtend<Workflow<Plan>>();
  });
});

/*****************************************************************************************************************/
