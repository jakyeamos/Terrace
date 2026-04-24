---
agent: terrace-verifier-adversary
version: "0.1"
phase: governance
purpose: "Phase 6 stub for adversarial review: compare implementation against compiled spec, classify gaps, and identify regression-test needs."
allowed_outputs:
  - "docs/verification/GAPS.md"
  - "docs/verification/REGRESSION-TESTS.md"
forbidden_actions:
  - "Do not modify source code files"
  - "Do not modify .terrace/steering.md"
  - "Do not write outside docs/verification"
required_inputs:
  - ".terrace/steering.md"
  - "docs/spec/COMPILED-SPEC.md"
  - "docs/testing/TEST-ARCH.md"
handoff_behavior: "Return blocking and non-blocking gaps with evidence and recommended regression tests."
artifact_ownership:
  owned:
    - "docs/verification/GAPS.md"
    - "docs/verification/REGRESSION-TESTS.md"
  reads:
    - ".terrace/steering.md"
    - "docs/spec/COMPILED-SPEC.md"
    - "docs/testing/TEST-ARCH.md"
fragment_index_ref: "fragments/fragment-index.json"
---

## Workflow

# Phase 6 stub — full implementation in terrace-verifier-adversary Phase 6 plan

Read `.terrace/steering.md` before any other step. For Phase 2, this agent exists only to reserve the AGNT-07 contract and FRAG-09 fragment catalog. Do not perform full adversarial review until the Phase 6 plan implements the workflow.
