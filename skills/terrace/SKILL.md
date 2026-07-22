---
name: terrace
description: Use when an agent works with the @jakyeamos33/terrace package or its `terrace` CLI to initialize, plan, execute, validate, migrate, audit, or ship a spec-driven repository. Covers the 0.2.x CommonJS CLI/core surface; do not use it as a substitute for package-specific project instructions or undocumented internal APIs.
---

# Terrace package skill

## Package metadata

- Package: `@jakyeamos33/terrace`
- Snapshot version: `0.2.0`; this skill is intended for the `0.2.x` surface. Verify `terrace --version` before using release-specific commands.
- Type: Node.js CommonJS CLI with a reusable named-export core; it writes governance state and documentation into a target repository.
- Runtime: Node.js `>=22.0.0`.
- Package manager: pnpm (`pnpm@11.7.0` in this repository).
- Entry points: `terrace` -> `src/terrace-tools.cjs`; package export `.` -> the core named exports.
- Source of truth consulted: `package.json`, `README.md`, `CHANGELOG.md`, `docs/ARCHITECTURE.md`, `docs/COMPATIBILITY.md`, `docs/SECURITY.md`, `docs/RELEASE.md`, `src/terrace-tools.cjs`, `packages/terrace-core/src/index.cjs`, command contracts, and representative CLI/core/lifecycle/doctor/JSON/init/migration tests.

## When to use this skill

Use it for Terrace CLI commands, repository governance artifacts, phase or quick-task workflows, PRD intake, GSD migration, agent asset installation, release readiness, or code that imports the published core. First read the target repository's `AGENTS.md`, `CLAUDE.md`, `.terrace/config.json`, and existing Terrace state; those are local authority.

## Package mental model

Terrace is a strict-core workflow tool, not an application framework or remote service. The CLI parses arguments and delegates to the core. A target repository stores runtime state in `.terrace/state.json`, config/events/rules alongside it, and authored governance artifacts under `docs/`. Workflow transitions and RED/GREEN gates are deliberate contracts: a blocker is evidence to resolve, not permission to bypass.

Prefer the CLI for agent workflows and automation. Use the package root named exports only when embedding deterministic local behavior in Node code:

```js
const { initCore, runDoctor } = require('@jakyeamos33/terrace');
```

The published root is the stable import boundary. Do not import `packages/terrace-core/src/*.cjs` or `src/terrace-tools.cjs` from consumer code.

## Installation and setup

```sh
pnpm add -D @jakyeamos33/terrace
pnpm exec terrace --version
pnpm exec terrace init
pnpm exec terrace doctor --json
```

Run commands from the repository root. `init` creates `.terrace/` state and non-overwriting agent/docs scaffolding; inspect its JSON result before assuming a file was written. Global agent assets are opt-in:

```sh
pnpm exec terrace agents install-global
```

## Common workflows

- Start or inspect a repo: `terrace init`, `terrace doctor`, `terrace audit`, `terrace next`, `terrace resume`.
- PRD intake: `terrace new-project <name> --prd <file>` or `--paste-prd`; later use `terrace prd import <feature> --file <file>` or `--paste`.
- Senior-cycle feature preparation: `align`, `interrogate`, `map-codebase`, `design`, `test-plan`, `observe`, `validate-prod`, and `cleanup`.
- Phase lifecycle: `phase list/show/plan/execute/validate/review/complete`; use `execute-phase-complete <id>` only when the full lifecycle is intended.
- Small work: `quick plan <title>`, `quick execute <id>`, `quick complete <id>`; execution expects RED evidence and completion expects verification evidence.
- Migration: begin with `port gsd --dry-run`; use `--import-roadmap` to merge missing phases into existing Terrace state. Preserve `.planning/` and review the migration report.
- Shipping: `ship check` is read-only; `ship prepare` writes a summary. `workbench status/prepare` gathers feature release evidence.
- Machine use: add `--json` where supported and parse stdout; use command exit status as the success signal.

