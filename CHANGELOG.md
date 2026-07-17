# Changelog

## 0.2.0

- Curate the canonical CLI help into common workflow, advanced, and compatibility sections, with structured JSON help and version output while preserving the full command catalog.
- Harden Terrace-managed artifacts with symlink-safe path validation, re-entrant recovery-aware write serialization, synced atomic replacement, prepared-transaction recovery for preset policy/registry updates, and doctor diagnostics for unsafe artifacts.
- Add validated, schema-versioned, atomic `.terrace/state.json` persistence with legacy `1.0` migration, revision conflict detection, recovery-aware writer locks, explicit replacement, parent-directory syncing where supported, and symlink rejection.
- Add objective `terrace adoption status` replacement measurement for GSD parity with a direct verdict, score, ready flag, recommended mode, workflow evidence, blockers, and next commands.
- Add merge-safe `terrace port gsd --import-roadmap` to append missing executable legacy `.planning` roadmap phases into existing Terrace state without replacing current phase objects.
- Make Terrace pnpm-first across scripts, docs, command discovery, package guidance, and dependency audit handling.
- Improve migrated-GSD readiness by installing non-overwriting agent assets during `terrace port gsd` and extracting usable roadmap phase IDs from legacy planning evidence.
- Add report-card claim scope so baseline governance health does not overclaim full delivery readiness.
- Add production workbench status and prepare commands for feature release evidence, handoff artifacts, and ship-readiness workflows.
- Refresh generated Codex and Claude command assets for corpus, adoption, and workbench commands.
- Add release metadata, npm publish configuration, and GitHub release automation for provenance-capable public package releases.
- Block release preflight when the expected release tag already exists away from `HEAD`, so stale local tags cannot be mistaken for reviewed release tags.

## 0.1.2

- Add default non-overwriting Codex and Claude Code agent bootstrap assets during `terrace init`.
- Add Terrace-native end-to-end phase routing with `terrace execute-phase-complete <id>`.
- Add configurable phase effort defaults with `terrace settings effort <fast|standard|thorough>`.
- Clarify `terrace do` as natural-language intent routing.

## 0.1.0

- Establish strict-core CLI package surface.
- Add Terrace state, rules, presets, audit, migration, and governance templates.
- Add publish-readiness checks, CI scripts, and npm package allowlist.
