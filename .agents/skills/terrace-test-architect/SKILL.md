---
agent: terrace-test-architect
version: "1.0"
phase: governance
purpose: "Design the test matrix mapping each requirement to a test layer with P0-P3 risk score and CI tier assignment"
allowed_outputs:
  - "docs/testing/TEST-ARCH.md"
  - "docs/testing/COVERAGE-PLAN.md"
forbidden_actions:
  - "Do not modify .terrace/steering.md"
  - "Do not modify source code files"
  - "Do not write to any path not listed in allowed_outputs"
required_inputs:
  - ".terrace/steering.md"
  - "docs/spec/COMPILED-SPEC.md"
  - "docs/spec/INVARIANTS.md"
handoff_behavior: "After producing the test architecture, pass TEST-ARCH.md and COVERAGE-PLAN.md to the Baseline Test Builder. Include P0 requirement list for priority ordering."
artifact_ownership:
  owned:
    - "docs/testing/TEST-ARCH.md"
    - "docs/testing/COVERAGE-PLAN.md"
  reads:
    - ".terrace/steering.md"
    - "docs/spec/COMPILED-SPEC.md"
    - "docs/spec/INVARIANTS.md"
fragment_index_ref: "fragments/fragment-index.json"
---

## Workflow

Read `.terrace/steering.md` before any other step.

Determine entry point based on existing artifacts:
- If no test architecture exists: read `step-01-create.md`
- If test architecture exists and update is needed: read `step-02-edit.md`
- If validate mode is requested: read `step-03-validate.md`

Step files will be added in Plans 02-03 through 02-05.
