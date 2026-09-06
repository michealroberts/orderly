/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly/scripts
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

import { readFileSync } from 'node:fs';

import process from 'node:process';

/*****************************************************************************************************************/

// orderly ships with no third party runtime dependencies, and that is a guarantee rather than a habit. This guard
// makes the guarantee structural: a dependency outside the one name allowed below fails the package checks, in
// CI and locally alike. devDependencies remain allowed, as they are toolchain-only and never ship.

/*****************************************************************************************************************/

// The one runtime dependency orderly allows itself: observerly's own astrometry, which the sun schedules are
// built on. It carries no runtime dependencies of its own; the types-only package its manifest names ships no
// code. Nothing else may appear here without changing this line and the README sentence that promises it.
const ALLOWED = new Set(['@observerly/astrometry']);

/*****************************************************************************************************************/

const manifest: unknown = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

/*****************************************************************************************************************/

// The names under dependencies, or none when the key is absent. Anything the key holds that is not a plain
// object of names is refused too, rather than read as nothing.
const dependenciesOf = (candidate: unknown): string[] => {
  if (typeof candidate !== 'object' || candidate === null || !('dependencies' in candidate)) {
    return [];
  }

  const { dependencies } = candidate;

  if (typeof dependencies !== 'object' || dependencies === null || Array.isArray(dependencies)) {
    console.error('package.json declares dependencies that are not a map of names to versions.');

    process.exit(1);
  }

  return Object.keys(dependencies);
};

/*****************************************************************************************************************/

const strangers = dependenciesOf(manifest).filter(name => !ALLOWED.has(name));

if (strangers.length > 0) {
  console.error(
    `package.json declares runtime dependencies @observerly/orderly does not allow: ${strangers.join(', ')}. ` +
      `The only runtime dependency permitted is ${[...ALLOWED].join(', ')}.`,
  );

  process.exit(1);
}

/*****************************************************************************************************************/
