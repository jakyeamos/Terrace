# Conventions

## Code Conventions

- CommonJS modules in runtime code
- deterministic JSON-oriented command outputs
- repo-local state and generated artifacts over remote persistence
- explicit command names rather than hidden implicit flows

## Workflow Conventions

- strict-core is the source of truth
- generated docs should be deterministic and auditable
- release readiness is enforced through explicit commands and artifact gates
- GSD migration should preserve source artifacts rather than mutate them in place

## Testing Conventions

- behavior is covered through focused unit and workflow tests
- fixture tests simulate migrated `.planning/` projects
- command surfaces should support `--json`

## Product Convention Tension

Terrace values simplicity and determinism. GSD values broader operational capability. Any parity work has to respect Terrace’s conventions or the product loses its reason to exist.
