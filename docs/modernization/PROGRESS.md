# Modernization Progress

## Current position

**Phase:** Milestone 3 domain-seam work: command discovery, debt assessment, release-preflight, ship-readiness, senior-cycle, reporting, phase-router, senior-cycle/UI-router, and release-readiness-router domains are extracted, and the adoption/workflow cycle is removed; remaining dispatcher and orchestration seams remain.

**Branch:** `codex/gpt56-modernization` (isolated from the original dirty checkout).

**Baseline:** `b80a8997`.

**Immediate implementation priority:** route the report command family through a tested lower-level adapter while preserving top-level rendering and exit behavior.

## Evidence recorded

- `pnpm run ci` passed after the corrected managed-artifact hardening: typecheck, lint, 373 tests passed with 1 existing skip, the coverage gate, and package dry run.
- The packed CLI now starts and runs a stateful command in a fresh pnpm consumer; package-manager dependency resolution replaces the incomplete manual bundle.
- Ordinary `terrace init` preserves established state, config, presets, rules, and event history byte-for-byte while repairing only missing artifacts.
- `terrace init --force --yes` requires paired confirmation, creates a recoverable backup, and reports overwritten paths; `terrace agents repair` is state-preserving.
- `pnpm secret:scan` and `pnpm dependency:security` passed, with the audit's scope/freshness caveats documented in `AUDIT.md`.
- `terrace doctor` and `terrace audit` passed while missing product-level release and integrity defects, confirming that governance health and product health must be separated.
- State schema `1.1` is validated at runtime through the packaged schema. Historical emitted `1.0` state is promoted in memory without read-side writes and persists only after a successful mutation.
- State writes now use a recovery-aware exclusive lock, raw-snapshot conflict detection, atomic temp-file replacement, parent-directory syncing where supported, and symlink rejection. A stale writer cannot silently overwrite a newer state snapshot, including during stale-lock recovery.
- Configuration, rules, policy, presets, events, manifests, sessions, security evidence, migration reports, and lifecycle JSON now share a symlink-safe managed-artifact boundary with atomic writes and recovery-aware serialization.
- Preset policy and registry updates now use a prepared transaction journal; the focused hardening suite passes 79 tests, alongside typecheck and lint.
- Adversarial review closed global-root ancestor symlink handling, failed-init lock scaffolding, state-only decision authorization, and decision-reference prefix matching.

## Terrace workflow state

- Feature alignment, design, test-plan, observability, validation, and cleanup artifacts were created under `docs/terrace/features/gpt56-modernization/` and `docs/testing/TEST-PLAN.md`.
- Terrace's planning gates are now satisfied; this records implementation readiness, not permission to skip the documented RED-gate tests or P0 containment work.
- The package-containment commit is complete and the safe-init vertical slice passed independent recovery review.
- During baseline inspection, `terrace ship check --fast` refreshed report-card/history artifacts despite documentation presenting ship checks as read-only. That P1 behavior is now removed: the default check is read-only, `ship check` project-script execution requires `--full`, and its report gate is computed in memory. The explicitly writing `ship prepare` command retains a full check by default.
- Natural-language write routes now preview a state-bound local apply capability, including explicit artifact scope and external execution effects. The CLI applies only the returned token; its public router no longer exposes a direct write bypass.
- State-mutating natural-language routes hold the existing managed-artifact lock from revision validation through execution. `ship prepare` is deliberately self-managed so its full clean-snapshot check does not see its own lock as an untracked change.
- `terrace audit` is read-only and preserves existing report-card artifacts. Agent drift, including root `AGENTS.md` and `CLAUDE.md`, is visible without overwriting user-owned guidance.
- Adoption status no longer invokes an ambient `terrace` executable. A separately supplied installed version is compared explicitly; otherwise the comparison is reported as unverified rather than passing tautologically.
- The command catalog now owns 106 command forms and drives CLI help, generated-agent metadata, published contracts, a generated README index, packed-consumer assertions, and natural-language plan argv arrays. `port gsd --compare`, `port gsd --verify-parity`, and `design-source diff` are now explicit catalog entries rather than drifted dispatch-only behavior.
- All 252 catalog-owned repository agent assets now pass a source-only content and Git-tracking parity check. The check preserves consumer bootstrap guidance and bespoke governance skills, and never invokes Terrace to modify Terrace.
- Full CI passed after reconciliation: typecheck, lint, source parity/tracking, 398 tests with 1 existing skip, coverage, and the network-enabled fresh packed-consumer/package dry run.
- Project command discovery and dead-code gate configuration now live in a lower-level module. `workflow.cjs` retains the compatibility export, while a fresh-process test proves `adoption.cjs` imports without initializing workflow orchestration; malformed package JSON remains intentionally strict. Focused checks and full network-enabled CI passed.
- Unresolved-debt policy now has one pure owner. Lifecycle, report, and ship checks retain remediation guidance, while feature-scoped workbench status preserves its lean blocker contract; direct tests cover ordering, resolved entries, feature scoping, and each projection.
- Release-preflight policy now lives below workflow with injected dirty-tree and ship-check boundaries. The public workflow/CLI API is unchanged; fresh-process and injected-contract tests prove the module does not initialize orchestration or execute static-invalid paths.
- Ship-readiness policy now lives below workflow with an injected senior-cycle check. Fast/local/full behavior, script and dead-code gates, timings, and `ship prepare` artifacts retain their existing workflow/CLI contracts; focused parity tests, typecheck, lint, and source-agent checks passed.
- Senior-cycle artifact generation, persisted feature evidence, gate evaluation, and ship evidence now live below workflow. The workflow facade remains identity-compatible; direct large-tier, read-only ship-check, and fresh-process import tests preserve the boundary.
- The phase CLI command family now routes through a lower-level adapter with injected core operations. Canonical forms, five GSD aliases, `execute-phase-complete`, and `phase set` retain the top-level CLI's output, JSON, and exit behavior; direct and child-process tests cover the compatibility surface.
- Senior-cycle and UI CLI commands now route through a lower-level adapter with injected handlers. Interrogation mode selection, answer-option evaluation, UI routing, and JSON error behavior retain the top-level renderer contract; direct and child-process tests cover the compatibility surface.
- Release-preflight aliases and ship commands now route through a lower-level adapter with injected policy handlers. Raw mode-option parsing, default ship behavior, exact command errors, and failed-readiness exit intent remain renderer-owned compatibility behavior; direct router and policy-boundary tests cover the seam.
- Reporting now lives below lifecycle: report-card calculation, persistence/history, ceremony analysis, and the fresh report ship gate have one owner. Workflow, adoption, workbench, and ship readiness import the lower-level owner directly while lifecycle retains identity-compatible public exports; focused behavior, symlink-safety, consumer, and fresh-process import tests passed.

## Next action

Route report commands through a narrow injected adapter, retain the existing human/JSON renderer and ceremony exit behavior, then review remaining dispatcher seams without widening into a rewrite.

## Known blockers

- A release now requires a newly generated security evidence artifact after source or lockfile changes; the current legacy artifact cannot be treated as passing evidence.
