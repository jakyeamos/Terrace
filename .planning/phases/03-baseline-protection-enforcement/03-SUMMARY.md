---
phase: 03-baseline-protection-enforcement
status: complete
completed: 2026-04-28
scope: compact-readiness
requirements-completed: [CLI-03, CLI-04, ENF-01, ENF-03, ENF-04, ENF-05, ENF-06, ENF-07, OPS-05, OPS-06, OPS-07, SEC-05, SEC-07]
key-files:
  created:
    - src/lib/baseline.cjs
    - src/lib/policy.cjs
  modified:
    - src/terrace-tools.cjs
    - tests/roadmap-phase3-6.test.ts
---

# Phase 3 Summary

Baseline protection and local enforcement are now implemented as stdlib CLI/library surfaces.

## Delivered

- `terrace baseline protect <file> --spec-ref <SPEC-ID>` writes `.terrace/baseline-registry.json`.
- `terrace baseline status` reports missing files, missing `spec_ref` entries, unanchored requirements, and conflicts.
- Protected-file enforcement blocks changed protected tests unless `DECISION-LOG.md` contains the same `spec_ref`.
- Policy evaluation supports `lightweight`, `standard`, `strict`, and `recovery`; expired recovery mode reverts to the previous mode.

## Verification

- `npm test -- tests/roadmap-phase3-6.test.ts`
- `npm test`
