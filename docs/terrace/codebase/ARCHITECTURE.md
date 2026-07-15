# Codebase Architecture

## Current Architecture

- Terrace is one root npm package exposing a CLI and reusable core.
- `main` and root `exports` both resolve to the import-safe core facade; `bin` is the only executable CLI entrypoint.
- The CLI is a large switch router; `workflow.cjs` and the remaining lifecycle orchestration are the main hotspots.
- State and evidence live in `.terrace/` and `docs/`; the product has no remote-service boundary.
- Command metadata is duplicated across help, agent generators, tests, README content, and command contracts.
- Project command discovery now lives below orchestration in `project-command-discovery.cjs`; `adoption.cjs` no longer imports `workflow.cjs`. The larger dispatcher and orchestration hotspots remain.
- `debt-assessment.cjs` owns unresolved-debt policy; lifecycle and workbench adapters preserve their distinct public result shapes.
- `release-preflight.cjs` owns release, tag, trusted-publishing, and artifact policy. Workflow supplies only dirty-tree and ship-check adapters, preserving the public CLI/API boundary without a reverse import.
- `ship-readiness.cjs` owns fast/local/full readiness policy, project-script gates, category aggregation, and ship-summary artifacts. It receives senior-cycle and release-specific evidence through injected callbacks while workflow preserves the existing public API and composes release preflight; their shared modes live below both modules.
- `senior-cycle.cjs` owns senior artifact generation, state recording, gate evaluation, and ship evidence. It imports only lower-level services; workflow preserves the existing public facade and keeps phase, quick-task, and autonomous orchestration separate.
- `reporting.cjs` owns report-card calculation, report persistence/history, ceremony analysis, and the fresh report ship gate. It imports only state, audit, debt, guidance, and managed-artifact services; lifecycle keeps an identity-compatible export facade while workflow, adoption, workbench, and ship readiness consume reporting directly.
- `phase-cli-router.cjs` owns canonical and GSD-compatible phase command parsing through injected core operations. The top-level CLI retains global-option parsing, human/JSON rendering, and exit behavior.
- `senior-cycle-cli-router.cjs` owns senior-cycle and UI command parsing through injected handlers. It preserves lazy option evaluation and returns data/errors to the same top-level CLI renderer.
- `release-readiness-cli-router.cjs` owns release-preflight aliases and ship command parsing through injected policy handlers. It preserves raw mode-option parsing, returns failures as renderer-owned results with exit intent, and leaves JSON/human output at the top level.
- `report-cli-router.cjs` owns report subcommand parsing through injected reporting operations. It preserves report-update command metadata and returns ceremony-only exit intent to the top-level renderer.

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
