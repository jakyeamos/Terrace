# Terrace

Terrace is a strict-core workflow CLI for spec-driven, test-governed AI-assisted development. It keeps implementation work tied to a recoverable repo state, explicit spec intent, protected tests, and deterministic quality gates.

## Install

Terrace requires Node.js 22 or newer.

The registry currently publishes `@jakyeamos33/terrace@0.1.1` as `latest`. This checkout is prepared at `0.2.0`, which is a release candidate and is not published yet.

```sh
pnpm add -D @jakyeamos33/terrace
```

Run the installed package with `pnpm exec terrace`. For a one-off run of the current registry version, use:

```sh
pnpm dlx @jakyeamos33/terrace
```

To install the registry version globally:

```sh
pnpm add --global @jakyeamos33/terrace
```

## Quickstart

From the root of an existing repository:

```sh
pnpm exec terrace init
pnpm exec terrace next
```

Use `pnpm exec terrace doctor` to check installation health and `pnpm exec terrace ship check --json` for the default read-only readiness check.

## What Terrace Creates

`terrace init` writes only missing repo-local governance state and docs scaffolding. Re-running it preserves existing state, configuration, preset registry, rules, and event history byte-for-byte while repairing missing core or agent assets.

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

## State Safety

Terrace keeps its workflow state at `.terrace/state.json`. Current installations write schema `1.1` with a monotonic `state_revision`. Existing schema `1.0` state is accepted, validated, and promoted in memory without changing its bytes; the next successful Terrace mutation persists the canonical `1.1` form.

State mutations use an exclusive `.terrace/state.lock`, validate the complete canonical schema, sync a temporary file and its parent directory where the platform supports it, then atomically replace state. Stale-lock recovery is itself serialized through a temporary recovery claim, so a concurrent writer cannot delete a replacement lock; an interrupted recovery claim fails closed for inspection. A concurrent or stale mutation returns structured guidance instead of silently overwriting newer work. If a state file is damaged, restore a valid backup or use `terrace init --force --yes` only when a deliberate managed-state reset is appropriate.

## Managed Artifact Safety

The primary mutable Terrace-owned files under `.terrace/` use the managed-artifact boundary. It rejects path traversal, symlinked parents or files, special filesystem objects, malformed JSON/JSONL, and unexpected replacement of a parent directory while a write is in progress. Writes are serialized by `.terrace/locks/managed-artifacts.lock`, atomically replace a synced temporary file, and fail closed if an active writer or interrupted stale-lock recovery cannot be proven safe.

Preset installation journals its coupled policy and registry update under `.terrace/transactions/`, so an interrupted install is either completed or rolled back before the next managed mutation. Configuration, rule packs, policy, event history, generated manifests, session records, security evidence, migration reports, and lifecycle JSON use this same boundary. `terrace doctor` reports unsafe managed paths instead of treating them as healthy files.

## Agent Integration

`terrace init` makes a repository ready for Codex and Claude Code by default. It writes repo-local agent guidance only when the target file is missing, and preserves existing user or team guidance. Use `terrace agents repair` when only generated repo-local agent assets are missing; it never changes workflow state.

- Codex reads `AGENTS.md` and gets repo skills under `.agents/skills/` for the README command-reference surface, including `/terrace-next`, `/terrace-align`, `/terrace-phase-plan`, `/terrace-quick-plan`, and `/terrace-ship-check`.
- Claude Code reads `CLAUDE.md` and gets project skills plus project commands under `.claude/skills/` and `.claude/commands/` for the same command-reference surface.
- `.terrace/agents/manifest.json` records which assets were written, skipped, or unchanged during the latest init run.

If `AGENTS.md`, `CLAUDE.md`, or a matching Codex skill, Claude skill, or Claude command already exists, Terrace does not overwrite it. `terrace doctor` reports generated agent assets that differ from the current template; merge those updates manually so Terrace does not overwrite user-owned guidance.

For global local discovery, `terrace agents install-global` writes Codex skills under `~/.agents/skills/`, Claude Code skills under `~/.claude/skills/`, Claude Code slash commands under `~/.claude/commands/`, and manifests under each tool directory when absent. It preserves existing global skills and commands and reports them as skipped. The `/terrace` entry routes natural-language intent through `terrace do "$ARGUMENTS"` and falls back to `terrace next` when no arguments are provided. A write-capable route returns a state-bound plan token first; inspect its command, writes, and execution scope, then run its returned `apply.argv` only when that mutation is authorized.

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

