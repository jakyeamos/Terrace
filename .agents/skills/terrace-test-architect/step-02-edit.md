---
step: 2
mode: edit
next_step: step-03-validate.md
requires: "docs/testing/TEST-ARCH.md exists"
---

## Step 2: Edit — Update Test Architecture

### Fragment Loading
Read `fragments/fragment-index.json`. Load core-tier fragments first, then load fixture or CI tier fragments when the delta touches fixture design or pipeline placement.

### Delta Review
Compare `docs/spec/COMPILED-SPEC.md` against existing `docs/testing/TEST-ARCH.md`. Add, remove, or update only entries tied to changed requirements.

### Risk Review
Re-evaluate p0, p1, p2, and p3 assignments whenever a requirement touches auth, permissions, money flow, data loss, state machines, invariants, or schema changes. Update `ci_tier` with the same conservative mapping used in Create mode.

### Output
Update `docs/testing/TEST-ARCH.md` in place and preserve rationale for unchanged entries.
