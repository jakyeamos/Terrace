---
schemaVersion: 1
projectName: Terrace
summary: Terrace is credible for public npm v0.1 readiness: CI passes, ship check is read-only, packed-consumer e2e passes, audit is clean, and the report card is tier-one ready.
healthScore: 95
statusLabel: tier_one_ready
nextStep: Prepare the public npm v0.1 release PR/review package.
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
activeBranch: codex/tier-one-external-product
lastCommitDate: "2026-04-29"
quality:
  lint: pass
  types: pass
  tests: pass
  coverage: pass
  package: pass
  auditHigh: pass
  auditModerate: pass
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
lastVerifiedCommand: npm run typecheck; npm run lint; npm test; npm run test:coverage; npm run package:dry-run; npm audit --audit-level=moderate; npm run ci; node src/terrace-tools.cjs ship check --json; git status --short --branch
lastVerifiedAt: "2026-04-29T12:02:02-04:00"
---

## Current State

Terrace is at tier-one readiness for a public npm v0.1 release candidate. The final verification pass completed `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:coverage`, `npm run package:dry-run`, `npm audit --audit-level=moderate`, `npm run ci`, `node src/terrace-tools.cjs ship check --json`, and `git status --short --branch`. `terrace ship check --json` passed on a clean tree with report-card score 95 and `tier_one_ready` status.

The latest command implementation pass added deterministic repo inventory, artifact analysis, static/imported review normalization, and stdlib-only security checks. `terrace security check` writes `.terrace/security/latest.json` and `docs/terrace/security/SECURITY-CHECK.md`, and read-only `terrace ship check` now consumes recorded security findings alongside reviews, tests, docs, rules, and lifecycle evidence.

The `terrace port gsd` coding gap is now substantially mitigated: it converts core project files, roadmap phase headings, phase plans, phase summaries, research/context/UI specs, testing artifacts, debug/milestone archives, decisions, quick-task PLAN/SUMMARY history, backlog items, sessions, handoff state, and blocked human actions into Terrace state/docs while preserving source `.planning` files. Migration reports now include converted/skipped/writes, blockers, warnings, readiness, next command, review checklist, and validation commands.

Terrace also has GSD-style workflow continuity commands: `terrace next`, `terrace resume`, `terrace history`, `terrace do <plain text>`, `terrace autonomous`, `terrace commands discover`, `terrace phase list`, `terrace phase show <id>`, `terrace phase plan <id>`, `terrace phase execute <id>`, `terrace phase validate <id>`, `terrace phase review <id>`, `terrace phase complete <id>`, `terrace quick list`, `terrace quick show <id>`, `terrace quick plan <title>`, `terrace quick execute <id>`, `terrace quick complete <id>`, `terrace backlog list`, `terrace backlog add <title>`, `terrace ship check`, and `terrace ship prepare`. GSD-compatible aliases exist for `plan-phase`, `execute-phase`, `validate-phase`, `review-phase`, and `complete-phase`. Command contracts are exported from core so agent-facing expectations can align with CLI behavior.

Terrace now also has Senior Cycle commands: `terrace align <feature>`, `terrace interrogate <feature>`, `terrace map-codebase`, `terrace design <feature>`, `terrace test-plan <feature>`, `terrace observe <feature>`, `terrace validate-prod <feature>`, `terrace cleanup <feature>`, `terrace ui import-stitch <feature>`, `terrace ui plan-refresh <feature>`, and `terrace ui diff <feature>`. These generators now infer source areas, architecture hints, test strategy, workstream lanes, route/component hints, unresolved evidence, and concrete affected files from the repo instead of blank TODO placeholders.

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
- April 29: Reworked README and release docs around public npm v0.1 onboarding, read-only ship checks, packed-consumer e2e, and moderate audit gates; updated PostCSS through `npm audit fix`.
- April 29: Aligned report-card scoring with release readiness by skipping preflight, completed-outcome, and documentation penalties when no active feature is set, and by accepting configured test and coverage scripts as test-suite strength evidence.
- April 29: Hardened generated artifact path handling in workflow and lifecycle helpers, added traversal-alias regression tests for feature/rule IDs, and normalized AI review mode artifact filenames.
- April 29: Implemented deterministic placeholder-command analysis with stdlib-only repo walking; added repo/security/artifact helper modules; wired `terrace security check`; normalized static/imported AI reviews; replaced TODO-heavy lifecycle, docs, codebase, backfill, workstream, design-source, and UI drafts with repo-derived content.
- April 29: Stabilized the full lifecycle ship-category test under the complete CI chain and reran all public npm v0.1 release gates successfully.

## Open Problems

- Feature tier selection still defaults to medium unless a feature records an explicit tier.
- Dead-code scanning is not configured.

## Quality Ladder Notes

- **Lint:** `npm run lint` PASS
- **Types:** `npm run typecheck` PASS
- **Tests:** `npm test` PASS, 33 files and 242 tests
- **Coverage:** `npm run test:coverage` PASS, global coverage above configured thresholds: lines 86.29%, statements 85.60%, functions 87.20%, branches 71.05%
- **Package:** packed-consumer e2e PASS; latest observed tarball has 54 files, package size 72.4 kB, unpacked size 290.2 kB, and no runtime dependency bundle
- **Audit:** `npm audit --audit-level=moderate` PASS, zero vulnerabilities
- **CI:** `npm run ci` PASS
- **Report:** `terrace ship check --json` PASS, score 95, status `tier_one_ready`
- **Git status:** clean on `codex/tier-one-external-product` before this truth-file update

## Next Concrete Steps

1. Open the release-readiness PR for review.
2. Publish only after review confirms the public npm v0.1 release checklist remains green.
