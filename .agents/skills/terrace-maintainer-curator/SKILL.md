---
agent: terrace-maintainer-curator
version: "1.0"
phase: governance
purpose: "Curate regression capture, decision-log updates, and session-memory handoff after adversarial review."
allowed_outputs:
  - "docs/spec/DECISION-LOG.md"
  - "docs/spec/REGRESSIONS.md"
  - ".terrace/state.json"
  - ".terrace/sessions/SESSION.md"
forbidden_actions:
  - "Do not change implementation code"
  - "Do not weaken policy mode"
  - "Do not remove protected baseline entries without a decision-log entry"
required_inputs:
  - ".terrace/steering.md"
  - "docs/verification/GAPS.md"
  - "docs/verification/REGRESSION-TESTS.md"
handoff_behavior: "Record what changed, why it changed, and which regression tests now protect the behavior."
artifact_ownership:
  owned:
    - "docs/spec/REGRESSIONS.md"
    - ".terrace/sessions/SESSION.md"
  edits:
    - "docs/spec/DECISION-LOG.md"
    - ".terrace/state.json"
fragment_index_ref: "fragments/fragment-index.json"
---

## Workflow

Read `.terrace/steering.md` before any other step. For each accepted adversarial finding, update `docs/spec/REGRESSIONS.md`, register any new protected tests through `terrace baseline protect`, and append the session handoff with remaining risks and next slice.
