---
schemaVersion: 1
projectName: Terrace
summary: Terrace is a Node 22, pnpm-first CLI/library for spec-driven AI development. The GPT-5.6 modernization branch now has fresh-consumer package containment, recoverable initialization/reset semantics, durable state persistence, a shared managed-artifact boundary, explicit state-bound natural-language applies, no ambient self-invocation, read-only audits, and a canonical command catalog with verified source-owned generated assets, help, metadata, contracts, README validation, packed-consumer coverage, and natural-language argv plans.
healthScore: 86
statusLabel: modernization_in_progress_catalog_verified
nextStep: Extract project command discovery from workflow orchestration so adoption no longer depends on the workflow module.
blockers:
  - A release candidate needs a current `terrace security check` artifact; missing, legacy, incomplete, or source/config/lock-stale evidence intentionally blocks.
risks:
  - A hostile same-user process with direct directory write access can still race a final filesystem pathname replacement; the managed lock is not an isolation boundary.
  - Runtime CommonJS remains outside the TypeScript gate.
lastUpdated: 2026-07-14
tags: [framework, ai-tooling, governance, cli, modernization]
areas: [cli, packaging, state, lifecycle, security, command-routing, agents, docs]
goals:
  - Keep Terrace installable, recoverable, and honest about readiness.
  - Preserve public CLI, JSON, artifact, agent, and GSD migration contracts through modernization.
  - Keep source-owned generated assets in catalog parity without silently overwriting bespoke or user-owned guidance.
repoType: library
sourceOfTruth: .terrace/state.json
primaryLanguage: JavaScript CommonJS with TypeScript tests/configuration
activeBranch: codex/gpt56-modernization
lastCommitDate: "2026-07-14"
quality:
  lint: pass
  types: pass_commonjs_outside_typecheck
  tests: pass_full_ci_after_92fcde1
  coverage: pass_ci_coverage_gate
  package: pass_fresh_pnpm_consumer
  auditHigh: pass
  auditModerate: pass
  deadCode: not_configured
  structure: milestone_2_command_catalog_and_assets_verified
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
lastVerifiedCommand: "pnpm run ci"
lastVerifiedAt: "2026-07-14T18:00:40-04:00"
---

## Current State

The isolated modernization branch contains the audit, target architecture, execution plan, codebase map, feature alignment, behavior-first test plan, validation, observability, and cleanup artifacts. Its first three containment units are committed: package installation delegates all runtime dependencies to the package manager, initialization preserves established Terrace artifacts by default, and the state store now protects state integrity.

Ordinary `terrace init` repairs missing artifacts without changing established state, configuration, presets, rules, or events. Deliberate `terrace init --force --yes` creates a retained backup, rolls back managed artifacts if reset writes fail, and reports recovery details. `terrace agents repair` handles missing generated assets without changing workflow state.

State schema `1.1` is validated at runtime. Historical `1.0` state is promoted in memory, normal writes require the exact loaded revision/fingerprint, and intentional replacement is explicit. State files reject unsafe paths, write through a fsynced temporary file plus parent-directory sync where supported, and use a recovery-aware lock so stale-lock reclamation cannot remove a replacement writer lock.

Configuration, rules, policy, presets, events, manifests, sessions, security evidence, migration reports, lifecycle JSON, and project-generated artifacts now use a shared managed-artifact boundary. It pins directories, rejects unsafe paths, serializes cooperative writers, writes atomically, and recovers prepared preset transactions. The independent review also closed global-root ancestor symlink handling, failed-init lock scaffolding, and decision-log authorization gaps.

Autonomous routing now preserves active work. A gate-complete active senior feature returns a structured, read-only handoff—phase inspection when it maps to the roadmap and workbench status when it does not—rather than silently planning the first roadmap phase. Explicit migration commands retain precedence, and phase mutation still requires an explicit command.

Release integrity now fails closed on current, schema-versioned security evidence. The source/configuration/lockfile fingerprint covers Docker and Git ignore rules, scans incrementally without retaining the whole repository in memory, rejects symlink escapes, and treats unavailable dependency-audit JSON as blocking. Plain `ship check` is read-only and fast; `--local` adds Git status, while `--full` runs project scripts only after a clean Git snapshot. Dynamic release preflight also skips release-flow commands on a dirty checkout, and `ship prepare` remains the explicit, writing full-check path.

Natural-language routing now previews every write-capable route with a state-bound local apply token, exact known Terrace artifact scope, and any external execution effects. Only `terrace do --apply <token>` invokes a routed write; the exported route helper remains preview-only for writes. State-mutating routes retain the managed-artifact lock through revision validation and execution, while `ship prepare` runs its full check before its brief managed write so the lock cannot make its own Git snapshot dirty. Audit no longer refreshes report artifacts, root instruction-file drift is reported without overwriting user guidance, and adoption no longer probes an ambient `terrace` executable. A missing independent installation comparison is surfaced as unverified rather than a false aligned pass.

