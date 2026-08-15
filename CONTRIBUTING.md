# Contributing

We appreciate your interest in contributing to observerly, and your contributions are integral to
enhancing this project. Whether you are addressing a bug, implementing new features, or suggesting
improvements, your involvement is highly valued and essential.

## What Orderly Runs On

orderly is middleware for Cloudflare Queues. It runs on
[workerd](https://github.com/cloudflare/workerd), not Node, and this shapes almost everything below.

- **No Node built-ins.** `node:fs`, `node:path` and friends are unavailable at runtime. The
  TypeScript configuration deliberately omits the DOM library for the same reason: browser-only APIs
  are not there either.
- **Tests execute inside workerd**, not Node, through
  [`@cloudflare/vitest-pool-workers`](https://developers.cloudflare.com/workers/testing/vitest-integration/).
  A test that passes under Node proves nothing about the runtime orderly ships on.
- Node is used only to run the toolchain.

## Code Style

- [oxfmt](https://oxc.rs/docs/guide/usage/formatter) for formatting.
- [oxlint](https://oxc.rs/docs/guide/usage/linter) for linting, including type-aware rules.
- [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for commit messages.
- [Semantic Versioning](https://semver.org/) for versioning.

Formatting and linting are not matters of taste here — they are enforced, and a pre-commit hook
applies them to staged files automatically.

### File Headers

Every TypeScript file opens and closes with a banner, and separates top-level declarations with the
same banner:

```ts
/*****************************************************************************************************************/

// @author         Michael Roberts <michael@observerly.com>
// @package        @observerly/orderly
// @license        Copyright © 2026 observerly

/*****************************************************************************************************************/

export const example = (): void => {};

/*****************************************************************************************************************/
```

The banner is exactly 115 characters. `@package` is the bare package name in `src/index.ts`, and the
module path elsewhere, such as `@observerly/orderly/middleware`. Copy an existing file rather than
retyping it.

## Getting Started

### 1. Fork The Repository

[Fork @observerly/orderly](https://github.com/michealroberts/orderly/fork).

### 2. Clone The Repository

```bash
git clone https://github.com/<REPLACE_WITH_YOUR_USERNAME>/orderly.git
cd orderly
```

### 3. Setup

The Node version is pinned in `.nvmrc` and the package manager in `package.json`, so both come from
the repository rather than from whatever you happen to have installed:

```bash
nvm use
corepack enable
pnpm install
```

`pnpm install` refuses to run on a Node version below the `engines` floor, and installs the
pre-commit hook for you. No further setup step is needed.

### 4. Develop

| Command             | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `pnpm build`        | Bundles to `dist/` with rolldown                  |
| `pnpm test`         | Runs the suite once, inside workerd               |
| `pnpm test:watch`   | Same, in watch mode                               |
| `pnpm typecheck`    | Typechecks the library and the tests              |
| `pnpm lint`         | Fast syntactic lint                               |
| `pnpm lint:types`   | Type-aware lint, including `no-floating-promises` |
| `pnpm lint:package` | Validates the published package shape             |
| `pnpm format`       | Formats in place                                  |

Tests live in `tests/` and use the `.spec.ts` suffix.

## Branches

`main` is the default branch and the most recent canary version of the codebase. All development
work happens on a separate branch, using a trunk-based workflow.

```shell
git checkout -b <COMMIT_TYPE>/<SCOPE>/branch-name
```

For example, `chore/configuration/oxlint` or `fix/middleware/retry-delay`.

## Committing Your Changes

Write clear, concise commits following
[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

If your change is one a consumer of the package would notice, it also needs a changeset:

```bash
pnpm changeset
```

Commit the generated file alongside your change. Nothing enforces this, so a pull request that needs
a changeset and lacks one will merge cleanly and quietly miss the next release. See
[RELEASING.md](RELEASING.md) for the full process.

## Create A Pull Request

Open the pull request against `main`. CI runs formatting, both lint passes, typechecking, the test
suite, the build and the package checks. All of them must pass.

## Review And Feedback

Reviews are about the change, not the person making it. Expect questions; ask them freely in return.

## Bug Reports

Open an [issue](https://github.com/michealroberts/orderly/issues). A report is most useful when it
includes the queue configuration involved, the batch or message that triggered it, and what you
expected to happen instead.

## Feature Requests

Also an [issue](https://github.com/michealroberts/orderly/issues). Describe the queue behaviour you
are trying to achieve rather than the API you imagine; there may be a simpler route to it.

## Code Of Conduct

This project is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
