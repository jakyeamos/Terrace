# Codebase Risks

## P1

- Release readiness correctly fails without current, schema-versioned security evidence. A release candidate still needs a fresh `terrace security check` after relevant source, configuration, or lockfile changes.
- `ship check --full` intentionally executes target-repository scripts. It requires explicit authority and a clean snapshot, but those scripts can still have their own side effects.

## P2

- Runtime CommonJS remains outside the TypeScript gate; current typecheck success does not establish static coverage for the production core.
- Managed artifacts rely on cooperative locking and permission-controlled project directories. A same-user hostile process can still race a final filesystem pathname replacement.

## P3

- The root core facade still merges module exports through a broad spread barrel. It currently has a silent compatibility overwrite for `listCommandContracts`; a curated facade or collision guard remains future cleanup.

## Protected Behavior

- `.terrace/state.json`, schemas, PRD intake, GSD migration, agent asset installation, CLI JSON/exit codes, package installation, corpus-output paths, and release workflows require characterization before change.