The canonical command catalog now drives CLI help, generated-agent metadata, the published contract projection, and the packed-consumer command-surface test. It models 106 command forms, including compatibility and internal forms, and makes `port gsd --compare`, `port gsd --verify-parity`, and `design-source diff` explicit instead of allowing them to drift between dispatch, help, and agents. The existing CLI dispatcher remains unchanged pending a separately verified handler-seam migration.

The README command index is now a checked projection of the catalog, and natural-language plans reference catalog command IDs plus safe argv arrays. The human-readable command field remains a compatibility display only; execution continues through direct domain handlers and the explicit state-bound apply token rather than a shell command string.

Catalog-owned source assets are now a separate, read-only parity surface: 252 generated Codex/Claude files must match their templates and be tracked when checked from a Git worktree. This protects a clean clone without invoking Terrace's consumer installer or repair command against Terrace itself. Root bootstrap guidance and the five bespoke governance skills remain outside that generated scope.

## Recent Progress

- July 14: Committed `92fcde1`; source-owned generated agent assets now have content and Git-tracking parity checks without self-invocation. Full network-enabled CI passed: 398 tests / 1 existing skip, coverage, and package dry run.
- July 14: Committed `de82ea2`; README command index and natural-language plans now derive from the catalog. 56 focused workflow/catalog/product tests, typecheck, and lint passed.
- July 14: Committed `d3d1e69`; one command catalog now drives help, agent metadata, contracts, and packed-consumer surface coverage. Focused catalog/agent tests, typecheck, lint, and packed-consumer test passed.
- July 14: Committed `3f113f4`; natural-language writes now require state-bound explicit apply, audit is read-only, agent drift is visible, ship prepare avoids self-dirtying, and adoption avoids ambient self-invocation. `pnpm run ci` passed.
- July 14: Committed `05369a4`; release integrity now requires fresh source-scoped security evidence, uses a read-only default ship check, and gates full/release execution behind a clean Git snapshot. `pnpm run ci` passed: 385 tests / 1 skipped, coverage, and package dry run.
- July 14: Committed `cd44e3b`; autonomous routing now stops safely on active features, avoids unrelated phase writes, and preserves migration precedence. Three direct regression tests plus `pnpm run ci` passed.
- July 14: Committed `43da5a8`; added managed/project artifact path safety, recovery-aware serialization, atomic persistence, transaction recovery, and 79 focused regression tests. `pnpm run ci` passed: 373 tests / 1 skipped, coverage, and package dry run.
- July 14: Committed `03bd2ab`; schema `1.1` state store adds atomic writes, validation, revision conflicts, recovery-aware locking, and safe reset preflight.
- July 14: `pnpm run ci` passed: typecheck, lint, 329 tests / 1 skipped, coverage gate, and package dry run.
- July 13: Committed `757a283`; safe init preserves existing artifacts, force reset is backup/rollback recoverable, and agent repair is state-preserving.
- July 13: Committed `ba92e8d`; removing incomplete `bundledDependencies` restores the packed CLI in a fresh pnpm consumer.
- July 13: Committed `1269a86` with the GPT-5.6 modernization audit, target, execution plan, Terrace planning artifacts, and current report evidence.

## Open Problems

- A real release must regenerate `terrace security check` evidence after source, lockfile, or relevant configuration changes; this is an intentional release blocker, not a false-green fallback.
- Runtime CommonJS is outside the current TypeScript gate; semantic coverage remains a later modernization concern.
- Managed files rely on cooperative locking and permission-controlled project directories; same-user hostile replacement races remain a documented residual risk.

## Quality Ladder Notes

| Check | Current evidence |
| --- | --- |
| Lint | `pnpm lint` PASS; broad text/syntax scan, not semantic linting. |
| Types | `pnpm typecheck` PASS, but excludes production CommonJS core. |
| Tests | `pnpm run ci` PASS after `92fcde1`: 398 tests / 1 existing skip, coverage, and fresh-consumer package smoke. |
| Package | `pnpm package:dry-run` PASS and the packed CLI runs in a clean pnpm consumer. |
| Dependency audit | `pnpm dependency:security` PASS with no advisory at moderate or above. |
| Security evidence | Missing, legacy, incomplete, or source/config/lock-stale evidence blocks release readiness; `terrace security check` is the explicit writer. |
| Governance | `terrace spec validate --json` PASS; planning state is intentionally not release-ready. |

## Next Concrete Steps

1. Extract project command discovery into a lower-level module, preserving its workflow compatibility export and public behavior.
2. Continue splitting catalog-aware dispatcher/domain seams without changing public argv, JSON, or exit behavior.
3. Generate fresh security evidence once a release candidate is frozen, then run the intended full release gates on its clean snapshot.
