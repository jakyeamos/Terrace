# Architecture and boundaries

- `src/terrace-tools.cjs` is the thin CommonJS CLI adapter: it parses commands and delegates.
- `packages/terrace-core/src/` owns state transitions, rule packs, gates, artifact validation, presets, baseline protection, sessions, audits, and legacy migration.
- `.terrace/` is target-repository runtime state and evidence. It is not a replacement for source-controlled documentation.
- `docs/` contains authored governance, architecture, testing, release, and migration documents.
- `scripts/` contains repository-owned validation and packaging helpers.
- `tests/` covers the CLI, core behavior, schemas, migration, security, packaging, and product readiness.

Do not introduce AIOS imports, provider-specific authority, or a second quality engine. Quality Runner remains the external source of truth for repository quality findings; Terrace consumes explicit results and preserves the boundary.
