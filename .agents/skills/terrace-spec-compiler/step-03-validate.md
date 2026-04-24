---
step: 3
mode: validate
next_step: null
requires: "docs/spec/COMPILED-SPEC.md exists"
---

## Step 3: Validate — Spec Completeness and Hash Integrity

### Fragment Loading
Read `fragments/fragment-index.json`. Load core-tier fragments before validation.

### Checklist
- [ ] `docs/spec/COMPILED-SPEC.md` has all required YAML frontmatter fields.
- [ ] `requirements` is non-empty when the PRD names requirement IDs.
- [ ] `source_refs` includes `docs/prd/PRD.md`.
- [ ] Derived artifacts are present when the compiled spec contains invariants, permissions, or state machines.
- [ ] `terrace spec hash --file docs/spec/COMPILED-SPEC.md` returns a 64-character lowercase hex digest.

### Output
Return a pass/fail report inline. If validation fails, name the exact missing field, stale derived artifact, or hash mismatch.
