# Release Checklist

1. Run `npm run ci`.
2. Run `npm audit --audit-level=high`.
3. Confirm `npm run package:dry-run` contains only runtime files and public docs.
4. Update `CHANGELOG.md`.
5. Tag the release after review.
6. Publish with `npm publish --dry-run` first, then `npm publish` when the dry run is clean.

Rollback: deprecate the npm version with a clear replacement message, then ship a patch release.
