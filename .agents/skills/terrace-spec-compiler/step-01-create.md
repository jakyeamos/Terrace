---
step: 1
mode: create
next_step: step-02-edit.md
requires: "docs/prd/PRD.md and docs/prd/CLARIFICATIONS.md exist"
---

## Step 1: Create — Compile Governance Spec

### Fragment Loading
Read `fragments/fragment-index.json`. Load core-tier fragments before proceeding.

### Inputs
Read `.terrace/steering.md`, `docs/prd/PRD.md`, and `docs/prd/CLARIFICATIONS.md` if it exists. Preserve unresolved assumptions as explicit risks instead of silently resolving them.

### Outputs
Produce `docs/spec/COMPILED-SPEC.md` with YAML frontmatter containing `spec_version`, `project`, `phase`, `requirements`, `protected`, `last_updated`, and `source_refs`.

Also derive these section-level artifacts when relevant:

- `docs/spec/INVARIANTS.md`
- `docs/spec/PERMISSIONS-MATRIX.md`
- `docs/spec/STATE-MACHINES.md`

### Hash
After writing the compiled spec, compute the semantic spec hash with `terrace spec hash --file docs/spec/COMPILED-SPEC.md` and record it in the response for drift detection.
