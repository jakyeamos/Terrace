---
step: 3
mode: validate
next_step: null
requires: "docs/testing/TEST-ARCH.md exists"
---

## Step 3: Validate — Test Architecture Completeness

### Fragment Loading
Read `fragments/fragment-index.json`. Load core-tier fragments before validation.

### Checklist
- [ ] Every compiled requirement has a test architecture entry.
- [ ] Every entry has `test_layer`, `risk_score`, `ci_tier`, and rationale.
- [ ] No auth, permissions, money flow, data loss, or schema-change requirement is below p0.
- [ ] p0 and p1 entries use `ci_tier: pre-merge`.
- [ ] p2 entries use `ci_tier: post-merge` or `ci_tier: nightly`.
- [ ] p3 entries use `ci_tier: local-only`.

### Output
Return a pass/fail report inline and name every requirement with missing or unsafe coverage.
