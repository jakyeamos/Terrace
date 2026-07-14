# Codebase Risks

## P0

- The packed CLI fails in a fresh consumer because bundled dependencies omit `fast-glob` transitive dependencies.
- `terrace init` overwrites established state/configuration/rules without a safe reset boundary.
- Whole-file state writes are neither atomic nor concurrency-safe.

## P1

- Security/readiness checks can be false green because selection and evidence freshness are incomplete.
- `ship check` can write evidence and execute target-repository scripts despite its read-only documentation.
- Help, routing, agent assets, and remediation commands can drift; one emitted remediation command has no handler.
- The CLI/core entrypoint split is import-unsafe and orchestration contains a dependency cycle.

## Protected Behavior

- `.terrace/state.json`, schemas, PRD intake, GSD migration, agent asset installation, CLI JSON/exit codes, package installation, and release workflows require characterization before change.
