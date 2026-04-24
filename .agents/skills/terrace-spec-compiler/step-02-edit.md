---
step: 2
mode: edit
next_step: step-03-validate.md
requires: "docs/spec/COMPILED-SPEC.md exists"
---

## Step 2: Edit — Apply Spec Deltas

### Fragment Loading
Read `fragments/fragment-index.json`. Load core-tier fragments before editing, then load permissions or state-machine fragments when the delta touches those sections.

### Delta Strategy
Read the existing `docs/spec/COMPILED-SPEC.md`. Apply section-level or requirement-level deltas rather than rewriting unrelated sections. Preserve stable requirement IDs and source references.

### Derived Artifacts
When a requirement changes, update the relevant sections in `docs/spec/INVARIANTS.md`, `docs/spec/PERMISSIONS-MATRIX.md`, and `docs/spec/STATE-MACHINES.md`. Keep unchanged derived sections intact.

### Hash
Recompute the semantic hash after edits and report whether the change is semantic or formatting-only.