The commands below verify the local `0.2.0` release candidate; they do not imply npm `latest` has moved until the release workflow completes.

```sh
pnpm run ci
pnpm audit --audit-level moderate
pnpm package
pnpm run release:dry-run
pnpm exec terrace ship check --json
pnpm exec terrace release-preflight --target-version 0.2.0 --json
```

`terrace ship check` defaults to a read-only fast mode and never runs project package scripts. Use `--local` to add a complete Git status check or `--full` only when you explicitly intend to run discovered quality and dead-code scripts; full execution is skipped until staged, unstaged, and untracked files are resolved. Those project scripts sit outside Terrace’s artifact boundary and may write project files. `terrace ship prepare` deliberately writes a release-readiness summary under `docs/terrace/ship/` after a full check by default; pass `--fast` to use a non-executing fast check before it writes the snapshot.
`terrace release-preflight` runs the release flow and returns one JSON summary for CI, audit, package, release dry-run, ship-check status, trusted-publishing prerequisites, tag/version alignment, and stale npm-era release instructions. `--static` keeps its ship-check portion read-only.
`pnpm run ci` includes the packed-consumer smoke test that installs Terrace from the generated tarball and verifies `terrace agents install-global` writes usable `/terrace` and `/terrace-*` global assets into temporary agent directories.

## Environment Contract

Run `pnpm run environment:contract` before opening a PR or changing repository guidance. It validates the routed context index, strict TypeScript settings, canonical quality commands, secret-path protections, the required pre-CR adapter, the CI wiring, and the blocking Quality Runner gate. The check is local and deterministic; it does not publish, deploy, contact a provider, or modify repository state.

## Command Reference

This generated index is checked against Terrace’s command catalog. Use `terrace --help` for the curated workflow and `terrace --help --json` for the complete machine-readable surface.

