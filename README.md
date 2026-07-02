# Terrace

Terrace is a strict-core workflow CLI for spec-driven, test-governed AI-assisted development. It keeps implementation work tied to a recoverable repo state, explicit spec intent, protected tests, and deterministic quality gates.

## Install

Terrace requires Node.js 22 or newer.

```sh
pnpm add -D @jakyeamos33/terrace
```

Run it with `pnpm exec terrace` after installation or with `pnpm dlx @jakyeamos33/terrace` for one-off use.
If you want `terrace` available globally, install it globally:

```sh
pnpm add --global @jakyeamos33/terrace
```

To make Terrace slash commands and skills available in Codex and Claude Code across local repos, install the global agent assets:

```sh
terrace agents install-global
```

## Quickstart

Run Terrace from the root of an existing repository:

```sh
pnpm exec terrace init
pnpm exec terrace doctor
pnpm exec terrace audit
pnpm exec terrace report
pnpm exec terrace ship check --json
```

`terrace doctor` confirms the local installation is usable. `terrace audit` checks Terrace-owned governance state. `terrace report` prints the current Tier One readiness card without writing files. `terrace ship check --json` runs release-readiness checks and exits nonzero when a blocking gate fails.

## What Terrace Creates

`terrace init` writes only repo-local governance state and docs scaffolding:

- `.terrace/state.json`
- `.terrace/config.json`
- `.terrace/presets/registry.json`
- `.terrace/rules/*.json`
- `.terrace/events.jsonl`
- `.terrace/agents/manifest.json`
- `AGENTS.md` when absent
- `CLAUDE.md` when absent
- `.agents/skills/terrace-*/SKILL.md` when absent
- `.claude/skills/terrace-*/SKILL.md` when absent
- `.claude/commands/terrace-*.md` when absent
- `docs/prd/`
- `docs/spec/`
- `docs/testing/`

Report artifacts are explicit: `terrace report` is read-only, while `terrace report update` writes `.terrace/report-card.json`, `docs/terrace/REPORT-CARD.md`, and report history.

## Agent Integration

`terrace init` makes a repository ready for Codex and Claude Code by default. It writes repo-local agent guidance only when the target file is missing, and preserves existing user or team guidance.

- Codex reads `AGENTS.md` and gets repo skills under `.agents/skills/` for the README command-reference surface, including `/terrace-next`, `/terrace-align`, `/terrace-phase-plan`, `/terrace-quick-plan`, and `/terrace-ship-check`.
- Claude Code reads `CLAUDE.md` and gets project skills plus project commands under `.claude/skills/` and `.claude/commands/` for the same command-reference surface.
- `.terrace/agents/manifest.json` records which assets were written, skipped, or unchanged during the latest init run.

If `AGENTS.md`, `CLAUDE.md`, or a matching Codex skill, Claude skill, or Claude command already exists, Terrace does not overwrite it. Merge the generated guidance manually if your project already has custom agent instructions.

For global local discovery, `terrace agents install-global` writes Codex skills under `~/.agents/skills/`, Claude Code skills under `~/.claude/skills/`, Claude Code slash commands under `~/.claude/commands/`, and manifests under each tool directory when absent. It preserves existing global skills and commands and reports them as skipped. The `/terrace` entry routes natural-language intent through `terrace do "$ARGUMENTS"` and falls back to `terrace next` when no arguments are provided.

## PRD Intake

Start a new project from a PRD file:

```sh
terrace new-project hoopscout --prd docs/input/HOOPSCOUT-PRD.md
```

Start a new project from pasted PRD content:

```sh
terrace new-project hoopscout --paste-prd <<'PRD'
# Hoopscout PRD

- Coaches need a faster way to evaluate prospects.
PRD
```

Import a later feature PRD:

```sh
terrace prd import saved-search --file docs/input/SAVED-SEARCH-PRD.md
```

## Release Readiness

Use these checks before publishing protected work:

```sh
pnpm run ci
pnpm audit --audit-level moderate
pnpm package
pnpm run release:dry-run
pnpm exec terrace ship check --json
```

`terrace ship check` is read-only. Use `terrace ship prepare` when you want Terrace to write a release-readiness summary under `docs/terrace/ship/`.

## Command Reference

