# Modernization Target

## Product definition

Terrace becomes a trustworthy terminal command center for spec-driven AI development: a developer or agent can understand the current state, see whether an action will write, take one safe next step, and rely on every readiness claim.

This is a CLI/product redesign. Terrace has no browser UI, so a web-app rewrite is deliberately out of scope.

## Product principles

1. **Truth before ceremony.** A readiness score is backed by current, scoped, machine-readable evidence or it is unavailable.
2. **Safe by default.** Read commands never write; mutation commands preview their changes and require an explicit apply boundary.
3. **One command model.** Help, CLI parsing, JSON contracts, agent assets, README references, and tests derive from a single catalog.
4. **Recoverable state.** State writes validate, migrate, backup when destructive, atomically replace, and detect concurrent updates.
5. **One primary path, compatible edges.** The contextual entrypoint is compact and human-friendly; existing public commands and GSD aliases remain stable compatibility routes during migration.

## Core journeys to preserve

1. Bootstrap an existing repository without destroying local work, then install Codex/Claude integrations safely.
2. Intake a project or feature from a PRD and preserve its source material.
3. Inspect, migrate, and continue legacy GSD plans without losing source artifacts.
4. Orient, plan, execute, validate, resume, and hand off a daily workstream.
5. Gather security, test, debt, documentation, and release evidence before shipping.

## Human interaction direction

- `terrace` and `terrace status` are the contextual front door: active project/feature, state freshness, blockers, one recommended next action, why it was chosen, and its read/write classification.
- Commands group by job: **Start**, **Plan**, **Work**, **Release**, and **Admin**. `terrace help <topic>` is concise; `--all` exposes advanced and compatibility commands.
- Human output is concise, plain text, keyboard/screen-reader friendly, and never relies on color alone. `--json` remains the machine contract.
- Every write-capable command offers a preview/plan mode. `--apply` performs the mutation. Destructive reset requires `--force`, a backup, and an explicit confirmation strategy appropriate to interactive/noninteractive use.

## Target architecture

```text
CLI renderer
  -> command dispatcher
     -> command catalog (single metadata source)
     -> domain services
        -> state store | artifact writer | project analysis | process runner
```

### Boundaries

- `platform/`: filesystem, process runner, clock, git, locking.
- `state/`: schema validation, migrations, optimistic revisions, backup/recovery, atomic persistence, and event log.
- `project-analysis/`: pure repository scans and command discovery; never coupled to workflow control.
- `domains/`: roadmap, senior cycle, readiness, migration, agent assets, reports, and release evidence.
- `commands/`: catalog, parser, aliases, preview/apply policy, grouped handlers, and compatibility adapter.
- `cli/`: global option parsing plus human/JSON rendering only.

The root library export is an explicit, import-safe public facade. `bin` is the only CLI entrypoint. Existing CommonJS consumers remain supported through a compatibility facade until a documented breaking-release window.

## Data, security, and observability

- Keep `.terrace/state.json` as the external artifact initially, but move all access through one versioned state store.
- Load validates schema and migrates before use; writes use a lock/revision check, temp file, fsync/rename where supported, and a recoverable backup for destructive operations.
- Security scanning prioritizes source, configuration, workflows, and package metadata; generated corpora cannot crowd out runtime files. Missing, stale, or malformed security evidence is never a silent pass.
- Every report carries evidence schema version, claim scope, command/version, timestamp, inputs, freshness policy, and deterministic invalidation conditions.
- Project command execution is opt-in, logged as an explicit action, bounded with timeouts, and never concealed behind a read-only verb.

## Package and dependency direction

- Publish only executable runtime, templates required at runtime, concise public documentation, license, and changelog.
- Do not bundle direct dependencies without their complete production graph. Prefer normal package dependency installation unless a verified bundling strategy has a clear benefit.
- Add fresh-consumer smoke tests for pnpm and npm-compatible installation paths, plus a tarball file-list and size budget.

## Type and test strategy

- First add characterization tests for current help text, aliases, JSON outputs, artifact paths, state migrations, import behavior, and packed-consumer installation.
- Then migrate bounded modules to strict TypeScript, or temporarily use checked JS until each migrated domain compiles into a clear publish boundary. Do not claim runtime type coverage before it exists.
- Test mutation previews, apply behavior, failure recovery, concurrent state writes, stale evidence, and every emitted remediation command.
- Keep behavior-first end-to-end CLI tests; reduce fixture/corpus noise in fast feedback paths.

## Decisions made for this plan

| Decision | Default |
| --- | --- |
| Delivery strategy | Deep refactor in place with compatibility adapters and vertical milestones; a parallel shell adds little value for a CLI library. |
| Compatibility | Preserve public commands, JSON, exit codes, and `.terrace` artifact paths through the modernization. Deprecate only with a documented migration path. |
| UI direction | CLI-first contextual dashboard, not a web UI or a mandatory full-screen TUI. |
| State migration | Preserve the existing JSON path and migrate in place with validation, backups, atomic writes, and rollback. |
| Language migration | Staged strict TypeScript conversion at domain seams; do not force a repo-wide rewrite before safety and contract coverage. |
| Publish surface | Ship runtime/templates/concise guides; keep corpus evidence repository-only or release-artifact-only. |

## Non-goals

- Replacing Node 22, package manager, GitHub OIDC, or the public package name without a demonstrated need.
- Inventing a database, hosted service, account system, or web interface.
- Removing GSD compatibility or agent integrations as part of the first cutover.
- Treating aesthetic rewrites as progress without a measurable reliability, usability, or maintainability outcome.

## Target quality score

| Dimension | Target (1–5) |
| --- | ---: |
| Product coherence | 4 |
| Correctness and data integrity | 4 |
| Architecture | 4 |
| Maintainability | 4 |
| Testability | 4 |
| Security and privacy | 4 |
| CLI UX and accessibility | 4 |
| Performance and package efficiency | 4 |
| Operability | 4 |
| Developer experience | 4 |

The target is deliberately not a 5 across the board: it avoids claiming hosted-service telemetry, cross-platform terminal perfection, or a complete TypeScript rewrite before evidence exists.
