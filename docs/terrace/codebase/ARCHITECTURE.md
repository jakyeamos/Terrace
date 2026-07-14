# Codebase Architecture

## Current Architecture

- Terrace is one root npm package exposing a CLI and reusable core.
- The CLI is a large switch router; `workflow.cjs` and `lifecycle.cjs` are the main orchestration hotspots.
- State and evidence live in `.terrace/` and `docs/`; the product has no remote-service boundary.
- Command metadata is duplicated across help, agent generators, tests, README content, and command contracts.
- Project command discovery now lives below orchestration in `project-command-discovery.cjs`; `adoption.cjs` no longer imports `workflow.cjs`. The larger dispatcher and orchestration hotspots remain.
- `debt-assessment.cjs` owns unresolved-debt policy; lifecycle and workbench adapters preserve their distinct public result shapes.
- `release-preflight.cjs` owns release, tag, trusted-publishing, and artifact policy. Workflow supplies only dirty-tree and ship-check adapters, preserving the public CLI/API boundary without a reverse import.

## Target Architecture

```text
CLI renderer -> dispatcher -> command catalog -> domain services
                                           -> state store / artifact writer / project analysis / process runner
```

- The catalog is the command metadata source; the dispatcher handles aliases and preview/apply policy.
- State access moves behind validation, migration, atomic persistence, and concurrency protection.
- Domains separate roadmap/quick work, senior cycle, readiness/reporting, GSD migration, and agent assets.
- The root library surface becomes curated and import-safe; `bin` remains the CLI entrypoint.

## Maintainability Constraints

- Preserve public CLI/JSON/artifact contracts through tested adapters while domains are extracted.
- Do not introduce a workspace or framework solely to reshape folders.
- Every temporary compatibility path needs an owner and removal criterion.
