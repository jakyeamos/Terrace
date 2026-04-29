---
schemaVersion: 1
projectName: Terrace
summary: Terrace now has a publishable CLI foundation and a substantially stronger GSD switch path with rich migration, stateful phase and quick-task workflows, adaptive project command discovery, autonomous stop-on-blocker orchestration, plain-text command routing for agents, stronger shipping preparation, and real-project smoke coverage.
healthScore: 97
statusLabel: gsd_switch_execution_parity_improved
nextStep: Add installed-package e2e coverage that runs the packed CLI from a temporary consumer project and exercises autonomous/plain-text routing.
blockers: []
lastUpdated: 2026-04-28
tags: [framework, ai-tooling, governance, spec-driven, cli]
areas: [cli, validation, lifecycle, presets, templates, packaging, ci, docs]
goals:
  - Keep Terrace publishable and recoverable from repo state
  - Prove governance workflows through packed CLI fixture tests
  - Expand migration and rule contracts without weakening hard gates
repoType: library
sourceOfTruth: .terrace/state.json
primaryLanguage: TypeScript
activeBranch: codex/extract-legacy-core
lastCommitDate: "2026-04-28"
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
---

## Current State

The first tier-one product gate is implemented. Terrace exposes a publishable npm CLI surface, documented install/quickstart/commands/troubleshooting, hard local CI, GitHub CI, release dry-run workflow, support docs, and an allowlisted package payload. The repo now dogfoods Terrace through `.terrace/state.json`; `terrace doctor` and `terrace audit` are healthy.

The `terrace port gsd` coding gap is now substantially mitigated: it converts core project files, roadmap phase headings, phase plans, phase summaries, research/context/UI specs, testing artifacts, debug/milestone archives, decisions, quick-task PLAN/SUMMARY history, backlog items, sessions, handoff state, and blocked human actions into Terrace state/docs while preserving source `.planning` files. Migration reports now include converted/skipped/writes, blockers, warnings, readiness, next command, review checklist, and validation commands.

Terrace also has GSD-style workflow continuity commands: `terrace next`, `terrace resume`, `terrace history`, `terrace do <plain text>`, `terrace autonomous`, `terrace commands discover`, `terrace phase list`, `terrace phase show <id>`, `terrace phase plan <id>`, `terrace phase execute <id>`, `terrace phase validate <id>`, `terrace phase review <id>`, `terrace phase complete <id>`, `terrace quick list`, `terrace quick show <id>`, `terrace quick plan <title>`, `terrace quick execute <id>`, `terrace quick complete <id>`, `terrace backlog list`, `terrace backlog add <title>`, `terrace ship check`, and `terrace ship prepare`. GSD-compatible aliases exist for `plan-phase`, `execute-phase`, `validate-phase`, `review-phase`, and `complete-phase`. Command contracts are exported from core so agent-facing expectations can align with CLI behavior.

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

## Open Problems

- Installed-package fixture e2e coverage is still thinner than the desired full product gate.
- `npm audit --audit-level=high` passes, but npm reports one moderate PostCSS advisory in the dev dependency tree.
- Dead-code scanning is not configured.

## Quality Ladder Notes

- **Lint:** `npm run lint` PASS
- **Types:** `npm run typecheck` PASS
- **Tests:** `npm test` PASS, 208 tests
- **Coverage:** `npm run test:coverage` PASS, global coverage above configured thresholds
- **Package:** `npm run package:dry-run` PASS, 47 allowlisted files
- **Audit:** `npm audit --audit-level=high` PASS, one moderate advisory remains

## Next Concrete Steps

1. Add installed-package e2e tests that run the packed CLI from a temporary consumer project.
2. Add packed CLI migration smoke tests for autonomous, project command discovery, phase execution queues, history, and quick-task commands.
3. Expand `terrace do <plain text>` fixture coverage against real migrated GSD phrasing.
4. Add schema validation for user-editable rule and config files.
5. Decide whether to address the moderate PostCSS advisory now or track it as acceptable dev-dependency risk.