Native commands are preferred. `plan-phase`, `execute-phase`, `validate-phase`, `review-phase`, and `complete-phase` are GSD-compatible aliases, not the preferred spelling for new work.

## Preferred APIs and idioms

- Use `terrace commands discover` to learn the target repo's detected package manager, test, typecheck, lint, build, coverage, and packaging commands before running gates.
- Use `terrace do "<intent>"` for natural-language routing only when an explicit command is not clearer; use `terrace next` when no intent is supplied.
- Use `terrace spec validate`, `terrace audit`, and `terrace ci check [files...]` to validate artifacts and protected changes.
- Use `terrace security check` for deterministic local checks. The CLI does not run external scanners by default.
- Treat `--force` as an exceptional migration/install option. Preserve existing state and inspect the dry run first.
- Current core exports are synchronous CommonJS functions; do not infer Promise behavior or mix an assumed async API into callers. For CLI automation, spawn the CLI and handle stdout/stderr/exit status.

## Error handling and debugging

Start with `terrace doctor --json`, then inspect each `blocking[].code`, `message`, and `remediation`. Common fixes include running `init` from the repo root for missing `.terrace/state.json`, completing migrated human actions reported by `next`, and running the failing quality command directly when `ship check` reports a failed category. Do not turn a blocker into a success by suppressing output or forcing a state transition.

For JSON consumers, keep stdout machine-readable and send diagnostics elsewhere. Validate JSON before accessing nested fields; tests establish stable shapes for `doctor` (`blocking`, `warnings`, `healthy`) and init/agent-install results.

## Testing and validation

For this repository, run the smallest relevant check first, then the full gate for release-level work:

```sh
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
pnpm run package:dry-run
pnpm run secret:scan
pnpm run dependency:security
pnpm run ci
```

CLI smoke tests: `pnpm exec terrace --help`, `pnpm exec terrace --version`, `pnpm exec terrace doctor --json`, and in a disposable repo `pnpm exec terrace init --json`. Use `ship check --fast` when project scripts should not execute; use ordinary `ship check` for the complete discovered-gate assessment.

## Security and safety

Run only against the intended repository root and inspect paths before commands that write state or docs. Do not hard-code secrets, commit `.env` files, or expose sensitive values in generated artifacts/logs. Do not invoke untrusted external scanners or network operations through Terrace without explicit scope and review. Avoid destructive filesystem operations; Terrace preserves user-owned agent files and migration sources by design. Never use `port gsd --force` until existing `.terrace/state.json` is backed up or otherwise preserved.

## Common mistakes to avoid

- Running from a parent or child directory and creating state in the wrong repo.
- Treating the README's npm `latest` note as proof that `0.2.0` is published; verify the installed version.
- Importing private source paths instead of `require('@jakyeamos33/terrace')`.
- Assuming every command supports every flag; check `--help` and command contracts.
- Ignoring nonzero exits, `blocking` findings, RED/GREEN gates, or migration warnings.
- Overwriting existing `AGENTS.md`, `CLAUDE.md`, skills, commands, or `.terrace/state.json` without review.
- Relying on undocumented output fields or internal module layout.

## Migration and release notes

The `0.2.0` release adds adoption status, merge-safe GSD roadmap import, pnpm-first guidance, workbench commands, release metadata, and stricter release-tag checks. `0.1.2` added non-overwriting agent bootstrap, end-to-end phase routing, and phase effort settings. Re-check changelog and compatibility docs before using older GSD aliases or migrating state. No separate deprecated-export list is declared in the repository; treat compatibility aliases and internal paths as legacy/compatibility surfaces unless current docs say otherwise.

When the package version changes, update this skill's version/range, entry points and commands, migration notes, source-of-truth list, and validation commands. Re-run the skill validator and package CLI smoke tests; update any examples when public exports, output shapes, runtime requirements, or safety behavior changes.

## Before finalizing generated code

Confirm the import is from the package root, the command exists in current `--help`, paths are rooted at the intended repo, writes are expected, secrets are excluded, and relevant validation has passed. If behavior is not documented or covered by source/tests, state the uncertainty and inspect the current version before proceeding.
