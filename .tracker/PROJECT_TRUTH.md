---
schemaVersion: 1
projectName: Terrace
summary: Terrace is a Node 22, pnpm-first CLI/library for spec-driven AI development. The GPT-5.6 modernization plan is committed on an isolated branch; implementation begins with package-installability and state-safety containment before architecture or UX refactoring.
healthScore: 35
statusLabel: planning_with_release_blockers
nextStep: Begin Milestone 0—remove the incomplete dependency bundle while preserving fresh-consumer packaging coverage.
blockers:
  - Fresh packed consumer cannot run `terrace --help` because `fast-glob` transitive dependencies are absent.
  - `terrace init` overwrites existing workflow state/configuration/rules and must be made safe before release.
risks:
  - Whole-file `.terrace/state.json` writes are non-atomic and unsafe under concurrent agents.
  - Security/readiness evidence can be stale or falsely green.
lastUpdated: 2026-07-14
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
lastCommitDate: "2026-07-14"
quality:
  lint: pass
  types: misleading_pass
  tests: fail_release_smoke
  coverage: not_rerun
  package: false_green
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
lastVerifiedCommand: pnpm lint && node src/terrace-tools.cjs spec validate --json
lastVerifiedAt: "2026-07-14T02:06:42-04:00"
---

## Current State

The isolated modernization branch contains the audit, target architecture, execution plan, codebase map, feature alignment, behavior-first test plan, validation, observability, and cleanup artifacts. No application implementation has started. The plan preserves public CLI/JSON/exit-code and `.terrace` artifact contracts while repairing release integrity, initialization safety, state persistence, command metadata, and the CLI experience in vertical milestones.

The immediate implementation boundary is intentionally narrow: repair the fresh-consumer package failure without papering over individual transitive dependencies. The committed baseline confirms that `bundledDependencies` contains direct packages but omits `fast-glob` transitives such as `glob-parent`.

## Recent Progress

- July 14: Committed `1269a86` with the GPT-5.6 modernization audit, target, execution plan, Terrace planning artifacts, and current report evidence.
- July 14: Baseline verification found `pnpm test` at 305 passed / 1 failed / 1 skipped; the packed-consumer CLI cannot resolve `glob-parent`.
- July 14: Confirmed `terrace init` resets existing workflow state and configuration; an isolated accidental-init reproduction was restored from the committed baseline.
- July 14: Verified `pnpm lint` and `terrace spec validate --json` after planning artifacts; both passed.

## Open Problems

- The release candidate is not publishable until a clean consumer can execute the package.
- `init` needs idempotent/repair semantics and a deliberate backup-producing reset path.
- Runtime CommonJS is outside the current TypeScript gate; lint and security evidence need stronger coverage/freshness guarantees.
- `ship check` documentation and side-effect behavior disagree; command metadata remains duplicated.

## Quality Ladder Notes

| Check | Current evidence |
| --- | --- |
| Lint | `pnpm lint` PASS; broad text/syntax scan, not semantic linting. |
| Types | `pnpm typecheck` PASS, but excludes production CommonJS core. |
| Tests | FAIL: packed-consumer smoke cannot resolve `glob-parent`; 305 passed / 1 failed / 1 skipped. |
| Package | `pnpm package:dry-run` passes but is false green because a fresh installed consumer cannot run. |
| Dependency audit | `pnpm dependency:security` PASS with no advisory at moderate or above. |
| Secret scan | PASS, with source-selection/CI scope still to improve. |
| Governance | `terrace spec validate --json` PASS; planning state is intentionally not release-ready. |

## Next Concrete Steps

1. Implement and test removal of the incomplete dependency bundle; retain fresh-consumer regression coverage.
2. Commit the package containment change, then update this snapshot.
3. Implement idempotent initialization and state preservation with behavior-first tests.
4. Continue through the approved vertical modernization plan in `docs/modernization/EXEC_PLAN.md`.
