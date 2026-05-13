# Testing

## Current Testing Shape

- substantial `vitest` coverage across CLI, strict-core, migration, workflow helpers, and parity behavior
- fixture tests for migrated GSD artifacts and packed CLI scenarios
- tests validate generated artifact paths and workflow JSON outputs

## Covered Areas

- state initialization and transitions
- roadmap execution helpers
- GSD migration parity and smoke cases
- workflow commands such as phase, quick, ship, report, and review flows

## Likely Gaps

- broader end-to-end parity coverage for native roadmap authoring
- deeper tests for codebase-map refresh behavior
- tests for workstream operational usefulness, not just artifact existence
- stronger recovery and stale-artifact validation coverage
- operator surface acceptance tests once a compact console exists

## Key Observation

The repo already knows how to test workflow contracts. The missing capability is product scope, not an inability to validate new commands.
