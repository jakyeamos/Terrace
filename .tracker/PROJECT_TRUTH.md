---
schemaVersion: 1
projectName: Terrace
summary: Terrace is a Node 22, pnpm-first CLI/library for spec-driven AI development. The GPT-5.6 modernization branch now has an import-safe root library facade, a 78-file runtime-only publish payload, consumer-owned corpus evidence, recoverable initialization/reset semantics, durable state persistence, a shared managed-artifact boundary, explicit state-bound natural-language applies, no ambient self-invocation, mutation-safe command metadata, and a canonical command catalog that owns help, agents, contracts, natural-language argv, and inbound CLI dispatch through phase, senior/UI, release-readiness, report, and legacy compatibility adapters.
healthScore: 95
statusLabel: modernization_in_progress_final_hardening
nextStep: Close the root core-facade collision guard, then run the final adversarial modernization review.
blockers:
  - A release candidate needs a current `terrace security check` artifact; missing, legacy, incomplete, or source/config/lock-stale evidence intentionally blocks.
risks:
  - A hostile same-user process with direct directory write access can still race a final filesystem pathname replacement; the managed lock is not an isolation boundary.
  - Runtime CommonJS remains outside the TypeScript gate.
  - The root core facade still uses a broad export-spread barrel and needs an explicit collision guard.
lastUpdated: 2026-07-15
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
lastCommitDate: "2026-07-15"
quality:
  lint: pass
  types: pass_commonjs_outside_typecheck
  tests: pass_routing_ci_442_tests_1_skip_plus_focused_adapter_after_ac75f7f
  coverage: pass_ci_coverage_gate
  package: pass_fresh_pnpm_consumer_78_file_runtime_payload
  auditHigh: pass
  auditModerate: pass
  deadCode: not_configured
  structure: milestone_6_catalog_owned_cli_dispatch
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
lastVerifiedCommand: "pnpm run ci; pnpm test -- tests/command-catalog.test.ts tests/command-parser.test.ts tests/legacy-cli-router.test.ts tests/phase-cli-router.test.ts tests/senior-cycle-cli-router.test.ts tests/release-readiness-cli-router.test.ts tests/report-cli-router.test.ts tests/core-cli.test.ts tests/workflow-commands.test.ts; pnpm secret:scan; pnpm dependency:security"
lastVerifiedAt: "2026-07-15T11:56:47-04:00"
---

## Current State

The isolated modernization branch contains the audit, target architecture, execution plan, codebase map, feature alignment, behavior-first test plan, validation, observability, and cleanup artifacts. Its first three containment units are committed: package installation delegates all runtime dependencies to the package manager, initialization preserves established Terrace artifacts by default, and the state store now protects state integrity.

Ordinary `terrace init` repairs missing artifacts without changing established state, configuration, presets, rules, or events. Deliberate `terrace init --force --yes` creates a retained backup, rolls back managed artifacts if reset writes fail, and reports recovery details. `terrace agents repair` handles missing generated assets without changing workflow state.

State schema `1.1` is validated at runtime. Historical `1.0` state is promoted in memory, normal writes require the exact loaded revision/fingerprint, and intentional replacement is explicit. State files reject unsafe paths, write through a fsynced temporary file plus parent-directory sync where supported, and use a recovery-aware lock so stale-lock reclamation cannot remove a replacement writer lock.

Configuration, rules, policy, presets, events, manifests, sessions, security evidence, migration reports, lifecycle JSON, and project-generated artifacts now use a shared managed-artifact boundary. It pins directories, rejects unsafe paths, serializes cooperative writers, writes atomically, and recovers prepared preset transactions. The independent review also closed global-root ancestor symlink handling, failed-init lock scaffolding, and decision-log authorization gaps.

Autonomous routing now preserves active work. A gate-complete active senior feature returns a structured, read-only handoff—phase inspection when it maps to the roadmap and workbench status when it does not—rather than silently planning the first roadmap phase. Explicit migration commands retain precedence, and phase mutation still requires an explicit command.

Release integrity now fails closed on current, schema-versioned security evidence. The source/configuration/lockfile fingerprint covers Docker and Git ignore rules, scans incrementally without retaining the whole repository in memory, rejects symlink escapes, and treats unavailable dependency-audit JSON as blocking. Plain `ship check` is read-only and fast; `--local` adds Git status, while `--full` runs project scripts only after a clean Git snapshot. Dynamic release preflight also skips release-flow commands on a dirty checkout, and `ship prepare` remains the explicit, writing full-check path.

Natural-language routing now previews every write-capable route with a state-bound local apply token, exact known Terrace artifact scope, and any external execution effects. Only `terrace do --apply <token>` invokes a routed write; the exported route helper remains preview-only for writes. State-mutating routes retain the managed-artifact lock through revision validation and execution, while `ship prepare` runs its full check before its brief managed write so the lock cannot make its own Git snapshot dirty. Audit no longer refreshes report artifacts, root instruction-file drift is reported without overwriting user guidance, and adoption no longer probes an ambient `terrace` executable. A missing independent installation comparison is surfaced as unverified rather than a false aligned pass.

