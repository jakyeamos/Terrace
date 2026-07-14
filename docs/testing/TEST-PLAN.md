# Test Plan: GPT-5.6 Modernization

## Feature

- `gpt56-modernization`

## Behavior contracts to characterize first

| Contract | Examples | Test layer |
| --- | --- | --- |
| Fresh installation | Packed pnpm/npm-compatible consumer can run help, status, and a safe initialization path. | Temp consumer end-to-end test |
| State preservation | Re-running init preserves existing state/config/rules; force reset creates a recoverable backup. | State-store + CLI integration |
| State recovery | Invalid/stale/migrated state is rejected or upgraded deterministically; interrupted/concurrent writes preserve a valid revision. | State-store unit/integration |
| Read/write policy | Read-only commands never mutate; mutation commands preview first and require apply. | CLI integration + filesystem assertion |
| Evidence truthfulness | Missing/stale/malformed report or security evidence cannot produce a green release/adoption claim. | Domain integration |
| Command compatibility | Help, aliases, JSON output, exit codes, generated agent assets, README references, and remediation commands remain aligned. | Catalog/unit + CLI contract suite |
| Core workflow | PRD intake, migration, phase/quick workflows, handoff, and release preparation keep their documented artifact paths and behavior. | Existing behavior-first end-to-end tests |

## Failure scenarios

- Incomplete bundled dependency graph in a fresh consumer.
- Existing `.terrace` state, unknown fields, schema version changes, malformed JSON, or a process interrupted during write.
- Two agents attempt conflicting state updates.
- A caller passes `--json`, pipes input, or uses an existing legacy/GSD alias.
- A natural-language request maps to a mutation, an unsupported intent, or a remediation command with no handler.
- Security scanning is dominated by generated corpus files or evidence is missing/stale.
- A target-repository script is requested, fails, times out, or would mutate the target.

## RED-gate rule

Before changing a milestone's implementation, add a failing test that proves the specific P0/P1 defect or compatibility behavior. Do not replace the existing broad suite with low-value snapshot tests; use fixtures that exercise actual CLI/process/state boundaries.

## Completion rule

Each milestone in `docs/modernization/EXEC_PLAN.md` closes only when its behavior-specific tests and the relevant baseline checks pass. Full verification runs before the next milestone begins.
