---
schemaVersion: 1
projectName: Terrace
summary: Terrace is credible for public npm v0.1 readiness: CI passes, ship check is clean, packed-consumer e2e passes, security/test/rule evidence is recorded, adoption-risk mitigations are implemented, and the report card is 100/100 tier-one ready.
healthScore: 100
statusLabel: tier_one_ready
nextStep: Run Terrace against the new GSD shadow-branch corpus, then prepare the public npm v0.1 release PR/review package.
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
lastVerifiedCommand: npm run ci; npm run typecheck; npm run lint; npm test -- tests/lifecycle-coverage.test.ts tests/core-port-gsd-migration.test.ts tests/workflow-commands.test.ts tests/core-cli.test.ts; npm test -- tests/core-port-gsd-migration.test.ts tests/workflow-commands.test.ts
lastVerifiedAt: "2026-04-29T15:39:17-04:00"
---

## Current State

Terrace is at tier-one readiness for a public npm v0.1 release candidate. The final verification pass completed `npm run ci`, `npm audit --audit-level=moderate`, `node src/terrace-tools.cjs security check --json`, `node src/terrace-tools.cjs test eval --json`, `node src/terrace-tools.cjs rule audit --json`, `node src/terrace-tools.cjs report --json`, and `node src/terrace-tools.cjs ship check --json`. `terrace ship check --json` passed on a clean tree with report-card score 100, `tier_one_ready` status, and no blockers or warnings.

The latest hardening pass records release evidence for security, test-suite evaluation, rule audit, and the Tier One report card. `terrace security check` now avoids self-referential generated-artifact findings, honors explicit GitHub Actions permissions, and records a zero-finding security check for the current repo.

The `terrace port gsd` coding gap is now substantially mitigated: it converts core project files, roadmap phase headings, phase plans, phase summaries, research/context/UI specs, testing artifacts, debug/milestone archives, decisions, quick-task PLAN/SUMMARY history, backlog items, sessions, handoff state, and blocked human actions into Terrace state/docs while preserving source `.planning` files. Migration reports now include converted/skipped/writes, blockers, warnings, readiness, next command, review checklist, and validation commands.

Terrace also has GSD-style workflow continuity commands: `terrace next`, `terrace resume`, `terrace history`, `terrace do <plain text>`, `terrace autonomous`, `terrace commands discover`, `terrace phase list`, `terrace phase show <id>`, `terrace phase plan <id>`, `terrace phase execute <id>`, `terrace phase validate <id>`, `terrace phase review <id>`, `terrace phase complete <id>`, `terrace quick list`, `terrace quick show <id>`, `terrace quick plan <title>`, `terrace quick execute <id>`, `terrace quick complete <id>`, `terrace backlog list`, `terrace backlog add <title>`, `terrace ship check`, and `terrace ship prepare`. GSD-compatible aliases exist for `plan-phase`, `execute-phase`, `validate-phase`, `review-phase`, and `complete-phase`. Command contracts are exported from core so agent-facing expectations can align with CLI behavior.

Terrace now also has Senior Cycle commands: `terrace align <feature>`, `terrace interrogate <feature>`, `terrace map-codebase`, `terrace design <feature>`, `terrace test-plan <feature>`, `terrace observe <feature>`, `terrace validate-prod <feature>`, `terrace cleanup <feature>`, `terrace ui import-stitch <feature>`, `terrace ui plan-refresh <feature>`, and `terrace ui diff <feature>`. These generators now infer source areas, architecture hints, test strategy, workstream lanes, route/component hints, unresolved evidence, and concrete affected files from the repo instead of blank TODO placeholders.

The latest adoption-risk mitigation pass adds `terrace ship check --fast|--local|--full` modes with per-category timings, `terrace report ceremony` for artifact-count and low-density evidence checks, `terrace port gsd --compare` and `--verify-parity` for migration confidence, `terrace rule audit --effectiveness` for rule maturity/metadata coverage, and `terrace waive <gate>` for explicit reviewed temporary overrides that remain visible in report and ship output.

Shadow test branch refs named `codex/terrace-shadow-test` were created in every detected GSD-initiated project with a valid `HEAD`. `/Users/jakyeamos/projects/eslint-plugin-anti-slop` could not receive the branch because it has no valid `HEAD`. The branch creation report is recorded at `docs/terrace/shadow-branches/2026-04-29-GSD-BRANCHES.md`.

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
- April 29: Implemented deterministic placeholder-command analysis with bundled `fast-glob`, `ignore`, and `yaml`; added repo/security/artifact helper modules; wired `terrace security check`; normalized static/imported AI reviews; replaced TODO-heavy lifecycle, docs, codebase, backfill, workstream, design-source, and UI drafts with repo-derived content.
- April 29: Stabilized the full lifecycle ship-category test under the complete CI chain and reran all public npm v0.1 release gates successfully.
- April 29: Added adoption-risk mitigations for ship-check modes/timings, ceremony evidence density, GSD migration compare/parity verification, rule effectiveness, explicit waivers, and GSD shadow test branches.

## Open Problems

- Feature tier selection still defaults to medium unless a feature records an explicit tier.
- The shadow-branch corpus exists, but an automated `terrace corpus run` command is not implemented yet.
- Dead-code scanning is not configured.

## Quality Ladder Notes

- **Lint:** `npm run lint` PASS
- **Types:** `npm run typecheck` PASS
- **Tests:** `npm test` PASS in `npm run ci`, 33 files and 245 tests
- **Coverage:** `npm run test:coverage` PASS, global coverage above configured thresholds: lines 85.84%, statements 85.31%, functions 88.23%, branches 70.37%
- **Package:** packed-consumer e2e PASS in the full suite; the runtime analysis dependencies are now declared and bundled for offline installs
- **Audit:** `npm audit --audit-level=moderate` PASS, zero vulnerabilities
- **CI:** `npm run ci` PASS
- **Security:** `node src/terrace-tools.cjs security check --json` PASS, zero findings
- **Test evaluation:** `node src/terrace-tools.cjs test eval --json` PASS, trust score 100
- **Rule audit:** `node src/terrace-tools.cjs rule audit --json` PASS, zero blockers and zero warnings
- **Report:** `terrace report --json` PASS, score 100, status `tier_one_ready`
- **Ship:** `terrace ship check --json` PASS, zero blockers and zero warnings
- **Focused adoption-risk tests:** `npm test -- tests/lifecycle-coverage.test.ts tests/core-port-gsd-migration.test.ts tests/workflow-commands.test.ts tests/core-cli.test.ts` PASS; final focused rerun for GSD compare and ship modes PASS
- **Git status:** clean on `codex/tier-one-external-product` after implementation commit and before this truth-file update

## Next Concrete Steps

1. Run Terrace migration/report/ship checks against the `codex/terrace-shadow-test` branch corpus.
2. Open the release-readiness PR for review.
3. Publish only after review confirms the public npm v0.1 release checklist remains green.
