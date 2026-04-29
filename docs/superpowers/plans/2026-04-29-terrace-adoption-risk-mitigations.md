# Terrace Adoption Risk Mitigations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add first-class Terrace controls for migration confidence, artifact weight, rule maturity, performance visibility, and explicit escape hatches.

**Architecture:** Keep the first slice inside the existing CommonJS core and CLI command surface. Reuse `.terrace/state.json` for durable evidence and generate markdown/json artifacts only through existing safe writers.

**Tech Stack:** Node.js CommonJS CLI, Vitest, repository-local `.terrace` state, markdown evidence under `docs/terrace/`.

---

### Task 1: Ship Check Timing And Modes

**Files:**
- Modify: `packages/terrace-core/src/workflow.cjs`
- Modify: `src/terrace-tools.cjs`
- Test: `tests/workflow-commands.test.ts`

- [x] Add `shipCheck(cwd, { mode })` where `mode` is `fast`, `local`, or `full`.
- [x] Record elapsed milliseconds per category in a `timings` array.
- [x] Make `fast` skip project script execution and dirty-tree checks.
- [x] Keep default behavior as `full`.
- [x] Add tests proving `fast` does not execute failing package scripts and `full` still reports failures.

### Task 2: Ceremony And Evidence Density Report

**Files:**
- Modify: `packages/terrace-core/src/lifecycle.cjs`
- Modify: `src/terrace-tools.cjs`
- Test: `tests/lifecycle-coverage.test.ts`

- [x] Add `reportCeremony(cwd)` returning artifact counts, markdown word counts, empty-section signals, and recommended artifact budget by active tier.
- [x] Add CLI route `terrace report ceremony`.
- [x] Add a test proving generated artifacts are counted and empty boilerplate is surfaced.

### Task 3: GSD Migration Compare And Verify

**Files:**
- Modify: `packages/terrace-core/src/port-gsd.cjs`
- Modify: `src/terrace-tools.cjs`
- Test: `tests/core-port-gsd-migration.test.ts`

- [x] Add `portGsdCompare(cwd)` that inventories `.planning` source files and maps phases, quick tasks, decisions, sessions, backlog, blockers, converted, skipped, and missing critical concepts.
- [x] Add `portGsdVerifyParity(cwd)` that returns `passed: false` when critical source concepts have no Terrace mapping.
- [x] Add CLI routes `terrace port gsd --compare` and `terrace port gsd --verify-parity`.
- [x] Add tests with representative `.planning` content.

### Task 4: Rule Maturity And Effectiveness

**Files:**
- Modify: `packages/terrace-core/src/lifecycle.cjs`
- Modify: `src/terrace-tools.cjs`
- Test: `tests/agent-production-lifecycle-full.test.ts`

- [x] Add rule maturity fields: `maturity`, `owner`, `review_after`, and `source`.
- [x] Keep ownerless authored rules auditable.
- [x] Add `terrace rule audit --effectiveness` output listing draft/observing/warning/blocking counts and rules with weak metadata.
- [x] Add tests for bundled rules and authored rules.

### Task 5: Explicit Waivers

**Files:**
- Modify: `packages/terrace-core/src/state.cjs`
- Modify: `packages/terrace-core/src/lifecycle.cjs`
- Modify: `packages/terrace-core/src/workflow.cjs`
- Modify: `src/terrace-tools.cjs`
- Test: `tests/agent-production-lifecycle.test.ts`

- [x] Add `terrace waive <gate> --reason <text> --owner <name> --expires <condition>`.
- [x] Store waivers in `.terrace/state.json`.
- [x] Add waiver visibility to report and ship check.
- [x] Do not silently remove blockers; waivers appear as reviewed overrides.
- [x] Add tests for creating and surfacing a waiver.

### Task 6: Shadow Branch Corpus

**Files:**
- Modify: `.tracker/PROJECT_TRUTH.md`

- [x] Create branch refs named `codex/terrace-shadow-test` in every GSD `.planning` repository without switching branches.
- [x] Record any repository that could not receive the branch.
- [x] Use these branches as the seed corpus for future `terrace corpus run`.

### Verification

- [x] Run `npm run typecheck`.
- [x] Run `npm run lint`.
- [x] Run focused tests for changed files.
- [x] Run `npm run ci`.
- [x] Run `node src/terrace-tools.cjs report --json`.
- [x] Run `node src/terrace-tools.cjs ship check --json`.
