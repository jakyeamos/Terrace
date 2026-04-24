---
phase: 02-governance-workflows
plan: 04
subsystem: governance
tags: [spec, cli, hash, fragments]
requires:
  - phase: 02-02
    provides: Agent framework and fragment loader
  - phase: 02-03
    provides: CLARIFICATIONS.md interrogation output contract
provides:
  - Spec compiler step chain
  - Semantic spec hash module and CLI command
  - FRAG-07 compiler fragment catalog
affects: [governance-workflows, validation, session-protocol]
tech-stack:
  added: [node:crypto]
  patterns: [semantic document hashing, section-level derived artifact deltas]
key-files:
  created:
    - src/lib/spec-hash.cjs
    - .agents/skills/terrace-spec-compiler/step-01-create.md
    - .agents/skills/terrace-spec-compiler/step-02-edit.md
    - .agents/skills/terrace-spec-compiler/step-03-validate.md
    - .agents/skills/terrace-spec-compiler/fragments/frg-cmp-03-permissions-matrix.md
    - .agents/skills/terrace-spec-compiler/fragments/frg-cmp-04-state-machine.md
  modified:
    - src/terrace-tools.cjs
    - tests/spec-hash.test.ts
    - .agents/skills/terrace-spec-compiler/SKILL.md
    - .agents/skills/terrace-spec-compiler/fragments/fragment-index.json
key-decisions:
  - "computeSpecHash accepts raw content for unit tests and existing file paths for CLI/runtime use."
patterns-established:
  - "Formatting-only spec changes normalize out blank lines, trailing whitespace, comment-only lines, and last_updated."
requirements-completed: [WKFL-04, WKFL-05, OPS-03, OPS-04, FRAG-07]
duration: 8 min
completed: 2026-04-24
---

# Phase 02 Plan 04: Spec Compiler Workflow Summary

**Spec compiler workflow with semantic SHA-256 hashing and FRAG-07 compiler knowledge fragments**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-24T15:17:00Z
- **Completed:** 2026-04-24T15:20:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Added `terrace spec hash --file <path>` with JSON and text output support.
- Added create/edit/validate compiler step files for COMPILED-SPEC.md and derived artifacts.
- Added permissions matrix and state machine fragments to complete FRAG-07.

## Task Commits

1. **Task 1/2: Spec hash and compiler workflow** - `a5eafa2` (feat)

## Files Created/Modified

- `src/lib/spec-hash.cjs` - Semantic spec hashing implementation.
- `src/terrace-tools.cjs` - `spec hash` CLI branch.
- `.agents/skills/terrace-spec-compiler/step-01-create.md` - Create-mode spec compilation instructions.
- `.agents/skills/terrace-spec-compiler/fragments/fragment-index.json` - Four FRAG-07 entries.

## Decisions Made

The hash helper accepts raw content when the input is not an existing path, preserving the existing RED test shape while the CLI path still enforces the repo-root safety guard.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated RED callable test to GREEN contract**
- **Found during:** Task 1
- **Issue:** `tests/spec-hash.test.ts` still expected `MODULE_NOT_FOUND` after the module was implemented.
- **Fix:** Converted the test to assert `computeSpecHash` is callable and added a 64-character CLI digest assertion.
- **Files modified:** `tests/spec-hash.test.ts`
- **Verification:** `pnpm test tests/spec-hash.test.ts tests/workflow-spec-compiler.test.ts tests/json-mode.test.ts`
- **Committed in:** `a5eafa2`

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** Required to complete the TDD GREEN transition from Phase 2 RED stubs.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Test architecture can consume compiled spec artifacts and the session protocol can reuse semantic spec hashes for drift detection.

## Self-Check: PASSED

---
*Phase: 02-governance-workflows*
*Completed: 2026-04-24*
