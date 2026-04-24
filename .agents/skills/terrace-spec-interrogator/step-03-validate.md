---
step: 3
mode: validate
next_step: null
requires: "docs/prd/CLARIFICATIONS.md exists"
---

## Step 3: Validate — Interrogation Completion Check

### Fragment Loading
Read `fragments/fragment-index.json`. Load all core-tier fragments before validation.

### Checklist
Evaluate `docs/prd/CLARIFICATIONS.md` against this checklist:

- [ ] All five question-round topic areas have been addressed or explicitly logged as deferred
- [ ] No assumption entry has status: unresolved without a paired resolution rationale
- [ ] Edge cases cover at least boundary conditions and at least one failure mode

### Pass/Fail Report
Produce an inline pass/fail report. If the result is fail, name exactly which checklist items are incomplete and list the assumption headings that need another edit pass.

### Output
Do not create a new file. Return the validation report in the response and point the next action to `step-02-edit.md` when corrections are needed.
