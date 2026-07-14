---
schemaVersion: 1
projectName: Terrace
summary: Terrace is a Node 22, pnpm-first CLI/library for spec-driven AI development. The GPT-5.6 modernization branch now has fresh-consumer package containment plus recoverable initialization/reset semantics; atomic state-store safety is the next release blocker.
healthScore: 58
statusLabel: modernization_in_progress_with_release_blockers
nextStep: Continue Milestone 1 with an atomic, validated state-store seam and concurrent-write protection.
blockers:
  - Whole-file `.terrace/state.json` writes remain non-atomic and lack concurrent-writer protection.
  - Managed state/config/rule paths need shared path-safety validation before release.
risks:
  - Security/readiness evidence can be stale or falsely green.
  - `ship check` still has documented read-only behavior that does not match every observed write path.
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
  tests: pass_316_with_1_skipped
  coverage: pass_87_71_percent
  package: pass_fresh_pnpm_consumer
  auditHigh: pass
  auditModerate: pass
  deadCode: not_configured
  structure: milestone_1_in_progress
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
lastVerifiedAt: "2026-07-13T22:52:25-04:00"
---

## Current State

The isolated modernization branch contains the audit, target architecture, execution plan, codebase map, feature alignment, behavior-first test plan, validation, observability, and cleanup artifacts. Its first two containment units are committed: package installation delegates all runtime dependencies to the package manager, and initialization now preserves established Terrace artifacts by default.

Ordinary `terrace init` repairs missing artifacts without changing established state, configuration, presets, rules, or events. Deliberate `terrace init --force --yes` creates a retained backup, rolls back managed artifacts if reset writes fail, and reports recovery details. `terrace agents repair` handles missing generated assets without changing workflow state.

The next implementation boundary is the shared state store: atomic writes, runtime validation/migration, path safety, and conflict protection for concurrent agents.

## Recent Progress

- July 13: Committed `757a283`; safe init preserves existing artifacts, force reset is backup/rollback recoverable, and agent repair is state-preserving.
- July 13: `pnpm run ci` passed: typecheck, lint, 316 tests / 1 skipped, 87.71% statement coverage, and package dry run.
- July 13: Committed `ba92e8d`; removing incomplete `bundledDependencies` restores the packed CLI in a fresh pnpm consumer.
- July 13: Committed `1269a86` with the GPT-5.6 modernization audit, target, execution plan, Terrace planning artifacts, and current report evidence.

## Open Problems

- State persistence still writes whole files without atomic replacement, revisioning, or locking.
- Runtime CommonJS is outside the current TypeScript gate; lint and security evidence need stronger coverage/freshness guarantees.
- `ship check` documentation and side-effect behavior disagree; command metadata remains duplicated.

## Quality Ladder Notes

| Check | Current evidence |
| --- | --- |
| Lint | `pnpm lint` PASS; broad text/syntax scan, not semantic linting. |
| Types | `pnpm typecheck` PASS, but excludes production CommonJS core. |
| Tests | `pnpm run ci` PASS: 316 passed / 1 skipped; fresh-consumer package smoke passes. |
| Package | `pnpm package:dry-run` PASS and the packed CLI runs in a clean pnpm consumer. |
| Dependency audit | `pnpm dependency:security` PASS with no advisory at moderate or above. |
| Secret scan | PASS, with source-selection/CI scope still to improve. |
| Governance | `terrace spec validate --json` PASS; planning state is intentionally not release-ready. |

## Next Concrete Steps

1. Introduce atomic state writes, validation/migration, and conflict protection behind a shared state-store seam.
2. Add shared path-safety checks and interrupted-write recovery coverage for state/config/rule mutations.
3. Continue through the approved vertical modernization plan in `docs/modernization/EXEC_PLAN.md`.
