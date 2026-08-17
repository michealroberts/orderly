/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/scripts
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { readFileSync } from 'node:fs';

import process from 'node:process';

/*****************************************************************************************************************/

// orderly ships with zero runtime dependencies, and that is a guarantee rather than a habit. This guard makes the
// guarantee structural: the moment a dependencies key appears in the manifest, the package checks fail, in CI and
// locally alike. devDependencies remain allowed, as they are toolchain-only and never ship.
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

if ('dependencies' in manifest) {
  console.error(
    'package.json declares a dependencies key: @observerly/orderly ships with zero runtime dependencies.',
  );

  process.exit(1);
}

/*****************************************************************************************************************/
