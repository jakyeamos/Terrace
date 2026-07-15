---
schemaVersion: 1
projectName: Terrace
summary: Terrace is a Node 22, pnpm-first CLI/library for spec-driven AI development. The GPT-5.6 modernization branch now has fresh-consumer package containment, recoverable initialization/reset semantics, durable state persistence, a shared managed-artifact boundary, explicit state-bound natural-language applies, no ambient self-invocation, read-only audits, a canonical command catalog with verified source-owned generated assets, lower-level project command discovery, shared debt assessment, release-preflight and ship-readiness policy behind injected workflow adapters, an isolated senior-cycle domain for artifacts/state/gates, and phase plus senior-cycle/UI CLI compatibility routers.
healthScore: 93
statusLabel: modernization_in_progress_domain_seams
nextStep: Extract the release-readiness CLI router as a bounded compatibility adapter while preserving public argv, JSON, and exit behavior.
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
  tests: pass_full_ci_after_979ae32
  coverage: pass_ci_coverage_gate
  package: pass_fresh_pnpm_consumer
  auditHigh: pass
  auditModerate: pass
  deadCode: not_configured
  structure: milestone_4_senior_cycle_cli_router_extracted
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
lastVerifiedAt: "2026-07-14T20:39:50-04:00"
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

Project command discovery now owns package-script inspection, dead-code gate configuration, and agent-asset readiness warnings. `workflow.cjs` retains its exported compatibility function, while `adoption.cjs` imports the lower-level owner directly; a fresh-process test proves that adoption no longer initializes the workflow orchestrator.

Unresolved-debt policy now lives in one pure module. Lifecycle, report, and ship checks retain remediation guidance, while feature-scoped workbench status retains its lean blocker contract; direct tests cover resolved entries, feature filtering, finding order, and every public projection without invoking Terrace to repair Terrace.

Release-preflight policy now lives below the workflow orchestrator. It owns release-flow, tag, trusted-publishing, and stale-artifact checks; workflow supplies only dirty-tree and ship-check adapters, and fresh-process tests prove the new module does not initialize workflow orchestration.

Ship-readiness policy now lives below workflow. It owns fast/local/full readiness selection, project-script and dead-code gates, category timing/aggregation, and the `ship prepare` artifact; workflow injects senior-cycle and release-specific evidence, while shared ship modes live below both readiness and release-preflight domains. Fresh-process, injected-contract, workflow/CLI parity, and full clean-consumer CI verification passed.

Senior-cycle operations now live below workflow. The domain owns artifact generation, state recording, gate evaluation, and ship evidence while importing only lower-level services; workflow retains identity-compatible public exports and phase, quick-task, and autonomous orchestration. Direct large-tier, read-only ship-evidence, fresh-process, and full clean-consumer CI verification passed.

The phase CLI command family now lives behind a small compatibility router. It injects core operations, preserves canonical and GSD-compatible forms plus `phase set`, and returns results to the unchanged top-level renderer for JSON/human formatting and exit handling. Direct, child-process, and full clean-consumer CI verification passed.

Senior-cycle and UI CLI commands now live behind a separate compatibility router. It injects their lower-level operations, keeps answer/tier options lazy for `map-codebase` and UI routes, preserves the exact UI error contract, and returns data to the unchanged top-level renderer for human/JSON formatting and exit handling. Direct, production-lifecycle, child-process, and full clean-consumer CI verification passed.

## Recent Progress

