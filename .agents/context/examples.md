# Good implementation examples

- `packages/terrace-core/src/` demonstrates the reusable core boundary and explicit delegation from the CLI.
- `scripts/secret-scan.mjs` demonstrates a local, deterministic safety check with conservative exclusions.
- `scripts/package-dry-run.cjs` demonstrates package-boundary validation through a temporary consumer.
- `tests/product-readiness.test.ts` demonstrates executable checks for published metadata, release trust, command surfaces, and consumer behavior.
- `docs/SECURITY.md` and `docs/RELEASE.md` demonstrate approval-gated operational documentation.

Use these as patterns, not as permission to copy obsolete planning or project-truth conventions.
