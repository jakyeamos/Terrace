---
schemaVersion: 1
projectName: Terrace
summary: Terrace now has a publishable CLI foundation and a stronger GSD port path that converts core planning artifacts into Terrace docs/state with explicit skipped-artifact reporting.
healthScore: 88
statusLabel: tier_one_foundation_ready
nextStep: Extend GSD migration to per-phase plans, decision history, session history, and richer requirements mapping.
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

The `terrace port gsd` coding gap is partially mitigated: it now converts `.planning/PROJECT.md` to `docs/prd/PRD.md`, `.planning/REQUIREMENTS.md` to `docs/spec/COMPILED-SPEC.md`, `.planning/STATE.md` to `docs/terrace-migration/GSD-STATE.md`, extracts roadmap phase headings into Terrace state, preserves source `.planning` files, avoids overwriting migrated docs without `--force`, and reports unsupported artifacts for manual review.

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

## Open Problems

- `terrace port gsd` does not yet convert per-phase plans, decision history, session history, or richly structured requirements.
- Installed-package fixture e2e coverage is still thinner than the desired full product gate.
- `npm audit --audit-level=high` passes, but npm reports one moderate PostCSS advisory in the dev dependency tree.
- Dead-code scanning is not configured.

## Quality Ladder Notes

- **Lint:** `npm run lint` PASS
- **Types:** `npm run typecheck` PASS
- **Tests:** `npm test` PASS, 190 tests
- **Coverage:** `npm run test:coverage` PASS, global coverage above configured thresholds
- **Package:** `npm run package:dry-run` PASS, 45 allowlisted files
- **Audit:** `npm audit --audit-level=high` PASS, one moderate advisory remains

## Next Concrete Steps

1. Add installed-package e2e tests that run the packed CLI from a temporary consumer project.
2. Expand GSD migration to convert per-phase plans, decision history, session history, and richer requirements structure.
3. Add schema validation for user-editable rule and config files.
4. Decide whether to address the moderate PostCSS advisory now or track it as acceptable dev-dependency risk.
