# Structure

## Important Directories

- `src/` CLI entrypoint and command parsing
- `packages/terrace-core/src/` workflow, state, artifact, and command implementations
- `tests/` unit, fixture, and workflow parity coverage
- `docs/` product docs, design docs, release docs, and generated examples
- `.terrace/` repo-local Terrace state and generated metadata
- `.planning/` GSD-style planning artifacts for this repo
- `scripts/` local tooling helpers
- `fixtures/` consumer-project fixtures for tests

## File Ownership Pattern

- core behavior lives in `packages/terrace-core/src/`
- CLI user surface lives in `src/terrace-tools.cjs`
- workflow acceptance is mostly proven in `tests/`
- product strategy is spread across `README.md`, docs, and internal design specs

## Structural Concern

The repo has strong implementation and design material, but the self-hosted planning layer is thin. Product intent is discoverable only after reading several docs instead of one coherent `.planning` package.
