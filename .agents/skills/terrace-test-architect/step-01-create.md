---
step: 1
mode: create
next_step: step-02-edit.md
requires: "docs/spec/COMPILED-SPEC.md exists"
---

## Step 1: Create — Test Architecture

### Fragment Loading
Read `fragments/fragment-index.json`. Load core-tier fragments before proceeding.

### Requirement Mapping
Read `docs/spec/COMPILED-SPEC.md` and map every requirement to `docs/testing/TEST-ARCH.md`. For each requirement, assign `test_layer` (`unit`, `integration`, `contract`, `e2e`, or `manual`), `risk_score` (`p0`, `p1`, `p2`, `p3`), `ci_tier`, and one-sentence rationale.

### Risk Scoring
Use P0-P3 risk scoring:
- p0: auth, permissions, money flow, data loss, schema changes, protected baseline behavior
- p1: core behavior, state machines, invariants, primary happy paths
- p2: secondary behavior, non-critical edge cases, performance-sensitive checks
- p3: opportunistic local checks, exploratory tests, low-value paths

### CI Tier Assignment
Assign `ci_tier` conservatively:
- p0 -> pre-merge
- p1 -> pre-merge
- p2 -> post-merge or nightly
- p3 -> local-only

### Output
Write `docs/testing/TEST-ARCH.md`. Add `docs/testing/COVERAGE-PLAN.md` only when the compiled spec names enough requirements to plan coverage by phase.