The canonical command catalog now drives CLI help, generated-agent metadata, the published contract projection, packed-consumer command-surface tests, and inbound dispatch. It models 106 command forms, including compatibility and internal forms, and makes `port gsd --compare`, `port gsd --verify-parity`, and `design-source diff` explicit instead of allowing them to drift. Its effect contract is conservative: rule/debt audits and policy evaluation are write-capable because they persist artifacts or recovery state, and `ship prepare --fast` is a reduced-check write rather than a read-only mode. A pure core parser resolves explicit literals, aliases, defaults, families, and `port gsd` precedence; phase, senior/UI, release/readiness, report, and legacy adapters consume canonical IDs while the top-level CLI retains global precedence, rendering, errors, and exit intent.

The README command index is now a checked projection of the catalog, and natural-language plans reference catalog command IDs plus safe argv arrays. The human-readable command field remains a compatibility display only; execution continues through direct domain handlers and the explicit state-bound apply token rather than a shell command string.

Catalog-owned source assets are now a separate, read-only parity surface: 252 generated Codex/Claude files must match their templates and be tracked when checked from a Git worktree. This protects a clean clone without invoking Terrace's consumer installer or repair command against Terrace itself. Root bootstrap guidance and the five bespoke governance skills remain outside that generated scope.

Project command discovery now owns package-script inspection, dead-code gate configuration, and agent-asset readiness warnings. `workflow.cjs` retains its exported compatibility function, while `adoption.cjs` imports the lower-level owner directly; a fresh-process test proves that adoption no longer initializes the workflow orchestrator.

Unresolved-debt policy now lives in one pure module. Lifecycle, report, and ship checks retain remediation guidance, while feature-scoped workbench status retains its lean blocker contract; direct tests cover resolved entries, feature filtering, finding order, and every public projection without invoking Terrace to repair Terrace.

Release-preflight policy now lives below the workflow orchestrator. It owns release-flow, tag, trusted-publishing, and stale-artifact checks; workflow supplies only dirty-tree and ship-check adapters, and fresh-process tests prove the new module does not initialize workflow orchestration.

Ship-readiness policy now lives below workflow. It owns fast/local/full readiness selection, project-script and dead-code gates, category timing/aggregation, and the `ship prepare` artifact; workflow injects senior-cycle and release-specific evidence, while shared ship modes live below both readiness and release-preflight domains. Fresh-process, injected-contract, workflow/CLI parity, and full clean-consumer CI verification passed.

Senior-cycle operations now live below workflow. The domain owns artifact generation, state recording, gate evaluation, and ship evidence while importing only lower-level services; workflow retains identity-compatible public exports and phase, quick-task, and autonomous orchestration. Direct large-tier, read-only ship-evidence, fresh-process, and full clean-consumer CI verification passed.

The phase CLI command family now lives behind a small compatibility router. It injects core operations, preserves canonical and GSD-compatible forms plus `phase set`, and returns results to the unchanged top-level renderer for JSON/human formatting and exit handling. Direct, child-process, and full clean-consumer CI verification passed.

Senior-cycle and UI CLI commands now live behind a separate compatibility router. It injects their lower-level operations, keeps answer/tier options lazy for `map-codebase` and UI routes, preserves the exact UI error contract, and returns data to the unchanged top-level renderer for human/JSON formatting and exit handling. Direct, production-lifecycle, child-process, and full clean-consumer CI verification passed.

Release-preflight aliases and ship commands now live behind a separate compatibility router. It injects existing policy handlers, preserves raw target/static/mode option handling (including an empty `--mode`), keeps failed readiness as normal output plus renderer-owned exit intent, and leaves exact errors and human/JSON rendering at the top level. Direct policy-boundary, targeted CLI, lifecycle interaction, and full clean-consumer CI verification passed.

Reporting now lives below lifecycle. The new owner calculates report cards, writes report-card/history artifacts through the managed boundary, analyzes ceremony artifacts, and builds a fresh report ship gate. Workflow, adoption, workbench, and ship readiness import it directly; lifecycle keeps identity-compatible exports for existing consumers. The exact report contract, fixed artifact set, read-only report reads, fresh ship checks, and symlink-safe write ordering are covered by fresh-process, focused behavior, and full clean-consumer CI verification.

Report CLI parsing now lives behind a small injected compatibility router. It preserves read/update/open/history forms, the explicit report-update command metadata, exact unknown-subcommand errors, and ceremony-only exit intent; the top-level CLI retains global option parsing plus human/JSON output and error rendering. Direct router, existing CLI behavior, and full clean-consumer CI verification passed.

The package `main` field now resolves to the same import-safe core facade as root `exports`; only `bin` executes the CLI. A fresh-process regression test proves a legacy package import does not initialize the CLI dispatcher.

Published packages now contain only 78 runtime files: core/templates, the CLI, the catalog parser and legacy adapter, required scripts, and concise root documentation. Historical corpus evidence and private repo configuration remain repository-only; installed corpus runs use synthetic defaults and persist in the caller's `.terrace/corpus/` directory, with explicit environment overrides and legacy-read compatibility.

