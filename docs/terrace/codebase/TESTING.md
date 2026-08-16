# Codebase Testing

## Current Strategy

- Behavior and CLI contract tests live under `tests/`; the historical corpus is not a test-file inventory.
- Baseline suite result: 305 passed, 1 failed, 1 skipped. The failing packed-consumer smoke is release blocking.
- `pnpm typecheck` covers tests/configuration but not the production CommonJS core.
- `pnpm lint` is a syntax/format scan rather than semantic linting.

## Required Modernization Coverage

- Fresh packed consumer execution.
- State preservation, migration/recovery, and concurrent-write conflict.
- Read-only versus preview/apply command policy.
- Catalog parity across help, aliases, JSON, generated assets, docs, and remediation commands.
- Evidence freshness/claim scope and source-prioritized security scanning.
- Existing PRD, migration, phase, quick-task, report, handoff, and release journeys.
- docs/terrace/corpus/runs/2026-05-07T00-14-23-935Z/bbdse-signal-lab/migrated-gsd/test-plan.json
- docs/terrace/corpus/runs/2026-05-07T00-14-23-935Z/bbdse-signal-lab/scratch-real/test-plan.json
- docs/terrace/corpus/runs/2026-05-07T00-14-23-935Z/pre-cr-suite-lsp/migrated-gsd/test-plan.json
- docs/terrace/corpus/runs/2026-05-07T00-14-23-935Z/pre-cr-suite-lsp/scratch-real/test-plan.json
- docs/terrace/corpus/runs/2026-05-07T00-14-23-935Z/remodelvision/migrated-gsd/test-plan.json
- docs/terrace/corpus/runs/2026-05-07T00-14-23-935Z/remodelvision/scratch-real/test-plan.json
- docs/terrace/corpus/runs/2026-05-07T00-14-23-935Z/soundscape-app/migrated-gsd/test-plan.json
- docs/terrace/corpus/runs/2026-05-07T00-14-23-935Z/soundscape-app/scratch-real/test-plan.json
- docs/terrace/corpus/runs/2026-05-07T00-14-23-935Z/synthetic-docs/scratch-synthetic/test-plan.json
- docs/terrace/corpus/runs/2026-05-07T00-14-23-935Z/synthetic-empty/scratch-synthetic/test-plan.json
- docs/terrace/corpus/runs/2026-05-07T00-14-23-935Z/synthetic-node-app-no-scripts/scratch-synthetic/test-plan.json
- docs/terrace/corpus/runs/2026-05-07T00-14-23-935Z/synthetic-node-package/scratch-synthetic/test-plan.json
