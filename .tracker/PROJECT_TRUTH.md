---
schemaVersion: 1
projectName: Terrace
summary: Terrace is being hardened for public npm v0.1 readiness. Ship checks are read-only, coverage passes configured thresholds, and packed-consumer e2e now proves the npm tarball runs in a fresh project.
healthScore: 86
statusLabel: external_readiness_in_progress
nextStep: Refresh external onboarding docs and release checklist, then run final verification.
blockers: []
lastUpdated: 2026-04-29
tags: [framework, ai-tooling, governance, spec-driven, cli]
areas: [cli, validation, lifecycle, presets, templates, packaging, ci, docs]
goals:
  - Keep Terrace publishable and recoverable from repo state
  - Prove governance workflows through packed CLI fixture tests
  - Expand migration and rule contracts without weakening hard gates
repoType: library
sourceOfTruth: .terrace/state.json
primaryLanguage: TypeScript
activeBranch: main
lastCommitDate: "2026-04-29"
quality:
  lint: pass
  types: pass
  tests: pass
  coverage: pass
  package: pass
  auditHigh: pass
  deadCode: not_configured
  structure: pass
canonicalCommands:
  install: npm install
  dev: unknown
  lint: npm run lint
  typecheck: npm run typecheck
  test: npm test
  coverage: npm run test:coverage
  package: npm run package:dry-run
  ci: npm run ci
  audit: npm audit --audit-level=high
  deadcode: unknown
agentExpectationsVersion: 2
lastVerifiedCommand: npm test -- tests/product-readiness.test.ts
lastVerifiedAt: "2026-04-29T11:19:33-04:00"
---

## Current State

Terrace is in an external-readiness hardening pass for public npm v0.1. `terrace ship check` is non-mutating, targeted lifecycle tests restore coverage above the configured release thresholds, and product-readiness tests now pack and install Terrace into a fresh consumer project before running the installed CLI.

The `terrace port gsd` coding gap is now substantially mitigated: it converts core project files, roadmap phase headings, phase plans, phase summaries, research/context/UI specs, testing artifacts, debug/milestone archives, decisions, quick-task PLAN/SUMMARY history, backlog items, sessions, handoff state, and blocked human actions into Terrace state/docs while preserving source `.planning` files. Migration reports now include converted/skipped/writes, blockers, warnings, readiness, next command, review checklist, and validation commands.

Terrace also has GSD-style workflow continuity commands: `terrace next`, `terrace resume`, `terrace history`, `terrace do <plain text>`, `terrace autonomous`, `terrace commands discover`, `terrace phase list`, `terrace phase show <id>`, `terrace phase plan <id>`, `terrace phase execute <id>`, `terrace phase validate <id>`, `terrace phase review <id>`, `terrace phase complete <id>`, `terrace quick list`, `terrace quick show <id>`, `terrace quick plan <title>`, `terrace quick execute <id>`, `terrace quick complete <id>`, `terrace backlog list`, `terrace backlog add <title>`, `terrace ship check`, and `terrace ship prepare`. GSD-compatible aliases exist for `plan-phase`, `execute-phase`, `validate-phase`, `review-phase`, and `complete-phase`. Command contracts are exported from core so agent-facing expectations can align with CLI behavior.

Terrace now also has Senior Cycle commands: `terrace align <feature>`, `terrace interrogate <feature>`, `terrace map-codebase`, `terrace design <feature>`, `terrace test-plan <feature>`, `terrace observe <feature>`, `terrace validate-prod <feature>`, `terrace cleanup <feature>`, `terrace ui import-stitch <feature>`, `terrace ui plan-refresh <feature>`, and `terrace ui diff <feature>`. The senior-cycle core exposes adaptive tier gates, blocks phase execution by default, routes `terrace next` through missing Senior Cycle gates, blocks phase completion without cleanup for Tier 2+ work, adds ship blockers for missing observability/validation, and blocks quick work without test-plan plus verification evidence.