- `terrace --help` shows the top-level command list.
- `terrace --version` prints the package version.
- `terrace init` initializes Terrace state and installs non-overwriting agent bootstrap files (`AGENTS.md`, `CLAUDE.md`, `.agents/skills/terrace-*`, `.claude/skills/terrace-*`, `.claude/commands/terrace-*`, and `.terrace/agents/manifest.json`) when they are absent.
- `terrace agents install-global` installs non-overwriting global Codex and Claude Code assets, including `/terrace` and the full `/terrace-*` command-reference surface.
- `terrace new-project <name> --prd <file>` or `--paste-prd` initializes Terrace from a source PRD and writes project artifacts.
- `terrace prd import <feature> --file <file>` or `--paste` imports a feature PRD into an existing Terrace project.
- `terrace doctor` checks installation health.
- `terrace spec validate` validates governance artifacts.
- `terrace spec hash --file <path>` computes a stable spec hash.
- `terrace audit` checks artifacts and protected baselines.
- `terrace ci check [files...]` runs audit and protected-change enforcement.
- `terrace adoption status` answers “Can Terrace replace GSD for me yet?” with a direct verdict, `replace_gsd` / `pilot_with_gsd_fallback` / `keep_gsd` mode, workflow evidence, blocking checks, and concrete next commands.
- `terrace port gsd --dry-run` inventories legacy GSD artifacts.
- `terrace port gsd` migrates supported legacy GSD artifacts into Terrace state.
- `terrace next` reports the next workflow action from state, handoff data, and blockers.
- `terrace resume` reconstructs paused workflow context from sessions and migrated handoff data.
- `terrace history` summarizes migrated phases, sessions, decisions, and quick tasks.
- `terrace do <intent>` routes natural-language agent intent to stable Terrace commands.
- `terrace autonomous` plans the next phase, prepares execution readiness, and stops at blockers or agent handoff.
- `terrace execute-phase-complete <id>` runs phase plan, execute, validate, review, and complete in order, stopping at blockers.
- `terrace settings effort <fast|standard|thorough>` sets the default phase effort used in planning and execution artifacts.
- `terrace settings show` prints the current Terrace settings.
- `terrace commands discover` detects package manager, project scripts, quality-gate command mapping, and dead-code gate readiness.
- `terrace align <feature>` writes `docs/terrace/features/<feature>/ALIGNMENT.md` with customer, problem, success metrics, risks, rollout, observability, validation, and cleanup intent.
- `terrace interrogate <feature>` captures user-driven edge-case, assumption-challenge, and failure-mode interrogation; agent skills ask the questions inline before writing the artifact.
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
- `terrace quick execute <id>` enters RED-gate execution for a quick task after a behavior-first test plan exists.
- `terrace quick complete <id>` writes a quick-task summary and marks it complete after verification evidence exists.
- `terrace backlog list` lists backlog items.
- `terrace backlog add <title>` appends a backlog item.
- `terrace ship check` runs release-readiness checks, discovers available project scripts, enforces active Senior Cycle ship gates, treats missing optional scripts as warnings, runs the dead-code gate when a script is discovered or configured, and exits nonzero when an available quality gate fails.
- `terrace ship prepare` writes `docs/terrace/ship/SHIP.md` from release-readiness results.
- `terrace workbench status [--feature <id>]` reads feature release evidence, missing senior-cycle gates, preflight, docs, AI review, workstreams, debt, security, test eval, and report-card claim scope.
- `terrace workbench prepare <feature> [--tier small|medium|large] [--for codex|claude|generic]` writes production workbench artifacts from preflight, runbook docs, release AI review, workstreams, and optional handoff primitives.
- `terrace plan-phase <id>`, `terrace execute-phase <id>`, `terrace validate-phase <id>`, `terrace review-phase <id>`, and `terrace complete-phase <id>` are GSD-compatible aliases.
- `terrace rule list` and `terrace rule explain <id>` inspect rule packs.
- `terrace preset list` and `terrace preset install <id>` manage presets.

## GSD Migration

`terrace port gsd` preserves the source `.planning/` tree, installs non-overwriting repo-local Terrace agent assets, and writes converted Terrace artifacts under `.terrace/`, `docs/prd/`, `docs/spec/`, `docs/terrace-migration/`, and `docs/testing/gsd/`. The migration report is written to `.terrace/migration/gsd-port-report.json` and includes `converted`, `skipped`, `writes`, `agents`, `blockers`, `warnings`, `readiness`, `next_command`, `review_checklist`, and `validation_commands`.

Migrated state includes roadmap phases and plans, decisions, sessions, handoff context, backlog items, blocked human actions, and quick-task history. Quick-task PLAN/SUMMARY files are archived under `docs/terrace-migration/quick/` and exposed through `terrace quick list` / `terrace quick show <id>`. Handoff remaining tasks and blocking human actions become backlog items so post-migration work is visible. Unsupported files are not deleted; each skipped artifact includes a reason and manual review action.

