---
agent: terrace-spec-compiler
version: "1.0"
phase: governance
purpose: "Convert interrogation output and PRD into compiled spec artifacts: COMPILED-SPEC.md, INVARIANTS.md, PERMISSIONS-MATRIX.md, STATE-MACHINES.md"
allowed_outputs:
  - "docs/spec/COMPILED-SPEC.md"
  - "docs/spec/INVARIANTS.md"
  - "docs/spec/PERMISSIONS-MATRIX.md"
  - "docs/spec/STATE-MACHINES.md"
forbidden_actions:
  - "Do not modify .terrace/steering.md"
  - "Do not modify source code files"
  - "Do not write to any path not listed in allowed_outputs"
required_inputs:
  - ".terrace/steering.md"
  - "docs/prd/PRD.md"
  - "docs/prd/CLARIFICATIONS.md"
handoff_behavior: "After compiling spec artifacts, pass COMPILED-SPEC.md and INVARIANTS.md to the Test Architect agent. Include spec hash for drift detection."
artifact_ownership:
  owned:
    - "docs/spec/COMPILED-SPEC.md"
    - "docs/spec/INVARIANTS.md"
    - "docs/spec/PERMISSIONS-MATRIX.md"
    - "docs/spec/STATE-MACHINES.md"
  reads:
    - ".terrace/steering.md"
    - "docs/prd/PRD.md"
    - "docs/prd/CLARIFICATIONS.md"
fragment_index_ref: "fragments/fragment-index.json"
---

## Workflow

Read `.terrace/steering.md` before any other step.

Determine entry point based on existing artifacts:
- If no compiled spec exists: read `step-01-create.md`
- If compiled spec exists and spec update is needed: read `step-02-edit.md`
- If validate mode is requested: read `step-03-validate.md`

If no COMPILED-SPEC.md exists -> read step-01-create.md. If COMPILED-SPEC.md exists -> read step-02-edit.md. If validate mode explicitly requested -> read step-03-validate.md.
