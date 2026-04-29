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
- `terrace history` summarizes migrated phases, sessions, decisions, and quick tasks.
- `terrace do <plain text>` routes natural-language agent instructions to stable Terrace commands.
- `terrace autonomous` plans the next phase, prepares execution readiness, and stops at blockers or agent handoff.
- `terrace commands discover` detects package manager, project scripts, and quality-gate command mapping.
- `terrace align <feature>` writes `docs/terrace/features/<feature>/ALIGNMENT.md` with customer, problem, success metrics, risks, rollout, observability, validation, and cleanup intent.
- `terrace interrogate <feature>` writes edge-case, assumption-challenge, and failure-mode interrogation.
- `terrace map-codebase` writes codebase map, architecture, risks, testing, and observability context under `docs/terrace/codebase/`.
- `terrace design <feature>` records architecture decisions, tradeoffs, maintainability, and the no band-aid rule.
- `terrace test-plan <feature>` writes the behavior-first `docs/testing/TEST-PLAN.md` required before implementation.
- `terrace observe <feature>` writes feature observability and post-launch debugging intent.
- `terrace validate-prod <feature>` writes production success signals, monitoring, and rollback conditions.
- `terrace cleanup <feature>` writes the cleanup contract for flags, temporary code, and docs.
- `terrace ui import-stitch <feature>`, `terrace ui plan-refresh <feature>`, and `terrace ui diff <feature>` support design-driven greenfield and brownfield UI workflows.
- `terrace phase list` lists canonical roadmap phases.
- `terrace phase show <id>` shows one roadmap phase and its migrated plans.
- `terrace phase plan <id>` writes `docs/terrace/phases/<id>/PLAN.md`, pulling migrated source plans, likely files, related quick tasks, blockers, and discovered project commands into the phase plan.
- `terrace phase execute <id>` writes `docs/terrace/phases/<id>/EXECUTION.md`, enters RED-gate readiness after blockers are clear, and reports an execution queue.
- `terrace phase validate <id>` writes `docs/terrace/phases/<id>/VALIDATION.md`.
- `terrace phase review <id>` writes `docs/terrace/phases/<id>/REVIEW.md`.
- `terrace phase complete <id>` writes `docs/terrace/phases/<id>/SUMMARY.md` and marks the phase complete.
- `terrace quick list` lists migrated GSD quick-task history.
- `terrace quick show <id>` shows one migrated quick task.
- `terrace quick plan <title>` creates a stateful quick-task plan under `docs/terrace/quick/<id>/`.
- `terrace quick execute <id>` enters RED-gate execution for a quick task.
- `terrace quick complete <id>` writes a quick-task summary and marks it complete.
- `terrace backlog list` lists backlog items.
- `terrace backlog add <title>` appends a backlog item.
- `terrace ship check` runs release-readiness checks, discovers available project scripts, treats missing optional scripts as warnings, and exits nonzero when an available quality gate fails.
- `terrace ship prepare` writes `docs/terrace/ship/SHIP.md` from release-readiness results.
- `terrace plan-phase <id>`, `terrace execute-phase <id>`, `terrace validate-phase <id>`, `terrace review-phase <id>`, and `terrace complete-phase <id>` are GSD-compatible aliases.
- `terrace rule list` and `terrace rule explain <id>` inspect rule packs.
- `terrace preset list` and `terrace preset install <id>` manage presets.

## GSD Migration

`terrace port gsd` preserves the source `.planning/` tree and writes converted Terrace artifacts under `.terrace/`, `docs/prd/`, `docs/spec/`, `docs/terrace-migration/`, and `docs/testing/gsd/`. The migration report is written to `.terrace/migration/gsd-port-report.json` and includes `converted`, `skipped`, `writes`, `blockers`, `warnings`, `readiness`, `next_command`, `review_checklist`, and `validation_commands`.

Migrated state includes roadmap phases and plans, decisions, sessions, handoff context, backlog items, blocked human actions, and quick-task history. Quick-task PLAN/SUMMARY files are archived under `docs/terrace-migration/quick/` and exposed through `terrace quick list` / `terrace quick show <id>`. Handoff remaining tasks and blocking human actions become backlog items so post-migration work is visible. Unsupported files are not deleted; each skipped artifact includes a reason and manual review action.

## Workflow Example

1. Capture intent in `docs/prd/PRD.md`.
2. Compile spec details in `docs/spec/COMPILED-SPEC.md`.
3. Design test trust in `docs/testing/TEST-ARCH.md`.
4. Use Terrace gates to require RED evidence before implementation and GREEN evidence before protection.
5. Run `terrace phase plan <id>`, `terrace phase execute <id>`, `terrace phase validate <id>`, `terrace phase review <id>`, and `terrace phase complete <id>` to preserve execution history.
6. Run `terrace audit`, `terrace ci check`, and `terrace ship prepare` before committing protected changes.

Agents can use `terrace do "plan phase 11"`, `terrace do "/gsd:plan-phase 11"`, `terrace do "run the next phase"`, `terrace do "create quick task fix login redirect"`, or `terrace do "ship prepare"` when they have plain text instead of a structured command.

## Senior Cycle

Terrace now has a senior-cycle artifact layer for adaptive rigor:

- Small changes: alignment-lite, test-first, execute, verify.
- Medium features: alignment, edge cases, test strategy, execute, ship check.
- Large/risky features: full alignment, interrogation, codebase mapping, design, TDD, observability, rollout, production validation, and cleanup.

See `docs/terrace/SENIOR-CYCLE.md` for the audit report, target workflow, artifact structure, enforcement rules, and implementation milestones. The no band-aid rule is the default: even `terrace quick` should choose maintainable architecture unless a short-term choice explicitly preserves future development and has a cleanup contract.

## Troubleshooting

- `Missing .terrace/state.json`: run `terrace init` from the repo root.
- `Protected file changed without DECISION-LOG.md`: add a spec-linked decision before committing.
- `terrace port gsd` refuses to overwrite state: re-run with `--force` only after preserving existing `.terrace/state.json`.
- `terrace next` reports a blocked action after migration: complete or clear the migrated human action before treating the project as ready.
- `terrace ship check` exits nonzero: inspect the failed category and run the listed command directly for detailed output.
- `terrace ship check` reports `QUALITY_SCRIPT_MISSING`: add the suggested package script if that gate should be enforced for this project.
- `terrace do <plain text>` cannot route an instruction: use an explicit command from `terrace --help` or include a clear phase number, quick-task request, resume/next/history request, or ship request.
- Typecheck errors from package dependencies usually mean the repo is not using the supported `Bundler` module resolution settings in `tsconfig.json`.

## Development

Canonical local verification is:

```sh
npm run ci
```

The publish allowlist is controlled by `package.json#files`; local planning, tests, and agent settings are not shipped.
