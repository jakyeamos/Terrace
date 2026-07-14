# Modernization Progress

## Current position

**Phase:** Milestone 1 in progress; package containment, safe initialization/reset, and the versioned state-store slice are complete.

**Branch:** `codex/gpt56-modernization` (isolated from the original dirty checkout).

**Baseline:** `b80a8997`.

**Immediate implementation priority:** extend the same managed-path safety to configuration, rules, events, and reset backup/restore before broad refactors or CLI redesign.

## Evidence recorded

- `pnpm run ci` passed: typecheck, lint, 329 tests / 1 skipped, the coverage gate, and package dry run.
- The packed CLI now starts and runs a stateful command in a fresh pnpm consumer; package-manager dependency resolution replaces the incomplete manual bundle.
- Ordinary `terrace init` preserves established state, config, presets, rules, and event history byte-for-byte while repairing only missing artifacts.
- `terrace init --force --yes` requires paired confirmation, creates a recoverable backup, and reports overwritten paths; `terrace agents repair` is state-preserving.
- `pnpm secret:scan` and `pnpm dependency:security` passed, with the audit's scope/freshness caveats documented in `AUDIT.md`.
- `terrace doctor` and `terrace audit` passed while missing product-level release and integrity defects, confirming that governance health and product health must be separated.
- State schema `1.1` is validated at runtime through the packaged schema. Historical emitted `1.0` state is promoted in memory without read-side writes and persists only after a successful mutation.
- State writes now use a recovery-aware exclusive lock, raw-snapshot conflict detection, atomic temp-file replacement, parent-directory syncing where supported, and symlink rejection. A stale writer cannot silently overwrite a newer state snapshot, including during stale-lock recovery.

## Terrace workflow state

- Feature alignment, design, test-plan, observability, validation, and cleanup artifacts were created under `docs/terrace/features/gpt56-modernization/` and `docs/testing/TEST-PLAN.md`.
- Terrace's planning gates are now satisfied; this records implementation readiness, not permission to skip the documented RED-gate tests or P0 containment work.
- The package-containment commit is complete and the safe-init vertical slice passed independent recovery review.
- During baseline inspection, `terrace ship check --fast` refreshed report-card/history artifacts despite documentation presenting ship checks as read-only. That behavior is a recorded P1 defect, not accepted audit-side mutability.

## Next action

Continue Milestone 1 from `EXEC_PLAN.md`: route configuration, rules, events, presets, and reset backup/restore through the same safe managed-file boundary.

## Known blockers

- Config, rule, event, preset, and reset backup/restore paths still need shared path-safety checks before the complete managed mutation surface can be considered release-ready.
- Stale security/readiness evidence and ship-check side effects remain open Milestone 1 risks.
