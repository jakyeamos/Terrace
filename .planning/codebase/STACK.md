# Stack

## Runtime

- Node.js CLI package targeting Node `>=22`
- CommonJS entrypoints
- published package name: `@jakyeamos33/terrace`

## Implementation Languages

- JavaScript for runtime and CLI implementation
- TypeScript for tests and typechecking

## Primary Dependencies

- `fast-glob`
- `ignore`
- `yaml`

## Tooling

- `vitest` for tests and coverage
- `typescript` for static checking
- custom lint and packaging scripts under `scripts/`

## Build and Release Shape

- package is published as a CLI plus reusable strict-core export
- package allowlist is controlled from `package.json#files`
- docs are shipped with the package

## Key Observation

Terrace is intentionally small at the runtime layer. The product gap versus GSD is not missing framework complexity; it is missing higher-level workflow and operator capabilities built on top of this small core.
