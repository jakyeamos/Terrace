# Observability: gpt56-modernization

## Evidence model

- Each generated readiness/security/report artifact records schema version, command version, claim scope, timestamps, source inputs, and freshness/invalidity rules.
- Every write logs a correlation ID, previous/new state revision, command plan, apply outcome, backup path when created, and recovery guidance on failure.
- Running target-repository scripts is an explicit event: requested command, working directory, timeout, exit code, and whether execution was opt-in.

## Product signals

- Fresh-consumer install/run success rate across supported package-manager layouts.
- State migration, backup, recovery, and conflict outcomes.
- Command catalog parity: help/assets/docs/remediation references generated versus executable.
- Evidence freshness failures and attempted use of stale report/security data.
- Package file count and unpacked size against the release budget.

## Debugging path

1. Start with `terrace status --json` to identify current state revision, evidence freshness, and the exact planned mutation.
2. Inspect the corresponding structured event and backup/recovery location.
3. For package failures, reproduce in a clean packed-consumer fixture rather than the development tree.
4. For target project checks, inspect the explicitly captured command result; do not infer success from a cached readiness card.

## Boundaries

- Terrace is a local CLI/library, not a server: do not introduce fake request tracing or user analytics.
- File paths, environment values, and target-repository output must be redacted/minimized in persisted evidence.