The core remains CommonJS at runtime. TypeScript is used for tests/config and typechecks with `moduleResolution: Bundler`.

## Recent Progress

- April 28: Added CLI `--help` and `--version`.
- April 28: Added canonical scripts: lint, typecheck, test, coverage, package dry-run, and ci.
- April 28: Fixed coverage to measure `packages/terrace-core/src`; current coverage passes thresholds.
- April 28: Added README, license, changelog, architecture, security, compatibility, contributing, and release docs.
- April 28: Added GitHub CI and release dry-run workflows.
- April 28: Removed tracked GitNexus skill artifacts and stale `.terrace/project-state.json`.
- April 28: Added `.terrace/state.json`, config, preset registry, events, and default rules for this repo.
- April 28: Expanded rule domains and added guarded non-dry-run `terrace port gsd` migration.
- April 28: Expanded `terrace port gsd` to convert core GSD artifacts, emit converted/skipped details, and produce an audit-healthy migrated fixture.
- April 28: Expanded `terrace port gsd` for richer GSD workflow artifacts, added workflow parity commands, exported command contracts, and added `amos-saas` temp-copy smoke coverage.
- April 28: Added GSD quick-task PLAN/SUMMARY migration plus `terrace quick list/show`; `amos-saas` skipped artifacts dropped from 170 to 3 placeholder `.gitkeep` files.
- April 28: Added `terrace history`, `terrace phase plan/execute`, handoff backlog extraction, and Terrace-native doctor/audit/migration checks inside `terrace ship check`.
- April 28: Added stateful phase plan/execute/validate/review/complete artifacts, Terrace-native quick task plan/execute/complete, `terrace ship prepare`, GSD-compatible phase aliases, and `terrace do <plain text>` routing for agents.
- April 28: Added adaptive project command discovery, richer migrated-context phase plans, execution queue artifacts, `terrace autonomous`, broader GSD-style plain-text routing, and missing-script ship warnings.
- April 29: Added the Senior Cycle audit/spec, adaptive senior-cycle artifact generation, tiered gate status, phase execution enforcement for opted-in senior-cycle features, no-band-aid architecture defaults for quick work, and UI/Stitch workflow artifact commands.
- April 29: Drafted the Agent Production Lifecycle spec covering a Tier One report card, handoffs, workstreams, design-source adapters, preflight, AI review, debt tracking, documentation, test evaluation, rule audit, and standards backfill.
- April 29: Made `terrace ship check` read-only and added a regression test proving it does not write report artifacts in a fresh initialized repo.
- April 29: Added lifecycle/report edge coverage for report reads/updates, tiered ship-check branches, debt, test evaluation, rules, backfill, workstreams, and design-source artifacts.
- April 29: Added packed-consumer e2e coverage for `terrace --help`, `--version`, `init`, `doctor`, `audit`, `report`, and `ship check` from the installed npm tarball.

## Open Problems

- Feature tier selection still defaults to medium unless a feature records an explicit tier.
- `npm audit --audit-level=high` passes, but npm reports one moderate PostCSS advisory in the dev dependency tree.
- Dead-code scanning is not configured.

## Quality Ladder Notes

- **Lint:** `npm run lint` PASS
- **Types:** `npm run typecheck` PASS
- **Tests:** `npm test` PASS, 230 tests under coverage run
- **Coverage:** `npm run test:coverage` PASS, global coverage above configured thresholds: lines 87.79%, statements 87.31%, functions 89.37%, branches 71.48%
- **Package:** `npm run package:dry-run` PASS, packed-consumer e2e covers the generated tarball
- **Audit:** `npm audit --audit-level=high` PASS, one moderate advisory remains

## Next Concrete Steps

1. Update external onboarding docs and release checklist around the public npm v0.1 path.
2. Address the moderate PostCSS advisory or explicitly document the remaining dev-dependency risk.
