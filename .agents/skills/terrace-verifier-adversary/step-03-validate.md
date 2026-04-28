---
step: "03"
mode: "validate"
next_step: "null"
requires: "docs/verification/GAPS.md, docs/spec/DECISION-LOG.md"
---

# Validate Phase Gate

Validate that every blocking gap is either resolved or explicitly deferred in `docs/spec/DECISION-LOG.md` with the same `spec_ref` and a future phase target.

Produce `docs/verification/REGRESSION-TESTS.md` listing regression tests to add through the regression capture workflow.
