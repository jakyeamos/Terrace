---
schemaVersion: 1
projectName: Terrace
summary: Terrace is a Node 22, pnpm-first CLI/library for spec-driven AI development. The GPT-5.6 modernization branch has repaired its fresh-consumer package failure; state-safety containment is the next release blocker.
healthScore: 45
statusLabel: modernization_in_progress_with_release_blockers
nextStep: Begin Milestone 1—make `terrace init` idempotent and preserve existing user state by default.
blockers:
  - `terrace init` overwrites existing workflow state/configuration/rules and must be made safe before release.
risks:
  - Whole-file `.terrace/state.json` writes are non-atomic and unsafe under concurrent agents.
  - Security/readiness evidence can be stale or falsely green.
lastUpdated: 2026-07-13
tags: [framework, ai-tooling, governance, cli, modernization]
areas: [cli, packaging, state, lifecycle, security, docs]
goals:
  - Keep Terrace installable, recoverable, and honest about readiness.
  - Preserve public CLI, JSON, artifact, agent, and GSD migration contracts through modernization.
  - Replace duplicate command metadata with one maintainable command model.
repoType: library
sourceOfTruth: .terrace/state.json
primaryLanguage: JavaScript CommonJS with TypeScript tests/configuration
activeBranch: codex/gpt56-modernization
lastCommitDate: "2026-07-13"
quality:
  lint: pass
  types: misleading_pass
  tests: pass_306_with_1_skipped
  coverage: pass_87_36_percent
  package: pass_fresh_pnpm_consumer
  auditHigh: pass
  auditModerate: pass
  deadCode: not_configured
  structure: modernization_planned
canonicalCommands:
  install: pnpm install
  dev: unknown
  lint: pnpm lint
  typecheck: pnpm typecheck
  test: pnpm test
  coverage: pnpm test:coverage
  package: pnpm package:dry-run
  ci: pnpm run ci
  audit: pnpm audit --audit-level moderate
  deadcode: unknown
agentExpectationsVersion: 2
lastVerifiedCommand: pnpm run ci
lastVerifiedAt: "2026-07-13T22:14:15-04:00"
---

## Current State

The isolated modernization branch contains the audit, target architecture, execution plan, codebase map, feature alignment, behavior-first test plan, validation, observability, and cleanup artifacts. Its first implementation unit is committed: package installation now delegates all runtime dependencies to the package manager rather than attempting an incomplete manual bundle.

The next implementation boundary is initialization safety. It must preserve existing `.terrace` workflow state, configuration, preset, and rules files by default; a deliberate reset path needs an explicit backup and confirmation contract.

## Recent Progress

- July 13: Committed `ba92e8d`; removing incomplete `bundledDependencies` restores the packed CLI in a fresh pnpm consumer.
- July 13: `pnpm run ci` passed: typecheck, lint, 306 tests / 1 skipped, 87.36% statement coverage, and package dry run.
- July 13: Committed `1269a86` with the GPT-5.6 modernization audit, target, execution plan, Terrace planning artifacts, and current report evidence.
- July 13: Confirmed `terrace init` resets existing workflow state and configuration; an isolated accidental-init reproduction was restored from the committed baseline.

## Open Problems

- `init` needs idempotent/repair semantics and a deliberate backup-producing reset path.
- Runtime CommonJS is outside the current TypeScript gate; lint and security evidence need stronger coverage/freshness guarantees.
- `ship check` documentation and side-effect behavior disagree; command metadata remains duplicated.

## Quality Ladder Notes

| Check | Current evidence |
| --- | --- |
| Lint | `pnpm lint` PASS; broad text/syntax scan, not semantic linting. |
| Types | `pnpm typecheck` PASS, but excludes production CommonJS core. |
| Tests | `pnpm run ci` PASS: 306 passed / 1 skipped; fresh-consumer package smoke passes. |
| Package | `pnpm package:dry-run` PASS and the packed CLI runs in a clean pnpm consumer. |
| Dependency audit | `pnpm dependency:security` PASS with no advisory at moderate or above. |
| Secret scan | PASS, with source-selection/CI scope still to improve. |
| Governance | `terrace spec validate --json` PASS; planning state is intentionally not release-ready. |

## Next Concrete Steps

1. Implement idempotent initialization and state preservation with behavior-first tests.
2. Define and test an explicit backup-producing reset path.
3. Continue through the approved vertical modernization plan in `docs/modernization/EXEC_PLAN.md`.
