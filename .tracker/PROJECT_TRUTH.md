---
schemaVersion: 1
projectName: Terrace
summary: Terrace is a Node 22, pnpm-first CLI/library for spec-driven AI development. The GPT-5.6 modernization branch now has fresh-consumer package containment, recoverable initialization/reset semantics, durable state persistence, and a shared managed-artifact boundary; remaining Milestone 1 risks are evidence freshness and ship-check side effects.
healthScore: 72
statusLabel: modernization_in_progress_with_release_blockers
nextStep: Resolve stale security/readiness evidence and make ship-check behavior match its read-only contract.
blockers:
  - Security/readiness evidence can be stale or falsely green.
  - `ship check` documentation and observed write behavior still disagree.
risks:
  - A hostile same-user process with direct directory write access can still race a final filesystem pathname replacement; the managed lock is not an isolation boundary.
  - Runtime CommonJS remains outside the TypeScript gate.
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
lastCommitDate: "2026-07-13"
quality:
  lint: pass
  types: misleading_pass
  tests: pass_373_with_1_skipped
  coverage: pass_ci_coverage_gate
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
lastVerifiedAt: "2026-07-14T13:27:26-04:00"
---

## Current State

The isolated modernization branch contains the audit, target architecture, execution plan, codebase map, feature alignment, behavior-first test plan, validation, observability, and cleanup artifacts. Its first three containment units are committed: package installation delegates all runtime dependencies to the package manager, initialization preserves established Terrace artifacts by default, and the state store now protects state integrity.

Ordinary `terrace init` repairs missing artifacts without changing established state, configuration, presets, rules, or events. Deliberate `terrace init --force --yes` creates a retained backup, rolls back managed artifacts if reset writes fail, and reports recovery details. `terrace agents repair` handles missing generated assets without changing workflow state.

State schema `1.1` is validated at runtime. Historical `1.0` state is promoted in memory, normal writes require the exact loaded revision/fingerprint, and intentional replacement is explicit. State files reject unsafe paths, write through a fsynced temporary file plus parent-directory sync where supported, and use a recovery-aware lock so stale-lock reclamation cannot remove a replacement writer lock.

Configuration, rules, policy, presets, events, manifests, sessions, security evidence, migration reports, lifecycle JSON, and project-generated artifacts now use a shared managed-artifact boundary. It pins directories, rejects unsafe paths, serializes cooperative writers, writes atomically, and recovers prepared preset transactions. The independent review also closed global-root ancestor symlink handling, failed-init lock scaffolding, and decision-log authorization gaps.

## Recent Progress

- July 14: Committed `43da5a8`; added managed/project artifact path safety, recovery-aware serialization, atomic persistence, transaction recovery, and 79 focused regression tests. `pnpm run ci` passed: 373 tests / 1 skipped, coverage, and package dry run.
- July 14: Committed `03bd2ab`; schema `1.1` state store adds atomic writes, validation, revision conflicts, recovery-aware locking, and safe reset preflight.
- July 14: `pnpm run ci` passed: typecheck, lint, 329 tests / 1 skipped, coverage gate, and package dry run.
- July 13: Committed `757a283`; safe init preserves existing artifacts, force reset is backup/rollback recoverable, and agent repair is state-preserving.
- July 13: Committed `ba92e8d`; removing incomplete `bundledDependencies` restores the packed CLI in a fresh pnpm consumer.
- July 13: Committed `1269a86` with the GPT-5.6 modernization audit, target, execution plan, Terrace planning artifacts, and current report evidence.

## Open Problems

- Security/readiness evidence can be stale or falsely green.
- `ship check` documentation and side-effect behavior disagree.
- Runtime CommonJS is outside the current TypeScript gate; lint and security evidence need stronger coverage/freshness guarantees.
- Managed files rely on cooperative locking and permission-controlled project directories; same-user hostile replacement races remain a documented residual risk.

## Quality Ladder Notes

| Check | Current evidence |
| --- | --- |
| Lint | `pnpm lint` PASS; broad text/syntax scan, not semantic linting. |
| Types | `pnpm typecheck` PASS, but excludes production CommonJS core. |
| Tests | `pnpm run ci` PASS: 373 passed / 1 skipped; coverage and fresh-consumer package smoke pass. |
| Package | `pnpm package:dry-run` PASS and the packed CLI runs in a clean pnpm consumer. |
| Dependency audit | `pnpm dependency:security` PASS with no advisory at moderate or above. |
| Secret scan | PASS, with source-selection/CI scope still to improve. |
| Governance | `terrace spec validate --json` PASS; planning state is intentionally not release-ready. |

## Next Concrete Steps

1. Resolve stale security/readiness evidence and enforce fresh evidence where release claims depend on it.
2. Make ship-check behavior actually read-only or update its command contract and generated evidence model.
3. Continue through the approved vertical modernization plan in `docs/modernization/EXEC_PLAN.md`.