<!-- terrace-command-catalog:start -->
- `terrace init` — Initialize or safely repair Terrace state in this repo.
- `terrace agents repair` — Repair missing repo-local Terrace agent assets.
- `terrace agents install-global` — Install Terrace Codex skills into ~/.agents.
- `terrace new-project <name> --prd <file>|--paste-prd` — Initialize Terrace from a source PRD.
- `terrace prd import <feature> --file <file>|--paste` — Import a feature PRD into an existing Terrace project.
- `terrace doctor` — Diagnose Terrace installation health.
- `terrace spec validate` — Validate governance artifacts.
- `terrace spec hash --file <path>` — Compute a stable spec hash.
- `terrace audit` — Run governance audit checks.
- `terrace ci check [files...]` — Run audit plus protected-change checks.
- `terrace security check` — Run deterministic local security checks.
- `terrace corpus run` — Run the local Terrace corpus evaluator.
- `terrace corpus report` — Show the latest corpus report summary.
- `terrace adoption status` — Report GSD replacement readiness.
- `terrace port gsd [--dry-run|--compare|--verify-parity|--import-roadmap]` — Migrate or inventory legacy GSD artifacts.
- `terrace planning refresh` — Initialize or refresh .planning from Terrace state.
- `terrace next` — Show the next workflow action.
- `terrace resume` — Reconstruct paused workflow context.
- `terrace blocker list` — List migrated blocking actions and stable IDs.
- `terrace blocker resolve <id> --owner <owner> --evidence <ref>` — Record an evidence-bearing blocker correction.
- `terrace history` — Summarize migrated operational history.
- `terrace do <intent> | --apply <plan-token>` — Preview a route or apply its state-bound plan token.
- `terrace autonomous` — Plan next phase and stop at blocker or handoff.
- `terrace execute-phase-complete <id>` — Plan, execute, validate, review, and complete one phase.
- `terrace settings show` — Show Terrace settings.
- `terrace settings effort <fast|standard|thorough>` — Set the default phase-planning effort.
- `terrace commands discover` — Discover project quality scripts.
- `terrace align <feature>` — Write senior-cycle alignment artifact.
- `terrace interrogate <feature>` — Capture user-driven edge-case and failure-mode interrogation.
- `terrace map-codebase` — Write codebase context artifacts.
- `terrace design <feature>` — Write architecture decision artifact.
- `terrace test-plan <feature>` — Write behavior-first test strategy.
- `terrace observe <feature>` — Write observability plan.
- `terrace validate-prod <feature>` — Write production validation plan.
- `terrace cleanup <feature>` — Write cleanup contract.
- `terrace ui import-stitch <feature>` — Capture Stitch design import.
- `terrace ui plan-refresh <feature>` — Plan UI refresh work.
- `terrace ui diff <feature>` — Write UI source/target diff.
- `terrace workstreams plan <feature>` — Plan feature workstreams for production delivery.
- `terrace design-source import <source> <feature> <ref>` — Import design-source context for a feature.
- `terrace design-source diff <source> <feature> <ref>` — Compare imported design-source context for a feature.
- `terrace phase list` — List roadmap phases.
- `terrace phase show <id>` — Show a roadmap phase.
- `terrace phase plan <id>` — Generate a phase plan artifact.
- `terrace phase execute <id> [--parallel]` — Enter RED-gate execution for a phase.
- `terrace parallel plan <id>` — Preview safe parallel plan waves and file ownership.
- `terrace parallel start <id>` — Start isolated worktrees for a phase.
- `terrace parallel status <id>` — Inspect parallel worker evidence.
- `terrace parallel resume <id>` — Recover an interrupted parallel run.
- `terrace parallel merge <id>` — Merge verified parallel worker commits.
- `terrace parallel fail <id> <plan-id>` — Record a failed parallel worker plan.
- `terrace parallel cleanup <id>` — Clean up an isolated parallel run.
- `terrace phase validate <id>` — Generate validation artifact.
- `terrace phase review <id>` — Generate review artifact.
- `terrace phase complete <id>` — Complete a phase with summary artifact.
- `terrace plan-phase <id>` — GSD-compatible alias for phase plan.
- `terrace execute-phase <id>` — GSD-compatible alias for phase execute.
- `terrace validate-phase <id>` — GSD-compatible alias for phase validate.
- `terrace review-phase <id>` — GSD-compatible alias for phase review.
- `terrace complete-phase <id>` — GSD-compatible alias for phase complete.
- `terrace quick list` — List migrated quick-task history.
- `terrace quick show <id>` — Show one migrated quick task.
- `terrace quick plan <title>` — Create a stateful quick-task plan.
- `terrace quick execute <id>` — Enter RED-gate execution for a quick task.
- `terrace quick complete <id>` — Complete a quick task.
- `terrace backlog list` — List backlog items.
- `terrace backlog add <title>` — Add a backlog item.
- `terrace ship check [--fast|--local|--full]` — Run release readiness checks.
- `terrace ship prepare [--fast|--local|--full]` — Write PR/release readiness summary.
- `terrace release-preflight [--static] [--fast|--local|--full] [--target-version <version>]` — Run Terrace 0.2.0 release preflight summary.
- `terrace report [update|open|history|ceremony]` — Read or update report-card evidence.
- `terrace handoff create [--feature <id>] [--for codex|claude|generic]` — Create an agent or session handoff pack.
- `terrace debt add|list|audit|resolve` — Manage production debt entries and release gates.
- `terrace preflight <feature>` — Write production failure preflight.
- `terrace docu <feature>` — Write production documentation draft.
- `terrace test eval` — Evaluate test-suite trust.
- `terrace review ai --mode <mode>` — Run an AI release-review evidence pass.
- `terrace waive <gate>` — Record a reviewed temporary waiver.
- `terrace workbench status [--feature <id>]` — Read production workbench readiness.
- `terrace workbench prepare <feature> [--tier small|medium|large] [--for codex|claude|generic]` — Prepare production workbench evidence.
- `terrace rule add <domain> <rule-id>` — Add a rule to the project rule pack.
- `terrace rule audit` — Audit installed rule packs and evidence.
- `terrace rule list` — List installed rule packs.
- `terrace rule explain <id>` — Explain a rule.
- `terrace backfill` — Write standards backfill spec.
- `terrace preset list` — List installed presets.
- `terrace preset install <id>` — Install a preset.
- `terrace core init` — Compatibility alias for terrace init.
- `terrace quick <roadmap-item-id>` — Compatibility form for roadmap quick execution.
- `terrace roadmap execute <roadmap-item-id>` — Compatibility form for roadmap execution.

Global options: `--help`, `--version`, `--json`, and `--apply`.
<!-- terrace-command-catalog:end -->

Operational guarantees stay intentionally narrative rather than another command inventory: `terrace audit` is read-only and `terrace report update` is the explicit report writer; every write-capable natural-language route returns a state-bound apply token with its known write scope; `terrace ship check` is read-only by default and only `--full` runs discovered project scripts after a clean Git snapshot; `terrace ship prepare` writes `docs/terrace/ship/SHIP.md` after its chosen check mode. `terrace init --force --yes` retains managed backups and rolls back failed resets, while `terrace agents repair` adds only missing generated assets without changing workflow state.

