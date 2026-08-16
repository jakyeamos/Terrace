# Modernization Execution Plan

## Chosen strategy

**Deep refactor in place with compatibility adapters.** Terrace's durable value is its public CLI/artifact contract; a clean rewrite would make migration and release risk higher without simplifying the product boundary. Each milestone is a complete vertical slice with runnable behavior, contract tests, and a coherent commit.

## Guardrails

- Begin every milestone from a passing baseline for the work already completed, except explicitly recorded pre-existing failures.
- Do not publish, alter npm configuration, or run against a user repository as part of this plan.
- Preserve existing commands, aliases, JSON payloads, exit codes, and artifact paths unless the milestone contains a tested migration and documentation update.
- Remove obsolete paths only after every known consumer is migrated and the compatibility window is documented.
- Run the smallest relevant checks during work; run full verification at each milestone boundary.

## Milestone 0 — characterization and release containment

**Objective:** turn today's known failures into stable tests and prevent a broken package from being released.

- Affected systems: `package.json`, package scripts, `tests/product-readiness.test.ts`, test fixtures, CI/release workflow, package docs.
- Preserve: package name, CLI binary name, installation commands, public output contracts.
- Change intentionally: package content and dependency installation strategy may change.
- Deliverables:
  - Fresh-consumer smoke for every supported installation method.
  - Tarball content/size budget that rejects corpus evidence and incomplete dependency graphs.
  - A release-preflight gate that runs the actual packed-consumer smoke.
  - Baseline failure recorded as resolved only after a fresh consumer executes `terrace --help` and one stateful command.
- Failure modes: pnpm/npm layout differences, bundled dependency omissions, package files drift.
- Completion: `pnpm test`, package verification, and fresh-consumer smoke pass from a clean temporary directory.

## Milestone 1 — safe state and mutation contract

**Objective:** make bootstrap, state changes, and evidence generation recoverable and explicit.

- Affected systems: `state.cjs`, `init.cjs`, config/rule/preset writers, event log, report/security evidence, CLI mutation parsing.
- Preserve: `.terrace/state.json` location, existing valid state data, non-overwriting agent asset behavior.
- Change intentionally: writes use plan/apply semantics; destructive resets require an explicit force/backup path; stale evidence no longer passes.
- Deliverables:
  - State-store seam with runtime validation, version migration, atomic writes, backup/recovery, and revision/lock protection.
  - Idempotent `init` plus a separately named agent-asset repair operation.
  - Uniform read/write metadata and preview/apply behavior for mutation commands.
  - Evidence envelope with scope, freshness, schema version, input provenance, and invalidation.
- Tests: existing-state preservation, force reset + backup restore, interrupted write recovery, concurrent write conflict, stale/missing report/security failure, read-only command does not write.
- Rollback: retain prior state backup and a versioned migration rollback path; never delete original JSON before validated replacement.
- Completion: P0 init/state defects closed and all mutation contracts proven end to end.

## Milestone 2 — command catalog and honest routing

**Objective:** establish one source of truth for the command surface without breaking compatibility.

- Affected systems: `src/terrace-tools.cjs`, `agents.cjs`, `command-contracts.cjs`, README command reference, command tests, intent routing.
- Preserve: legacy argv shapes, aliases, JSON/exit contracts, generated asset paths during the compatibility period.
- Change intentionally: help and generated assets derive from a catalog; unsupported natural-language intents return structured guidance instead of an opaque error; write-capable intent returns a preview first.
- Deliverables:
  - Pure command catalog: ID, argv pattern, aliases, usage/help, read/write classification, JSON support, compatibility status, agent-template ID.
  - Dispatcher and pure intent router returning a command plan rather than invoking workflows directly.
  - Generated help, agent manifests, README reference validation, and remediation-command executability tests.
  - Fix or remove every emitted nonexistent command such as `senior-cycle status`.
- Tests: catalog-to-help parity, catalog-to-agent parity, every `next_command` executable, JSON snapshots, alias compatibility, preview/apply behavior.
- Completion: no manually duplicated command inventory remains authoritative.

## Milestone 3 — domain seams and import-safe package

**Objective:** make the core understandable, testable, and safe to import.

