# Releasing

orderly is released with [changesets](https://github.com/changesets/changesets). Versions and
changelog entries come from changesets committed alongside the changes that need them, rather than
from commit subjects read back at release time.

Nothing is published by hand. Merging to `main` is what starts a release.

## Adding A Changeset

Any change that a consumer would notice needs a changeset. Run:

```sh
pnpm changeset
```

This asks for a bump type and a summary, then writes a file into `.changeset/`. Commit that file in
the same pull request as the change it describes. The summary becomes the changelog entry, so write
it for someone upgrading the package, not for a reviewer reading the diff.

For a change nothing downstream can observe — CI configuration, tests, documentation — record that
explicitly instead:

```sh
pnpm changeset add --empty
```

To see what is currently pending:

```sh
pnpm exec changeset status
```

> Note that CI does not currently enforce the presence of a changeset. A pull request that needs one
> and lacks one will merge cleanly and simply not appear in any release.

## How A Release Happens

Every push to `main` runs [`.github/workflows/release.yml`](.github/workflows/release.yml), which
behaves differently depending on whether changesets are pending.

1. **Changesets pending.** The workflow opens, or updates, a pull request titled
   `chore: version packages`. That pull request applies the version bumps, writes `CHANGELOG.md`,
   and deletes the changeset files it consumed. It is not published yet, and it will keep updating
   itself as further changesets land on `main`.

2. **Review and merge that pull request** when the accumulated changes are ready to ship. This is
   the point at which a release is decided; everything either side of it is automatic.

3. **No changesets pending.** The same workflow runs again on that merge, finds nothing left to
   version, and publishes instead.

To hold a release back, leave the version pull request unmerged. Changesets accumulate into it
harmlessly.

## What Publishing Produces

- `@observerly/orderly` on npm, at public access, with `dist/` only.
- A git tag in the form `v0.1.0`. The `v` prefix depends on this repository having no `packages` key
  in `pnpm-workspace.yaml`; declaring a workspace would tag `@observerly/orderly@0.1.0` instead.
- A provenance attestation linking the published tarball to the commit and workflow run that built
  it. This is automatic on the trusted publishing path and needs no flag.

The package is built by `prepack`, so the tarball cannot be published from a stale or missing
`dist/`.

## One-Time Setup

Publishing uses npm [trusted publishing](https://docs.npmjs.com/trusted-publishers/) over OIDC, so
there is no `NPM_TOKEN` in this repository and none should be added. The workflow requests
`id-token: write` and npm exchanges that for short-lived credentials.

This needs configuring once, and the order matters:

1. **The `@observerly` scope must exist on npm**, with the publishing account holding rights to it.

2. **Publish the first version manually.** OIDC cannot perform a package's first publish, because
   npm will not let a trusted publisher be configured against a package that does not yet exist.
   Publish once from a machine that is logged in:

   ```sh
   pnpm build
   npm publish --access public
   ```

3. **Add the trusted publisher.** On npmjs.com, under the package's settings, add a GitHub Actions
   trusted publisher pointing at:

   - Repository: `michealroberts/orderly`
   - Workflow: `release.yml`

   Trusted publisher configurations created since May 2026 require the allowed actions to be
   selected explicitly, so make sure publishing is ticked rather than assumed.

After that, step 2 never repeats and every later release goes through the workflow.

## If A Release Fails

- **`404` or `E404` on publish.** Almost always authentication rather than a missing package. Check
  the trusted publisher still names this repository and `release.yml`, and that the job kept its
  `id-token: write` permission.
- **Published without `dist/`.** The build did not run. `prepack` covers this for a manual publish,
  and the workflow builds before publishing; a failure here means one of those was bypassed.
- **No release happened at all.** Most likely no changeset was ever added, so there was nothing to
  version. `pnpm exec changeset status` will say so.
