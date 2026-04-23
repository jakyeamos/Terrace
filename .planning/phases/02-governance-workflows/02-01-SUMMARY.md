---
phase: 02-governance-workflows
plan: "01"
subsystem: test-infrastructure
tags: [tdd, red-stubs, governance-workflows, fragment-system, spec-hash, agent-contracts]
dependency_graph:
  requires: []
  provides:
    - "RED test surface for all 26 Phase 2 requirements"
    - "tests/agent-contract.test.ts (AGNT-01/02/03/07/08)"
    - "tests/fragment-index.test.ts (FRAG-01/02/03/04/05)"
    - "tests/fragment-loader.test.ts (FRAG-02/03/04)"
    - "tests/workflow-interrogation.test.ts (WKFL-02/02a/02b/02c/03)"
    - "tests/workflow-spec-compiler.test.ts (WKFL-04/05)"
    - "tests/workflow-test-architect.test.ts (WKFL-06)"
    - "tests/workflow-intake.test.ts (WKFL-01/OPS-01/02)"
    - "tests/spec-hash.test.ts (OPS-03/04)"
  affects:
    - "Phase 2 plans 02-03 through 02-06 (each must find RED tests waiting)"
tech_stack:
  added: []
  patterns:
    - "Inline YAML frontmatter extractor (no external deps) reused across workflow test files"
    - "MODULE_NOT_FOUND sentinel pattern for asserting absence of not-yet-built CJS modules"
    - "fs.existsSync on known absolute paths for asserting absence of not-yet-built agent files"
key_files:
  created:
    - tests/agent-contract.test.ts
    - tests/fragment-index.test.ts
    - tests/fragment-loader.test.ts
    - tests/workflow-interrogation.test.ts
    - tests/workflow-spec-compiler.test.ts
    - tests/workflow-test-architect.test.ts
    - tests/workflow-intake.test.ts
    - tests/spec-hash.test.ts
  modified: []
decisions:
  - "Inline YAML frontmatter extractor: stdlib-only approach (split on ---, split on :) avoids external YAML lib in tests; follows same constraint as terrace-tools.cjs"
  - "MODULE_NOT_FOUND test design: require() in try/catch confirms module absence; test passes when error is thrown, proving RED state for that specific check; overall file is RED because all other assertions fail"
  - "spec-hash.cjs CLI test uses output scanning for 'unknown command' string to distinguish unrecognized vs. recognized-but-failing commands; avoids brittle exit code assumptions"
metrics:
  duration: "~12 minutes"
  completed_date: "2026-04-23"
  tasks_completed: 2
  tasks_total: 2
  files_created: 8
  files_modified: 0
---

# Phase 2 Plan 01: Wave 1 RED Stubs Summary

Eight RED test files covering all 26 Phase 2 requirements, written before any implementation exists. Prior Phase 1 baseline (88 tests) remains GREEN throughout.

## What Was Built

**Task 1 — Agent contract and steering loader RED tests** (`tests/agent-contract.test.ts`)

7 `it()` blocks covering AGNT-01, AGNT-02, AGNT-03, AGNT-07, AGNT-08:
- MODULE_NOT_FOUND sentinel test (confirms `fragment-loader.cjs` is absent)
- Agent directory existence for all 3 governance agents
- AGNT-07 field completeness check (purpose, allowed_outputs, forbidden_actions, required_inputs, handoff_behavior, artifact_ownership, fragment_index_ref)
- `fragment_index_ref` must point to `fragments/fragment-index.json` for all agents
- AGNT-08 steering load instruction must be literal first step in each SKILL.md

**Task 2 — Fragment, workflow, and spec hash RED tests** (7 files, 41 additional test cases)

| File | Requirements | Test count |
|------|-------------|-----------|
| tests/fragment-index.test.ts | FRAG-01/02/03/04/05 | 6 |
| tests/fragment-loader.test.ts | FRAG-02/03/04 | 4 |
| tests/workflow-interrogation.test.ts | WKFL-02/02a/02b/02c/03 | 7 |
| tests/workflow-spec-compiler.test.ts | WKFL-04/05 | 6 |
| tests/workflow-test-architect.test.ts | WKFL-06 | 5 |
| tests/workflow-intake.test.ts | WKFL-01/OPS-01/02 | 5 |
| tests/spec-hash.test.ts | OPS-03/04 | 6 |

## Final Test Counts

- **Phase 2 delta:** 41 failing (RED) + 6 passing (MODULE_NOT_FOUND sentinels) = 47 tests across 8 new files
- **Phase 1 baseline:** 88 passing (GREEN) across 8 existing files
- **Total suite:** 136 tests, 8 file-level passes, 8 file-level fails — `pnpm test` exits non-zero

## Verification Results

1. `pnpm test` exits non-zero — Phase 2 delta slice is RED ✓
2. Phase 1 baseline 8 files / 88 tests all GREEN ✓
3. All 8 new test files exist on disk ✓
4. `tests/agent-contract.test.ts` has 7 `it()` blocks ✓
5. No `it.todo()` anywhere in `tests/` ✓

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan creates only test files (RED stubs). No production implementation exists yet. That is the intended output.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Test files only access `process.cwd()` and tmpDir, consistent with existing test patterns. The `afterEach` cleanup calls `fs.rmSync(tmpDir, { recursive: true, force: true })` in every test file (T-02-02 mitigation). CLI tests use `execFileSync('node', [CLI, ...args])` not shell:true (T-02-04 mitigation).

## Self-Check: PASSED

- tests/agent-contract.test.ts — FOUND ✓
- tests/fragment-index.test.ts — FOUND ✓
- tests/fragment-loader.test.ts — FOUND ✓
- tests/workflow-interrogation.test.ts — FOUND ✓
- tests/workflow-spec-compiler.test.ts — FOUND ✓
- tests/workflow-test-architect.test.ts — FOUND ✓
- tests/workflow-intake.test.ts — FOUND ✓
- tests/spec-hash.test.ts — FOUND ✓
- Commit 62ef1a7 (Task 1) — FOUND ✓
- Commit 1bb7428 (Task 2) — FOUND ✓
