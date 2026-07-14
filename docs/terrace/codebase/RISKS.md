# Codebase Risks

## P0

- The packed CLI fails in a fresh consumer because bundled dependencies omit `fast-glob` transitive dependencies.
- `terrace init` overwrites established state/configuration/rules without a safe reset boundary.
- Whole-file state writes are neither atomic nor concurrency-safe.

## P1

- Security evidence now fails closed when it is missing, legacy, stale, scope-incomplete, or lacks a completed dependency audit. A release still needs a freshly recorded check after source or lockfile changes.
- Plain `ship check` is read-only; `ship check --full` intentionally executes target-repository scripts and should be used only with that explicit authority.
- Help, routing, agent assets, and remediation commands can drift; one emitted remediation command has no handler.
- The CLI/core entrypoint split is import-unsafe and orchestration contains a dependency cycle.

## Protected Behavior

- `.terrace/state.json`, schemas, PRD intake, GSD migration, agent asset installation, CLI JSON/exit codes, package installation, and release workflows require characterization before change.
