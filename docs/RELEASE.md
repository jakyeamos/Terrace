# Release Checklist

1. Confirm npm trusted publishing is configured for `@jakyeamos33/terrace` with the GitHub repository, `release-publish.yml` workflow, and `npm` environment.
2. Confirm the GitHub `npm` environment requires the intended reviewer before publish jobs can run.
3. Run `pnpm run ci`; this includes the packed-consumer smoke test for `terrace agents install-global` and its generated global command assets.
4. Run `pnpm audit --audit-level moderate`.
5. Run `pnpm package` and confirm the package contains only runtime files and public docs.
6. Run `pnpm run release:dry-run`.
7. Run `node src/terrace-tools.cjs ship check --json` and confirm it does not dirty the working tree.
8. Update `CHANGELOG.md`.
9. Bump `package.json` to the reviewed version.
10. Tag the release after review with `git tag v<version>`.
11. Publish by creating a GitHub Release for that tag. The Release Publish workflow uses GitHub OIDC trusted publishing and must not require local npm auth or an `NPM_TOKEN` secret.

Rollback: deprecate the npm version with a clear replacement message, then ship a patch release.
