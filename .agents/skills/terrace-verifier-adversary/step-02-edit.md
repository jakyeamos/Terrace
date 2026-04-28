---
step: "02"
mode: "edit"
next_step: "step-03-validate.md"
requires: "docs/verification/GAPS.md"
---

# Refine Gap Classification

Review each gap for duplicate findings, unsupported evidence, and missing `spec_ref` values. Merge duplicate gaps only when the same requirement and same failure mode are involved.

Non-blocking gaps must include a future target or a decision-log requirement. Blocking gaps must include a concrete remediation and regression test.
