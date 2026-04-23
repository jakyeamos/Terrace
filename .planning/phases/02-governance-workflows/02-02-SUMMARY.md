---
phase: 02-governance-workflows
plan: "02"
subsystem: agent-definition-framework
tags: [tdd, governance-agents, fragment-system, skill-md, fragment-loader]
dependency_graph:
  requires:
    - "02-01 (RED stubs: tests/agent-contract.test.ts, tests/fragment-index.test.ts, tests/fragment-loader.test.ts)"
  provides:
    - ".agents/skills/terrace-spec-interrogator/SKILL.md (AGNT-07/08 conforming)"
    - ".agents/skills/terrace-spec-compiler/SKILL.md (AGNT-07/08 conforming)"
    - ".agents/skills/terrace-test-architect/SKILL.md (AGNT-07/08 conforming)"
    - ".agents/skills/*/fragments/fragment-index.json (core-tier catalogs)"
    - "src/lib/fragment-loader.cjs (loadFragments export)"
  affects:
    - "Plans 02-03 through 02-05 (step files extend these SKILL.md files)"
    - "Plan 02-06 (integration tests against these agent definitions)"
tech_stack:
  added: []
  patterns:
    - "SKILL.md YAML frontmatter with all AGNT-07 fields (purpose, allowed_outputs, forbidden_actions, required_inputs, handoff_behavior, artifact_ownership, fragment_index_ref)"
    - "fragment-index.json schema: { agent, fragments: [{ id, name, tags, tier, file }] }"
    - "CJS module (stdlib only) returning { contents: string[], tokenCount: number }"
    - "Path traversal guard: fragPath.startsWith(path.resolve(agentDir)) check before fs.readFileSync"
key_files:
  created:
    - .agents/skills/terrace-spec-interrogator/SKILL.md
    - .agents/skills/terrace-spec-compiler/SKILL.md
    - .agents/skills/terrace-test-architect/SKILL.md
    - .agents/skills/terrace-spec-interrogator/fragments/fragment-index.json
    - .agents/skills/terrace-spec-interrogator/fragments/frg-int-01-question-rounds.md
    - .agents/skills/terrace-spec-interrogator/fragments/frg-int-02-assumption-logging.md
    - .agents/skills/terrace-spec-compiler/fragments/fragment-index.json
    - .agents/skills/terrace-spec-compiler/fragments/frg-cmp-01-spec-frontmatter.md
    - .agents/skills/terrace-spec-compiler/fragments/frg-cmp-02-invariant-patterns.md
    - .agents/skills/terrace-test-architect/fragments/fragment-index.json
    - .agents/skills/terrace-test-architect/fragments/frg-tst-01-test-layers.md
    - .agents/skills/terrace-test-architect/fragments/frg-tst-02-risk-scoring.md
    - src/lib/fragment-loader.cjs
  modified: []
decisions:
  - "loadFragments returns { contents: string[], tokenCount: number } matching the test contract in fragment-loader.test.ts (not { fragments: [...] } as shown in plan pseudocode)"
  - "Path traversal guard uses startsWith(path.resolve(agentDir) + path.sep) to correctly reject paths that equal sibling directories sharing a common prefix"
  - "MODULE_NOT_FOUND sentinel tests in agent-contract.test.ts and fragment-loader.test.ts now fail because the module exists — this is by-design test-state evolution, not a regression"
metrics:
  duration: "~3 minutes"
  completed_date: "2026-04-23"
  tasks_completed: 2
  tasks_total: 2
  files_created: 13
  files_modified: 0
---

# Phase 2 Plan 02: Agent Definition Framework Summary

Three governance agent SKILL.md files with full AGNT-07/08 compliance, three core-tier fragment catalogs, six placeholder fragment .md files, and the `src/lib/fragment-loader.cjs` module that loads fragments by tier with a path traversal guard.

## What Was Built

**Task 1 — Three governance agent SKILL.md files** (`75001c1`)

Each SKILL.md contains all seven AGNT-07 fields in YAML frontmatter:
- `purpose`, `allowed_outputs`, `forbidden_actions`, `required_inputs`, `handoff_behavior`, `artifact_ownership`, `fragment_index_ref`
- AGNT-08 first workflow step: `Read `.terrace/steering.md` before any other step.`
- Workflow entry point stub routing (step-01/02/03) — step files added in Plans 02-03 through 02-05

Agent summaries:
| Agent | Purpose | Outputs |
|-------|---------|---------|
| terrace-spec-interrogator | Structured question rounds to reduce ambiguity | CLARIFICATIONS.md, EDGE-CASES.md |
| terrace-spec-compiler | Converts PRD + interrogation output to compiled spec | COMPILED-SPEC.md, INVARIANTS.md, PERMISSIONS-MATRIX.md, STATE-MACHINES.md |
| terrace-test-architect | Maps requirements to test layers with P0-P3 risk scores | TEST-ARCH.md, COVERAGE-PLAN.md |

**Task 2 — Fragment indexes, placeholder fragments, fragment-loader.cjs** (`1c222d0`)

Fragment index schema per D-10 / FRAG-01: `{ agent, fragments: [{ id, name, tags, tier, file }] }`

