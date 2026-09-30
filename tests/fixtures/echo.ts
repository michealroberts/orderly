/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';

/*****************************************************************************************************************/

// Whatever a caller hands the binding. Typed as unknown values rather than a shape, because the point of the
// echo is to report what actually arrived, a mutable Date included, not to assert what should have.
export type EchoParams = Record<string, unknown>;

/*****************************************************************************************************************/

export interface EchoOutput {
  // Each param by name, and what the Workflow saw it as: `Date` for a Date that survived the journey, and the
  // typeof answer otherwise.
  seen: Record<string, string>;
}

/*****************************************************************************************************************/

// A stand-in for whatever orderly starts through a Workflow binding. It exists to prove that the harness can
// bind a Workflow, create an instance by id, start nothing for a second create by the same id, and read an
// instance back; and it reports what its params looked like on arrival, which is how the tests pin what
// survives the journey from a create() call, or a queue, to the entrypoint. One step, so the instance is a
// real run of the engine rather than a bare return.
export class Echo extends WorkflowEntrypoint<Cloudflare.Env, EchoParams> {
  override async run(event: WorkflowEvent<EchoParams>, step: WorkflowStep): Promise<EchoOutput> {
    return await step.do('echo', () => {
      const seen: Record<string, string> = {};

      for (const [name, value] of Object.entries(event.payload)) {
        seen[name] = value instanceof Date ? 'Date' : typeof value;
      }

      return Promise.resolve({ seen });
    });
  }
}

/*****************************************************************************************************************/
