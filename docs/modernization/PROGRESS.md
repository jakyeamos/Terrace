# Modernization Progress

## Current position

**Phase:** Milestone 1 managed-artifact hardening, adversarial review, and full verification are complete.

**Branch:** `codex/gpt56-modernization` (isolated from the original dirty checkout).

**Baseline:** `b80a8997`.

**Immediate implementation priority:** address the remaining Milestone 1 release-integrity risks outside the managed-artifact boundary.

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

## Next action

Verify the fresh-evidence and read-only ship-check contract, then advance the next Milestone 1 release-integrity slice.

## Known blockers

- A release now requires a newly generated security evidence artifact after source or lockfile changes; the current legacy artifact cannot be treated as passing evidence.
