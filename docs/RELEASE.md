# Release Checklist

1. Run `pnpm run ci`.
2. Run `pnpm audit --audit-level=moderate`.
3. Run `pnpm test -- tests/product-readiness.test.ts` to cover the packed-consumer install path.
4. Run `node src/terrace-tools.cjs ship check --json` and confirm it does not dirty the working tree.
5. Confirm `pnpm run package:dry-run` contains only runtime files and public docs.
6. Update `CHANGELOG.md`.
7. Tag the release after review.
8. Publish with `pnpm publish --dry-run` first, then `pnpm publish` when the dry run is clean.

Rollback: deprecate the npm version with a clear replacement message, then ship a patch release.
