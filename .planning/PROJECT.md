# Terrace

## What This Is

Terrace is a standalone strict-core workflow system for single-developer, spec-driven, TDD-driven AI-assisted project work. The runtime truth lives in `packages/terrace-core` and project state is stored in `.terrace/state.json`, not in GSD-shaped planning artifacts.

## Core Value

Every implementation slice should be recoverable from repo state, tied to spec intent, protected by meaningful tests, and cheap to execute when deterministic rules make the work low risk.

## Validated

- [x] `packages/terrace-core` owns state, events, rules, gates, roadmap execution, GSD dry-run classification, spec hashing, protected baselines, decisions, sessions, validation, presets, migration, audit/CI checks, fragments, and health checks.
- [x] The CLI delegates runtime behavior to `terrace-core`.
- [x] Useful legacy behavior was extracted out of `src/lib`.
- [x] Legacy GSD-era planning artifacts were removed after extraction.

## Active

- [ ] Expand non-dry-run `terrace port gsd` migration behavior.
- [ ] Add user-facing docs for the strict-core command set.
- [ ] Harden rule packs for security, architecture, pentesting, maintainability, and testing trust.
- [ ] Replace remaining prose-heavy agent instructions with core-backed command contracts.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Strict core is the source of truth | Avoid split-brain state between `.planning`, `project-state.json`, and runtime code | — Active |
| Keep only minimal project truth files | Historical phase plans were useful during development but are not product runtime | — Active |
| Legacy behavior must be re-hosted, not wrapped | Wrappers preserve old architecture; extraction makes the product standalone | — Active |

---
*Last updated: 2026-04-28 after legacy extraction into terrace-core*