- Affected systems: `workflow.cjs`, `lifecycle.cjs`, `adoption.cjs`, `index.cjs`, `package.json`, repo analysis.
- Preserve: exported public functions through a compatibility facade and all documented workflow behavior.
- Change intentionally: remove the adoption/workflow cycle, split orchestration by domain, and reserve `bin` for executable behavior.
- Deliverables:
  - `project-analysis` extraction for command discovery/dead-code handling.
  - Separate readiness/report, roadmap/quick/backlog, senior-cycle, migration, and agent-asset services.
  - Curated root library API; import-safe `main`/`exports`; explicit optional CLI subpath if needed.
  - Contract tests for import behavior and public export compatibility.
- Failure modes: circular import regressions, changed initialization order, silent export collisions, public require/import breakage.
- Completion: dependency-cycle check is clean; no CLI executes on library import; workflow/lifecycle hotspots are reduced to domain-specific adapters.

## Milestone 4 — terminal command-center redesign

**Objective:** make the safe, contextual workflow the default human experience.

- Affected systems: CLI renderer, help content, status/readiness views, `/terrace` agent entrypoint, generated assets, documentation.
- Preserve: `--json` behavior, explicit legacy commands, noninteractive automation.
- Change intentionally: human text is default; commands organize around Start, Plan, Work, Release, and Admin; advanced compatibility surface moves behind `help --all`.
- Deliverables:
  - `terrace status`/bare `terrace` contextual dashboard.
  - Topic help, plain-text accessibility checks, clear mutation labels, and one safe next action.
  - Compact primary `/terrace` entrypoint; generated per-command skills become optional compatibility assets rather than the discovery model.
- Tests: terminal snapshots at narrow/wide widths where relevant, no-color readability, keyboard/piped-input behavior, JSON non-regression, all core journeys.
- Completion: a new user can initialize, orient, plan, execute, validate, and ship using documented primary paths without scanning a flat 80-command list.

## Milestone 5 — typed, observable, and efficient core

**Objective:** strengthen the implementation and operational signals after safety seams exist.

- Affected systems: selected domain modules, TypeScript/build configuration, linting, CI, security scan, corpus storage, observability docs.
- Preserve: Node 22 and CommonJS compatibility facade until a versioned migration permits change.
- Change intentionally: migrate bounded domains to strict TypeScript or checked JS, make semantic linting meaningful, prioritize runtime/config scans, and remove corpus from the publish path.
- Deliverables:
  - Runtime type coverage on migrated modules, with no false claim that the full legacy core is typed.
  - Source-prioritized security scanning and freshness enforcement.
  - Explicit `--run-project-checks` execution boundary with output capture/timeouts.
  - Tarball size/content budget and corpus archival policy.
- Tests: runtime type gate includes production modules, security scan selection tests, command execution policy tests, package-size regression test.
- Completion: current quality signals correspond to the code and artifacts they claim to assess.

## Milestone 6 — cutover, removal, and adversarial review

**Objective:** remove transition debris and prove the final system against its baseline.

- Affected systems: compatibility adapters, stale docs/reports, unused dependencies, generated asset duplication, release procedures.
- Deliverables:
  - Migration guide and rollback instructions.
  - Fresh evidence for tests, security, report, adoption/readiness, package install, and release preflight.
  - Independent adversarial review for state integrity, package release, command compatibility, GSD migration, CLI accessibility, and docs accuracy.
  - Removal of obsolete registries, stale artifacts, dead flags, and temporary shims.
- Completion: no confirmed P0/P1 remains; every remaining P2 is either fixed or explicitly accepted with owner and expiry.

## Verification matrix

At each milestone boundary run the relevant subset, then the full agreed suite before moving on:

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm test:coverage
pnpm package:dry-run
pnpm secret:scan
pnpm dependency:security
node src/terrace-tools.cjs ship check --fast --json
```

The final release check additionally runs a fresh packed-consumer installation and corrected release preflight. It must not treat cached reports, missing security evidence, or hidden write side effects as passing evidence.

## Cutover and rollback

- Cut over one vertical journey at a time behind compatibility adapters, not two complete workflow engines.
- Version and back up state before any migration. A failed migration restores the prior valid artifact and reports the recovery action.
- Retain command aliases until their deprecation window ends; instrument/document their use only through local, opt-in diagnostics.
- Never delete historical corpus evidence until package exclusion and archival verification prove it is no longer a runtime dependency.
