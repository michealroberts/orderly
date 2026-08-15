/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

// orderly owns no bindings, so there is no `wrangler types` output to extend.
// @cloudflare/workers-types declares an empty Cloudflare.Env for projects to
// redeclare, and TypeScript merges the declarations. This describes the
// producer declared in wrangler.jsonc so the harness is typed without
// inventing a Worker for the library to own.
declare namespace Cloudflare {
  interface Env {
    QUEUE: Queue;
  }
}

/*****************************************************************************************************************/