`terrace preflight` and `terrace docu` author evidence from detected repository
surfaces. When hosted networking, authorization, environment, migration, or
observability surfaces are absent, the artifact records that absence or an
applicability decision; it does not invent a server, deployment, role model, or
data migration. Their rollback language always starts with reverting the
reviewed integration or release, then names product-specific recovery only when
the repository supplies evidence that it applies.

## GSD Migration

`terrace port gsd` preserves the source `.planning/` tree, installs non-overwriting repo-local Terrace agent assets, and writes converted Terrace artifacts under `.terrace/`, `docs/prd/`, `docs/spec/`, `docs/terrace-migration/`, and `docs/testing/gsd/`. The migration report is written to `.terrace/migration/gsd-port-report.json` and includes `converted`, `skipped`, `writes`, `agents`, `blockers`, `warnings`, `readiness`, `next_command`, `review_checklist`, and `validation_commands`.

If `.terrace/state.json` already exists and only executable roadmap phase targets are missing, run `terrace port gsd --import-roadmap`. It appends missing phases parsed from `.planning` and leaves existing Terrace phase objects unchanged.

Migrated state includes roadmap phases and plans, decisions, sessions, handoff context, backlog items, blocked human actions, and quick-task history. Quick-task PLAN/SUMMARY files are archived under `docs/terrace-migration/quick/` and exposed through `terrace quick list` / `terrace quick show <id>`. Handoff remaining tasks and blocking human actions become backlog items so post-migration work is visible. Unsupported files are not deleted; each skipped artifact includes a reason and manual review action.

Use `terrace adoption status` after migration, corpus runs, or agent asset changes when the practical question is whether Terrace can replace GSD yet. The command is read-only and leads with a verdict, score, recommended mode, real workflow evidence, blockers, and next commands such as `terrace commands discover`, `terrace corpus run`, `terrace port gsd --import-roadmap`, `terrace init`, or `terrace report update`.

Corpus evaluation keeps generated evidence in `.terrace/corpus/` in the target project, never in the installed package. The shipped default exercises synthetic fixtures; maintainers can set `TERRACE_CORPUS_CONFIG` to a private configuration for named shadow repositories and `TERRACE_CORPUS_DIR` to choose a different evidence directory.

## Workflow Example

1. Capture intent in `docs/prd/PRD.md`.
2. Compile spec details in `docs/spec/COMPILED-SPEC.md`.
3. Design test trust in `docs/testing/TEST-ARCH.md`.
4. Use Terrace gates to require RED evidence before implementation and GREEN evidence before protection.
5. Run `terrace phase plan <id>`, `terrace phase execute <id>`, `terrace phase validate <id>`, `terrace phase review <id>`, and `terrace phase complete <id>` to preserve execution history.
6. Run `terrace audit`, `terrace ci check`, and `terrace ship prepare` before committing protected changes.

When every phase plan declares explicit, non-overlapping file ownership, `terrace phase execute <id> --parallel` can create isolated worktrees for a ready wave. Inspect with `terrace parallel status`, merge verified workers with `terrace parallel merge`, and use `terrace parallel resume`, `terrace parallel fail`, or `terrace parallel cleanup` for recovery. The sequential phase path remains the fallback when ownership or evidence gates are not satisfied.

Agents can use `terrace do "plan phase 11"`, `terrace do "run phase 11 end to end"`, `terrace do "run the next phase"`, `terrace do "create quick task fix login redirect"`, `terrace do "make this feature ship-ready"`, or `terrace do "ship prepare"` to resolve natural-language intent instead of a structured command. Any write-capable route returns its command, parameters, writes, execution scope, and state-bound `apply` object without writing; inspect that plan, then run the returned `apply.argv` exactly when the mutation is intended. For the full phase lifecycle, prefer the explicit command: `terrace execute-phase-complete 11`.

## Senior Cycle

Terrace now has a senior-cycle artifact layer for adaptive rigor:

- Small changes: alignment-lite, test-first, execute, verify.
- Medium features: alignment, edge cases, test strategy, execute, ship check.
- Large/risky features: full alignment, interrogation, codebase mapping, design, TDD, observability, rollout, production validation, and cleanup.

See `docs/terrace/SENIOR-CYCLE.md` for the audit report, target workflow, artifact structure, enforcement rules, and implementation milestones. The no band-aid rule is the default: even `terrace quick` should choose maintainable architecture unless a short-term choice explicitly preserves future development and has a cleanup contract.