- July 14: Committed `979ae32`; isolated senior-cycle/UI command routing with lazy option evaluation and unchanged JSON/error rendering, then passed full network-enabled CI with coverage and fresh packed-consumer smoke.
- July 14: Committed `c9dc05a`; isolated canonical and GSD-compatible phase CLI routing behind injected core operations while preserving renderer/exit behavior, then passed full network-enabled CI with coverage and fresh packed-consumer smoke.
- July 14: Committed `8cb6d37`; isolated senior-cycle artifacts, state, gates, and ship evidence behind an identity-compatible workflow facade, then passed full network-enabled CI with coverage and fresh packed-consumer smoke.
- July 14: Committed `daa2b4c`; isolated ship-readiness policy with injected senior-cycle and release evidence, removed the release/readiness dependency edge, and passed full network-enabled CI with coverage and fresh packed-consumer smoke.
- July 14: Committed `1c88e0e`; isolated release-preflight policy behind injected dirty-tree and ship-check adapters, preserved public CLI/API behavior, and passed full network-enabled CI with coverage and fresh packed-consumer smoke.
- July 14: Committed `8018e84`; centralized unresolved-debt assessment, preserved lifecycle remediation and workbench response shapes, and passed full network-enabled CI with coverage and fresh packed-consumer smoke.
- July 14: Committed `bfc19d4`; extracted project command discovery, removed the adoption/workflow dependency cycle, preserved strict package parsing and workflow export compatibility, and passed full network-enabled CI.
- July 14: Committed `92fcde1`; source-owned generated agent assets now have content and Git-tracking parity checks without self-invocation. Full network-enabled CI passed: 398 tests / 1 existing skip, coverage, and package dry run.
- July 14: Committed `de82ea2`; README command index and natural-language plans now derive from the catalog. 56 focused workflow/catalog/product tests, typecheck, and lint passed.
- July 14: Committed `d3d1e69`; one command catalog now drives help, agent metadata, contracts, and packed-consumer surface coverage. Focused catalog/agent tests, typecheck, lint, and packed-consumer test passed.
- July 14: Committed `3f113f4`; natural-language writes now require state-bound explicit apply, audit is read-only, agent drift is visible, ship prepare avoids self-dirtying, and adoption avoids ambient self-invocation. `pnpm run ci` passed.
- July 14: Committed `05369a4`; release integrity now requires fresh source-scoped security evidence, uses a read-only default ship check, and gates full/release execution behind a clean Git snapshot. `pnpm run ci` passed: 385 tests / 1 skipped, coverage, and package dry run.
- July 14: Committed `cd44e3b`; autonomous routing now stops safely on active features, avoids unrelated phase writes, and preserves migration precedence. Three direct regression tests plus `pnpm run ci` passed.
- July 14: Committed `43da5a8`; added managed/project artifact path safety, recovery-aware serialization, atomic persistence, transaction recovery, and 79 focused regression tests. `pnpm run ci` passed: 373 tests / 1 skipped, coverage, and package dry run.
- July 14: Committed `03bd2ab`; schema `1.1` state store adds atomic writes, validation, revision conflicts, recovery-aware locking, and safe reset preflight.

## Open Problems

- A real release must regenerate `terrace security check` evidence after source, lockfile, or relevant configuration changes; this is an intentional release blocker, not a false-green fallback.
- Release-readiness command routing is the next independent CLI seam; lifecycle reporting remains an orchestration hotspot until it has a lower-level owner.
- Runtime CommonJS is outside the current TypeScript gate; semantic coverage remains a later modernization concern.
- Managed files rely on cooperative locking and permission-controlled project directories; same-user hostile replacement races remain a documented residual risk.

## Quality Ladder Notes

| Check | Current evidence |
| --- | --- |
| Lint | `pnpm lint` PASS; broad text/syntax scan, not semantic linting. |
| Types | `pnpm typecheck` PASS, but excludes production CommonJS core. |
| Tests | `pnpm run ci` PASS after `979ae32`; phase/senior-cycle/UI routers, senior-cycle, ship-readiness, release-policy, debt-projection, and import-boundary coverage, coverage gate, and fresh-consumer package smoke pass. |
| Package | `pnpm package:dry-run` PASS and the packed CLI runs in a clean pnpm consumer. |
| Dependency audit | `pnpm dependency:security` PASS with no advisory at moderate or above. |
| Security evidence | Missing, legacy, incomplete, or source/config/lock-stale evidence blocks release readiness; `terrace security check` is the explicit writer. |
| Governance | `terrace spec validate --json` PASS; planning state is intentionally not release-ready. |

## Next Concrete Steps

1. Extract the release-readiness CLI router with injected core operations while retaining the existing renderer and exit behavior.
2. Prepare a true lower-level reporting-domain extraction before routing report commands.
3. Generate fresh security evidence once a release candidate is frozen, then run the intended full release gates on its clean snapshot.
