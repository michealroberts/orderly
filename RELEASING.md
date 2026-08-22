# Releasing

orderly is versioned with [changesets](https://github.com/changesets/changesets) and released by
pushing a git tag. Versions and changelog entries come from changesets committed alongside the
changes that need them, rather than from commit subjects read back at release time.

Merging to `main` never versions and never publishes. Pushing a `v` tag is what releases.

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

A release is three deliberate steps, all yours:

1. **Version.** On an up-to-date `main`, apply every pending changeset:

   ```sh
   pnpm changeset:version
   ```

   This collapses the accumulated changesets into one bump, writes `CHANGELOG.md`, updates
   `package.json`, and deletes the changeset files it consumed. Review what it produced, then land
   it through a pull request like any other change:

   ```sh
   git checkout -b chore/release/v0.1.0
   git commit --all --message "chore: version the package for v0.1.0"
   ```

2. **Tag.** Once the version pull request is merged, tag that commit on `main` with the version it
   set, `v` prefixed:

   ```sh
   git checkout main && git pull
   git tag v0.1.0
   git push origin v0.1.0
   ```

3. **The tag publishes.** Pushing the tag runs
   [`.github/workflows/release.yml`](.github/workflows/release.yml), which builds and publishes to
   npm over OIDC. Nothing else triggers it: no bot pull requests, no publishing on merge.

To hold a release back, do nothing. Changesets accumulate on `main` harmlessly until you choose to
version and tag.

## What Publishing Produces

- `@observerly/orderly` on npm, at public access, with `dist/` only.
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
- **The tag ran no workflow.** The workflow triggers on tags matching `v*`; a tag named without the
  prefix, or pushed to a fork, runs nothing.
- **Wrong version published.** The tag names the release but the version comes from
  `package.json`. If the two disagree, the versioning step was skipped or not merged before
  tagging.