## Quality Runner Delivery Contracts

Terrace can opt into Quality Runner planning contracts without changing its
native RED/GREEN, senior-cycle, state, or GSD-alias behavior. Add this block to
`.terrace/config.json`:

```json
{
  "quality_runner": {
    "enabled": false,
    "analysis_mode": "balanced",
    "cache_mode": "external",
    "command": "quality-runner",
    "block_on": ["hard", "stale", "missing_evidence", "plan_coverage"]
  }
}
```

When enabled, `terrace phase plan` prepares or refreshes one QR delivery
contract and records its contract reference, performance receipt, obligations,
and verification commands in `PLAN.md`. `terrace phase execute` runs contract
preflight without rescanning the repository. `terrace phase validate` requires
one structured `QUALITY-RUNNER-RESULT.json` per phase/batch and performs the
single reconciliation path; review and completion consume that saved result.
Missing hard evidence, stale fingerprints, uncovered plan obligations, and
deferred hard checks block the lifecycle. The default external cache keeps QR
cache state out of the target checkout. Terrace reports an npm/QR-pnpm package
manager conflict explicitly and never rewrites either command surface.

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
- `STATE_REVISION_CONFLICT` or `STATE_WRITE_LOCKED`: wait for the active Terrace mutation to finish, reload state, and retry. Terrace reclaims a lock only when its recorded PID is confirmed absent; if the message names `.terrace/state.lock.recovery`, inspect that interrupted recovery claim before any manual intervention.
- `MANAGED_ARTIFACT_PATH_UNSAFE`, `MANAGED_ARTIFACT_WRITE_LOCKED`, or `MANAGED_ARTIFACT_TRANSACTION_RECOVERY_REQUIRED`: replace the unsafe filesystem object or inspect the named lock/transaction journal; Terrace will not follow a managed symlink, overwrite a live writer, or discard interrupted preset state.
- `STATE_SCHEMA_INVALID` or `STATE_JSON_INVALID`: restore a valid `.terrace/state.json` backup, or use `terrace init --force --yes` only for an intentional managed-state reset.
- `terrace init` needs to restart an existing workflow: use `terrace init --force --yes` only when you intend to reset managed Terrace state; restore files from the reported `.terrace/backups/` path if needed.
- Repo-local `/terrace-*` assets are incomplete: run `terrace agents repair`.
- `/terrace` or `/terrace-*` is missing in another local repo: run `terrace agents install-global`, then reload the Codex or Claude Code session.
- `Protected file changed without DECISION-LOG.md`: add a spec-linked decision before committing.
- `terrace port gsd` refuses to overwrite state: run `terrace port gsd --import-roadmap` when only missing executable phase targets need to be merged; use `--force` only after preserving existing `.terrace/state.json`.
- `terrace next` reports a blocked action after migration: complete or clear the migrated human action before treating the project as ready.
- `terrace ship check` exits nonzero: inspect the failed category and run the listed command directly for detailed output.
- `terrace ship check` reports `QUALITY_SCRIPT_MISSING`: add the suggested package script if that gate should be enforced for this project.
- `terrace ship check` reports `DEAD_CODE_SCRIPT_MISSING`: add a package script with `pnpm pkg set scripts["dead-code"]="knip"` or configure/skip `ship_gates.dead_code` in `.terrace/config.json`.
- `terrace do <intent> | --apply <plan-token>` cannot route an instruction: use an explicit command from `terrace --help` or include a clear phase number, quick-task request, resume/next/history request, or ship request.
- Typecheck errors from package dependencies usually mean the repo is not using the supported `Bundler` module resolution settings in `tsconfig.json`.

## Development

Canonical local verification is:

```sh
pnpm run ci
```

The publish allowlist is controlled by `package.json#files`; local planning, tests, and agent settings are not shipped. Release publishing uses public package access and npm provenance through `publishConfig` plus the GitHub Release workflow.
The GitHub Release workflow publishes through npm trusted publishing with OIDC, so release execution does not depend on local registry auth secrets.

## Development source association

Repository source ownership and bounded fixture links are recorded in [.project-compass/development.json](https://github.com/jakyeamos/terrace/blob/dev/.project-compass/development.json), with behavior gaps in [.project-compass/behaviors.json](https://github.com/jakyeamos/terrace/blob/dev/.project-compass/behaviors.json). These repository-only files retain the canonical workflow and required gates; local fixtures do not certify installed providers, published releases, concurrent state integrity, managed transactions or real project adoption.
