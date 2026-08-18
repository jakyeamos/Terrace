# Release Checklist

Current distribution status: `package.json` is `0.2.0`, while the npm registry reports `0.1.1` as `latest`. The `0.2.0` package is not published by this checklist or by local verification. Confirm the live registry state with `pnpm view @jakyeamos33/terrace version versions dist-tags --json` before giving users an install command for the candidate.

1. Confirm npm trusted publishing is configured for `@jakyeamos33/terrace` with the GitHub repository, `release-publish.yml` workflow, and `npm` environment.
2. Confirm the GitHub `npm` environment requires the intended reviewer before publish jobs can run.
3. Confirm `package.json` and `CHANGELOG.md` match the reviewed release version and scope.
4. Run `node src/terrace-tools.cjs adoption status --json` and confirm `ready: true`, `score: 100`, and `recommended_mode: "replace_gsd"` for the 0.2.0 GSD replacement release scope.
5. Run `pnpm run ci`; this includes the packed-consumer smoke test for `terrace agents install-global` and its generated global command assets.
6. Run `pnpm audit --audit-level moderate`.
7. Run `pnpm package` and confirm the package contains only runtime files and public docs.
8. Run `pnpm run release:dry-run`.
9. Run `node src/terrace-tools.cjs ship check --json`, confirm the default read-only check does not dirty the working tree, and confirm the `trusted_publishing` category reports repo-owned prerequisites as passed while listing the manual npm/GitHub admin confirmations for `@jakyeamos33/terrace@0.2.0`. Use `--full` only when intentionally executing discovered project scripts.
10. Run `node src/terrace-tools.cjs release-preflight --target-version 0.2.0 --json` and confirm the JSON summary has no blockers.
11. Tag the reviewed candidate with `git tag v0.2.0` only after the release owner approves the version, changelog, and preflight output.
12. Create a GitHub Release for `v0.2.0`. The Release Publish workflow uses GitHub OIDC trusted publishing and must not require local registry auth secrets; no local `pnpm publish` is required.

Publication blocker for this checkout: `v0.2.0` has not been tagged or published, and npm/GitHub trusted-publishing admin settings require owner confirmation. The exact next command after that approval is `git tag v0.2.0`; creating the GitHub Release then starts the tokenless publish workflow.

Rollback: deprecate the npm version with a clear replacement message, then ship a patch release.