## Recent Progress

- July 15: Committed `ac75f7f`; made the catalog own inbound CLI forms, aliases, defaults, families, and `port gsd` precedence; replaced top-level selection with ID-based adapters; full CI passed 442 tests / 1 existing skip, coverage, and 78-file package checks.
- July 15: Committed `0dfe3ed`; classified rule/debt audits and policy evaluation as write-capable, corrected `ship prepare --fast` guidance, synchronized generated assets, and passed 12 focused tests plus asset, type, lint, and package checks.
- July 15: Committed `b9de0b5`; removed repository docs/corpus evidence from the published tarball, moved corpus output to consumer-owned state, and proved a 76-file packed consumer with content/size regressions.
- July 15: Committed `c85f841`; aligned package `main` with the import-safe core facade while retaining the CLI only under `bin`, with fresh-process import regression coverage.
- July 15: Committed `93c2587`; isolated report command parsing with injected reporting operations while retaining the top-level renderer and ceremony-only exit intent. Full network-enabled CI passed: 428 tests / 1 existing skip, coverage, and fresh packed-consumer smoke.
- July 15: Committed `59ead7e`; isolated reporting calculation, persistence, ceremony, and ship-gate behavior below lifecycle while retaining identity-compatible exports and direct lower-level consumers. Full network-enabled CI passed: 428 tests / 1 existing skip, coverage, and fresh packed-consumer smoke.
- July 15: Committed `4151930`; isolated release-preflight and ship command routing with raw option compatibility and renderer-owned exit intent, then passed full network-enabled CI with coverage and fresh packed-consumer smoke.
- July 14: Committed `979ae32`; isolated senior-cycle/UI command routing with lazy option evaluation and unchanged JSON/error rendering, then passed full network-enabled CI with coverage and fresh packed-consumer smoke.
- July 14: Committed `c9dc05a`; isolated canonical and GSD-compatible phase CLI routing behind injected core operations while preserving renderer/exit behavior, then passed full network-enabled CI with coverage and fresh packed-consumer smoke.
- July 14: Committed `8cb6d37`; isolated senior-cycle artifacts, state, gates, and ship evidence behind an identity-compatible workflow facade, then passed full network-enabled CI with coverage and fresh packed-consumer smoke.
- July 14: Committed `daa2b4c`; isolated ship-readiness policy with injected senior-cycle and release evidence, removed the release/readiness dependency edge, and passed full network-enabled CI with coverage and fresh packed-consumer smoke.
- July 14: Committed `1c88e0e`; isolated release-preflight policy behind injected dirty-tree and ship-check adapters, preserved public CLI/API behavior, and passed full network-enabled CI with coverage and fresh packed-consumer smoke.
- July 14: Committed `8018e84`; centralized unresolved-debt assessment, preserved lifecycle remediation and workbench response shapes, and passed full network-enabled CI with coverage and fresh packed-consumer smoke.
- July 14: Committed `bfc19d4`; extracted project command discovery, removed the adoption/workflow dependency cycle, preserved strict package parsing and workflow export compatibility, and passed full network-enabled CI.
- July 14: Committed `92fcde1`; source-owned generated agent assets now have content and Git-tracking parity checks without self-invocation. Full network-enabled CI passed: 398 tests / 1 existing skip, coverage, and package dry run.

## Open Problems

- A real release must regenerate `terrace security check` evidence after source, lockfile, or relevant configuration changes; this is an intentional release blocker, not a false-green fallback.
- The root CommonJS facade still has a broad export-spread barrel with a silent `listCommandContracts` overwrite; add an explicit collision guard or curated export boundary.
- Runtime CommonJS is outside the current TypeScript gate; semantic coverage remains a later modernization concern.
- Managed files rely on cooperative locking and permission-controlled project directories; same-user hostile replacement races remain a documented residual risk.

## Quality Ladder Notes

| Check | Current evidence |
| --- | --- |
| Lint | `pnpm lint` PASS; broad text/syntax scan, not semantic linting. |
| Types | `pnpm typecheck` PASS, but excludes production CommonJS core. |
| Tests | Routing CI PASS: 442 tests / 1 existing skip, coverage gate, and fresh-consumer package check; post-CI catalog/parser/adapter suite PASS after `ac75f7f`. |
| Package | `pnpm package:dry-run` PASS with 78 runtime files; packed CLI remains runnable in a clean pnpm consumer. |
| Dependency audit | `pnpm dependency:security` PASS with no advisory at moderate or above. |
| Security evidence | Missing, legacy, incomplete, or source/config/lock-stale evidence blocks release readiness; `terrace security check` is the explicit writer. |
| Governance | `terrace spec validate --json` PASS; planning state is intentionally not release-ready. |

## Next Concrete Steps

1. Close the root core-facade collision guard without changing its public imports.
2. Run an adversarial modernization review of import direction, generated assets, package behavior, and public compatibility.
3. Generate fresh security evidence once a release candidate is frozen, then run the intended full release gates on its clean snapshot.