| Agent | Fragment IDs | Tier |
|-------|-------------|------|
| terrace-spec-interrogator | FRG-INT-01, FRG-INT-02 | core |
| terrace-spec-compiler | FRG-CMP-01, FRG-CMP-02 | core |
| terrace-test-architect | FRG-TST-01, FRG-TST-02 | core |

`src/lib/fragment-loader.cjs` exports `loadFragments(agentDir, options)`:
- `options.tier` = `'core' | 'extended' | 'specialized' | 'all'`
- Returns `{ contents: string[], tokenCount: number }`
- Path traversal guard (T-02-05): throws `UNSAFE_PATH` if resolved fragment path escapes `agentDir`
- `tokenCount` = `Math.ceil(totalChars / 4)` (standard LLM approximation)

## Test Results

| Test file | Tests | Result |
|-----------|-------|--------|
| tests/agent-contract.test.ts | 6/7 pass | AGNT-01/02/03/07/08 assertions GREEN; MODULE_NOT_FOUND sentinel now RED (expected) |
| tests/fragment-index.test.ts | 6/6 pass | FRAG-01/02/03/05 assertions all GREEN |
| tests/fragment-loader.test.ts | 3/4 pass | FRAG-02/04 core-tier and ratio tests GREEN; MODULE_NOT_FOUND sentinel now RED (expected) |
| tests/validate.test.ts | all pass | Phase 1 baseline GREEN |
| tests/init.test.ts | all pass | Phase 1 baseline GREEN |

The two MODULE_NOT_FOUND sentinel tests (one in each file) were written in Plan 02-01 to assert the module's absence. They now correctly indicate the module exists and are expected to remain in this state for the rest of Phase 2.

## Deviations from Plan

**1. [Rule 1 - Bug] loadFragments return shape corrected to match test contract**
- **Found during:** Task 2
- **Issue:** Plan pseudocode showed `{ fragments: Array<{id, name, tier, content}>, tokenCount }`, but `tests/fragment-loader.test.ts` asserts `result.contents` (array of strings, not objects) with `result.contents.length`
- **Fix:** `loadFragments` returns `{ contents: string[], tokenCount: number }` — contents is a plain string array where each element is the raw file content
- **Files modified:** `src/lib/fragment-loader.cjs`
- **Commit:** `1c222d0`

**2. [Rule 2 - Path traversal guard] Strengthened boundary check**
- **Found during:** Task 2 (threat model T-02-05)
- **Issue:** Simple `startsWith(path.resolve(agentDir))` would allow a path like `/agents/skills/terrace-spec-interrogator-evil/` to pass if `agentDir` = `/agents/skills/terrace-spec-interrogator`
- **Fix:** Guard checks `startsWith(path.resolve(agentDir) + path.sep)` to require a directory separator after the base path
- **Files modified:** `src/lib/fragment-loader.cjs`
- **Commit:** `1c222d0`

## Known Stubs

The fragment `.md` files contain one-sentence placeholder content. They are intentionally minimal per the plan: "Content for now: a single markdown heading matching the fragment name plus one sentence description." Plans 02-03 through 02-05 will replace this content with real workflow knowledge.

- `.agents/skills/terrace-spec-interrogator/fragments/frg-int-01-question-rounds.md` — placeholder
- `.agents/skills/terrace-spec-interrogator/fragments/frg-int-02-assumption-logging.md` — placeholder
- `.agents/skills/terrace-spec-compiler/fragments/frg-cmp-01-spec-frontmatter.md` — placeholder
- `.agents/skills/terrace-spec-compiler/fragments/frg-cmp-02-invariant-patterns.md` — placeholder
- `.agents/skills/terrace-test-architect/fragments/frg-tst-01-test-layers.md` — placeholder
- `.agents/skills/terrace-test-architect/fragments/frg-tst-02-risk-scoring.md` — placeholder

The SKILL.md workflow sections contain routing stubs: "Step files will be added in Plans 02-03 through 02-05." These stubs do not block the plan's goal (agent contract establishment); step file content is Plans 02-03/04/05 scope.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced. `fragment-loader.cjs` accesses the filesystem but is constrained to `agentDir` via path traversal guard (T-02-05). SKILL.md workflow text contains no executable code or shell commands (T-02-06 within scope).

## Self-Check: PASSED

Files:
- `.agents/skills/terrace-spec-interrogator/SKILL.md` — FOUND
- `.agents/skills/terrace-spec-compiler/SKILL.md` — FOUND
- `.agents/skills/terrace-test-architect/SKILL.md` — FOUND
- `.agents/skills/terrace-spec-interrogator/fragments/fragment-index.json` — FOUND
- `.agents/skills/terrace-spec-compiler/fragments/fragment-index.json` — FOUND
- `.agents/skills/terrace-test-architect/fragments/fragment-index.json` — FOUND
- `src/lib/fragment-loader.cjs` — FOUND

Commits:
- `75001c1` (Task 1 — three SKILL.md files) — FOUND
- `1c222d0` (Task 2 — fragment indexes, fragments, fragment-loader.cjs) — FOUND
