# Release Checklist

1. Confirm npm auth is available with `pnpm whoami`.
2. Confirm npm 2FA or GitHub trusted publishing is ready for the `@jakyeamos33` scope.
3. Run `pnpm run ci`.
4. Run `pnpm audit --audit-level moderate`.
5. Run `pnpm package` and confirm the package contains only runtime files and public docs.
6. Run `pnpm run release:dry-run`.
7. Run `node src/terrace-tools.cjs ship check --json` and confirm it does not dirty the working tree.
8. Update `CHANGELOG.md`.
9. Bump `package.json` to the reviewed version.
10. Tag the release after review with `git tag v<version>`.
11. Publish by creating a GitHub Release for that tag, or run `pnpm publish --access public --provenance --no-git-checks` after the dry run is clean.

Rollback: deprecate the npm version with a clear replacement message, then ship a patch release.
