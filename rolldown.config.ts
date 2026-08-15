/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { defineConfig } from 'rolldown';

import { dts } from 'rolldown-plugin-dts';

/*****************************************************************************************************************/

export default defineConfig({
  input: 'src/index.ts',

  // rolldown defaults to 'node', which would let Node built-ins resolve.
  // orderly runs on workerd, so the build must assume no host runtime at all.
  platform: 'neutral',

  // Matches the tsconfig target. Deliberately not derived from engines.node,
  // which describes which Node versions may install the package rather than
  // the runtime the output executes on.
  transform: { target: 'es2024' },

  // Declaration emit. rolldown bundles JavaScript only, so types come from the
  // same plugin tsdown uses internally.
  plugins: [dts()],

  output: { dir: 'dist', format: 'esm' },
});

/*****************************************************************************************************************/
