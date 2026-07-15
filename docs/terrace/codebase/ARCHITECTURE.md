# Codebase Architecture

## Current Architecture

- Terrace is one root npm package exposing a CLI and reusable core.
- `main` and root `exports` both resolve to the import-safe core facade; `bin` is the only executable CLI entrypoint.
- The CLI entrypoint owns global option precedence plus human/JSON rendering and exit intent. A pure catalog parser resolves explicit inbound forms to canonical command IDs or known-family fallbacks, then delegates to command-family adapters; `workflow.cjs` and remaining lifecycle orchestration are the main hotspots.
- State and evidence live in `.terrace/` and `docs/`; the product has no remote-service boundary.
- Corpus evaluation ships with synthetic configuration, writes results to the target project's `.terrace/corpus/`, and keeps repository-only historical evidence out of published packages.
- The command catalog owns help, agent generators, tests, README content, command contracts, and explicit inbound dispatch metadata; display grammar is not used as parser grammar.
- Project command discovery now lives below orchestration in `project-command-discovery.cjs`; `adoption.cjs` no longer imports `workflow.cjs`. The larger dispatcher and orchestration hotspots remain.
- `debt-assessment.cjs` owns unresolved-debt policy; lifecycle and workbench adapters preserve their distinct public result shapes.
- `release-preflight.cjs` owns release, tag, trusted-publishing, and artifact policy. Workflow supplies only dirty-tree and ship-check adapters, preserving the public CLI/API boundary without a reverse import.
- `ship-readiness.cjs` owns fast/local/full readiness policy, project-script gates, category aggregation, and ship-summary artifacts. It receives senior-cycle and release-specific evidence through injected callbacks while workflow preserves the existing public API and composes release preflight; their shared modes live below both modules.
- `senior-cycle.cjs` owns senior artifact generation, state recording, gate evaluation, and ship evidence. It imports only lower-level services; workflow preserves the existing public facade and keeps phase, quick-task, and autonomous orchestration separate.
- `reporting.cjs` owns report-card calculation, report persistence/history, ceremony analysis, and the fresh report ship gate. It imports only state, audit, debt, guidance, and managed-artifact services; lifecycle keeps an identity-compatible export facade while workflow, adoption, workbench, and ship readiness consume reporting directly.
- `phase-cli-router.cjs` owns canonical and GSD-compatible phase command routing through injected core operations and canonical command IDs.
- `senior-cycle-cli-router.cjs` owns senior-cycle and UI command routing through injected handlers and canonical command IDs. It preserves lazy option evaluation and returns data/errors to the same top-level CLI renderer.
- `release-readiness-cli-router.cjs` owns release-preflight aliases and ship command routing through injected policy handlers and canonical command IDs. It preserves raw mode-option parsing and returns failures as renderer-owned results with exit intent.
- `report-cli-router.cjs` owns report command routing through injected reporting operations and canonical command IDs. It preserves report-update metadata and returns ceremony-only exit intent.
- `legacy-cli-router.cjs` owns the remaining command-family adapter while `command-parser.cjs` remains a pure core resolver. It keeps known-family errors in their existing owners rather than pretending malformed input is a concrete command.

## Target Architecture

```text
CLI globals/renderer -> catalog parser -> command-family adapters -> domain services
                                                               -> state store / artifact writer / project analysis / process runner
```

- The catalog is the metadata and inbound-dispatch source; the entrypoint handles global precedence and preview/apply policy, while adapters validate command-specific arguments.
- State access moves behind validation, migration, atomic persistence, and concurrency protection.
- Domains separate roadmap/quick work, senior cycle, readiness/reporting, GSD migration, and agent assets.
- The root library surface becomes curated and import-safe; `bin` remains the CLI entrypoint.

## Maintainability Constraints

- Preserve public CLI/JSON/artifact contracts through tested adapters while domains are extracted.
- Do not introduce a workspace or framework solely to reshape folders.
- Every temporary compatibility path needs an owner and removal criterion.
