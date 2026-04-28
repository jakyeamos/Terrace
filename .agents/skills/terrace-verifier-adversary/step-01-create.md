---
step: "01"
mode: "create"
next_step: "step-02-edit.md"
requires: ".terrace/steering.md, docs/spec/COMPILED-SPEC.md, docs/testing/TEST-ARCH.md"
---

# Create Adversarial Review

Read `.terrace/steering.md` first, then load the core verifier fragments. Compare the current implementation and test architecture against `docs/spec/COMPILED-SPEC.md`.

Create `docs/verification/GAPS.md` with one row per gap:

- `gap_id`
- `spec_ref`
- `severity` (`blocking` or `non_blocking`)
- `evidence`
- `required_resolution`
- `regression_test`

Any missing protected behavior, stale spec-sensitive artifact, deleted baseline anchor, or untested P0/P1 behavior is `blocking`.
