# Terrace

## What This Is

Terrace is a standalone strict-core workflow system for single-developer, spec-driven, TDD-driven AI-assisted project work. The runtime truth lives in `packages/terrace-core`, and project state is stored in `.terrace/state.json`.

## Core Value

Every implementation slice should be recoverable from repo state, tied to spec intent, protected by meaningful tests, and cheap to execute when deterministic rules make the work low risk.

## Validated

- [x] `packages/terrace-core` owns state, events, rules, gates, roadmap execution, GSD migration, spec hashing, protected baselines, decisions, sessions, validation, presets, audit/CI checks, fragments, and health checks.
- [x] The CLI delegates runtime behavior to `terrace-core` and exposes help/version output.
- [x] Generated code-intelligence instructions and local index artifacts were removed.
- [x] The repo dogfoods Terrace via `.terrace/state.json`; `terrace doctor` and `terrace audit` are healthy.
- [x] npm packaging is allowlisted and excludes local planning, tests, tracker, agent settings, and stale integration artifacts.
- [x] `npm run ci` passes locally with typecheck, lint, tests, coverage, and package dry-run.
- [x] `terrace port gsd` converts core GSD artifacts into Terrace docs/state and reports unsupported files for review.

## Active

- [ ] Create a complete GSD-style planning package for Terrace itself: `.planning/config.json`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, and `.planning/codebase/`.
- [ ] Build native roadmap authoring so Terrace phases are first-class product state rather than mostly migrated state.
- [ ] Strengthen recovery, handoff, workstream planning, and operator visibility until Terrace is a credible day-to-day alternative to GSD.
- [ ] Expand GSD migration beyond core artifact conversion into per-phase plans, decision history, and session history.
- [ ] Replace remaining prose-heavy agent instructions with core-backed command contracts.
- [ ] Decide how to handle the moderate PostCSS advisory in the dev dependency tree.
- [ ] Add deeper fixture e2e coverage for installed packed CLI workflows.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Strict core is the source of truth | Avoid split-brain state between `.planning`, `project-state.json`, and runtime code | Implemented via `.terrace/state.json` |
| Keep npm package allowlisted | Prevent local planning/tracker/agent files from shipping | Implemented in `package.json#files` |
| Legacy behavior must be re-hosted, not wrapped | Wrappers preserve old architecture; extraction makes the product standalone | Active |
| External code-intelligence integration is not part of Terrace core | Broken generated integration instructions created workflow friction and are not needed for the standalone core | Implemented |
| Hard product gates define readiness | Tier-one progress should be blocked by quality, packaging, and docs gates | Implemented via `npm run ci` |
| Terrace should pursue parity by workflow job, not by cloning GSD internals | Preserve Terrace's simplicity advantage while closing practical adoption gaps | Active |

---
*Last updated: 2026-05-13 after establishing parity-driven GSD planning artifacts for Terrace*
