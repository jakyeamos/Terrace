# Terrace

Terrace is a strict-core workflow CLI for spec-driven, test-governed AI-assisted development. It keeps implementation work tied to a recoverable repo state, explicit spec intent, protected tests, and deterministic quality gates.

## Install

Terrace requires Node.js 22 or newer.

```sh
npm install --save-dev terrace
```

Run it with `npx terrace` or through the installed `terrace` binary.

## Quickstart

```sh
npx terrace init
npx terrace doctor
npx terrace spec validate
npx terrace audit
```

`terrace init` creates `.terrace/state.json`, `.terrace/config.json`, default rule packs, a preset registry, and governance document directories under `docs/`.

## Command Reference

- `terrace --help` shows the top-level command list.
- `terrace --version` prints the package version.
- `terrace init` initializes Terrace state.
- `terrace doctor` checks installation health.
- `terrace spec validate` validates governance artifacts.
- `terrace spec hash --file <path>` computes a stable spec hash.
- `terrace audit` checks artifacts and protected baselines.
- `terrace ci check [files...]` runs audit and protected-change enforcement.
- `terrace port gsd --dry-run` inventories legacy GSD artifacts.
- `terrace port gsd` migrates supported legacy GSD artifacts into Terrace state.
- `terrace next` reports the next workflow action from state, handoff data, and blockers.
- `terrace resume` reconstructs paused workflow context from sessions and migrated handoff data.
- `terrace phase list` lists canonical roadmap phases.
- `terrace phase show <id>` shows one roadmap phase and its migrated plans.
- `terrace backlog list` lists backlog items.
- `terrace backlog add <title>` appends a backlog item.
- `terrace ship check` runs release-readiness checks and exits nonzero when a quality gate fails.
- `terrace rule list` and `terrace rule explain <id>` inspect rule packs.
- `terrace preset list` and `terrace preset install <id>` manage presets.

## GSD Migration

`terrace port gsd` preserves the source `.planning/` tree and writes converted Terrace artifacts under `.terrace/`, `docs/prd/`, `docs/spec/`, `docs/terrace-migration/`, and `docs/testing/gsd/`. The migration report is written to `.terrace/migration/gsd-port-report.json` and includes `converted`, `skipped`, `writes`, `blockers`, `warnings`, `readiness`, `next_command`, `review_checklist`, and `validation_commands`.

Migrated state includes roadmap phases and plans, decisions, sessions, handoff context, backlog items, blocked human actions, and quick-task history. Unsupported files are not deleted; each skipped artifact includes a reason and manual review action.

## Workflow Example

1. Capture intent in `docs/prd/PRD.md`.
2. Compile spec details in `docs/spec/COMPILED-SPEC.md`.
3. Design test trust in `docs/testing/TEST-ARCH.md`.
4. Use Terrace gates to require RED evidence before implementation and GREEN evidence before protection.
5. Run `terrace audit` and `terrace ci check` before committing protected changes.

## Troubleshooting

- `Missing .terrace/state.json`: run `terrace init` from the repo root.
- `Protected file changed without DECISION-LOG.md`: add a spec-linked decision before committing.
- `terrace port gsd` refuses to overwrite state: re-run with `--force` only after preserving existing `.terrace/state.json`.
- `terrace next` reports a blocked action after migration: complete or clear the migrated human action before treating the project as ready.
- `terrace ship check` exits nonzero: inspect the failed category and run the listed command directly for detailed output.
- Typecheck errors from package dependencies usually mean the repo is not using the supported `Bundler` module resolution settings in `tsconfig.json`.

## Development

Canonical local verification is:

```sh
npm run ci
```

The publish allowlist is controlled by `package.json#files`; local planning, tests, and agent settings are not shipped.