Use `terrace adoption status` after migration, corpus runs, or agent asset changes when the practical question is whether Terrace can replace GSD yet. The command is read-only and leads with a verdict, score, recommended mode, real workflow evidence, blockers, and next commands such as `terrace commands discover`, `terrace corpus run`, `terrace port gsd --dry-run`, `terrace init`, or `terrace report update`.

## Workflow Example

1. Capture intent in `docs/prd/PRD.md`.
2. Compile spec details in `docs/spec/COMPILED-SPEC.md`.
3. Design test trust in `docs/testing/TEST-ARCH.md`.
4. Use Terrace gates to require RED evidence before implementation and GREEN evidence before protection.
5. Run `terrace phase plan <id>`, `terrace phase execute <id>`, `terrace phase validate <id>`, `terrace phase review <id>`, and `terrace phase complete <id>` to preserve execution history.
6. Run `terrace audit`, `terrace ci check`, and `terrace ship prepare` before committing protected changes.

Agents can use `terrace do "plan phase 11"`, `terrace do "run phase 11 end to end"`, `terrace do "run the next phase"`, `terrace do "create quick task fix login redirect"`, `terrace do "make this feature ship-ready"`, or `terrace do "ship prepare"` when they have natural-language intent instead of a structured command. For the full phase lifecycle, prefer the explicit command: `terrace execute-phase-complete 11`.

## Senior Cycle

Terrace now has a senior-cycle artifact layer for adaptive rigor:

- Small changes: alignment-lite, test-first, execute, verify.
- Medium features: alignment, edge cases, test strategy, execute, ship check.
- Large/risky features: full alignment, interrogation, codebase mapping, design, TDD, observability, rollout, production validation, and cleanup.

See `docs/terrace/SENIOR-CYCLE.md` for the audit report, target workflow, artifact structure, enforcement rules, and implementation milestones. The no band-aid rule is the default: even `terrace quick` should choose maintainable architecture unless a short-term choice explicitly preserves future development and has a cleanup contract.

## Dead-Code Gate

`terrace ship check --full` looks for package scripts named `dead-code`, `deadcode`, `knip`, `unused`, `unused:check`, or `depcheck`. If one exists, Terrace runs it as the `dead_code` readiness category. If none exists, Terrace reports `DEAD_CODE_SCRIPT_MISSING` as a warning so repos can decide whether to enforce the signal.

Repos can pin the script names in `.terrace/config.json`:

```json
{
  "ship_gates": {
    "dead_code": {
      "scripts": ["unused:check"]
    }
  }
}
```

When a dead-code script is configured but missing or failing, `terrace ship check --full` reports a blocker. To intentionally skip the gate, record the reason:

```json
{
  "ship_gates": {
    "dead_code": {
      "enabled": false,
      "reason": "Generated client repo; source pruning is tracked upstream."
    }
  }
}
```

## Troubleshooting

- `Missing .terrace/state.json`: run `terrace init` from the repo root.
- `/terrace` or `/terrace-*` is missing in another local repo: run `terrace agents install-global`, then reload the Codex or Claude Code session.
- `Protected file changed without DECISION-LOG.md`: add a spec-linked decision before committing.
- `terrace port gsd` refuses to overwrite state: re-run with `--force` only after preserving existing `.terrace/state.json`.
- `terrace next` reports a blocked action after migration: complete or clear the migrated human action before treating the project as ready.
- `terrace ship check` exits nonzero: inspect the failed category and run the listed command directly for detailed output.
- `terrace ship check` reports `QUALITY_SCRIPT_MISSING`: add the suggested package script if that gate should be enforced for this project.
- `terrace ship check` reports `DEAD_CODE_SCRIPT_MISSING`: add a package script with `pnpm pkg set scripts["dead-code"]="knip"` or configure/skip `ship_gates.dead_code` in `.terrace/config.json`.
- `terrace do <intent>` cannot route an instruction: use an explicit command from `terrace --help` or include a clear phase number, quick-task request, resume/next/history request, or ship request.
- Typecheck errors from package dependencies usually mean the repo is not using the supported `Bundler` module resolution settings in `tsconfig.json`.

## Development

Canonical local verification is:

```sh
pnpm run ci
```

The publish allowlist is controlled by `package.json#files`; local planning, tests, and agent settings are not shipped. Release publishing uses public package access and npm provenance through `publishConfig` plus the GitHub Release workflow.
The GitHub Release workflow publishes through npm trusted publishing with OIDC, so release execution does not depend on local npm auth or an `NPM_TOKEN` secret.
