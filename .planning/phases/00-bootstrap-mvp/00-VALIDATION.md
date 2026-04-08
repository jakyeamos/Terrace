---
phase: 0
slug: bootstrap-mvp
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 0 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` — created in plan 00-01 (Wave 1) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds
- **Routing rule:** validate the smallest deterministic slice first; full-suite validation only happens when the changed artifacts or route summary justify it

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 00-01-01 | 01 | 1 | TMPL-01 | — | N/A | unit | `npx vitest run tests/templates.test.ts` | ❌ W0 | ⬜ pending |
| 00-01-02 | 01 | 1 | TMPL-02 | — | N/A | unit | `npx vitest run tests/templates.test.ts` | ❌ W0 | ⬜ pending |
| 00-01-03 | 01 | 1 | TMPL-03 | — | N/A | unit | `npx vitest run tests/templates.test.ts` | ❌ W0 | ⬜ pending |
| 00-01-04 | 01 | 1 | TMPL-04 | — | N/A | unit | `npx vitest run tests/templates.test.ts` | ❌ W0 | ⬜ pending |
| 00-01-05 | 01 | 1 | TMPL-05 | — | N/A | unit | `npx vitest run tests/templates.test.ts` | ❌ W0 | ⬜ pending |
| 00-01-06 | 01 | 1 | TMPL-12 | — | N/A | unit | `npx vitest run tests/init.test.ts` | ❌ W0 | ⬜ pending |
| 00-01-07 | 01 | 1 | TERR-10 | — | N/A | unit | `npx vitest run tests/fixtures.test.ts` | ❌ W0 | ⬜ pending |
| 00-01-08 | 01 | 1 | OPS-08 | — | N/A | integration | `npx vitest run tests/init.test.ts` | ❌ W0 | ⬜ pending |
| 00-02-01 | 02 | 2 | TERR-10 | T-path-01 | Reject `..` in file args | integration | `npx vitest run tests/init.test.ts` | ❌ W0 | ⬜ pending |
| 00-02-02 | 02 | 2 | TMPL-01–05 | — | N/A | unit | `npx vitest run tests/templates.test.ts` | ❌ W0 | ⬜ pending |
| 00-03-01 | 03 | 2 | TERR-11 | T-path-01 | Validate spec_ref; reject path traversal | integration | `npx vitest run tests/validate.test.ts` | ❌ W0 | ⬜ pending |
| 00-03-02 | 03 | 2 | OPS-09 | T-path-01 | Reject `..` in --spec-ref; use explicit execFileSync args array | integration | `npx vitest run tests/baseline.test.ts` | ❌ W0 | ⬜ pending |
| 00-03-03 | 03 | 2 | OPS-09 | — | N/A | integration | `npx vitest run tests/session.test.ts` | ❌ W0 | ⬜ pending |
| 00-04-01 | 04 | 3 | OPS-08 | — | N/A | integration | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` — project root; includes `vitest` as devDependency and `"test": "vitest run"` script
- [ ] `vitest.config.ts` — minimal config with `pool: 'forks'`
- [ ] `tests/init.test.ts` — stubs for D-09, D-05, TMPL-12, OPS-08
- [ ] `tests/validate.test.ts` — stubs for D-10, D-06 (TERR-11 partial)
- [ ] `tests/baseline.test.ts` — stubs for D-11, OPS-09
- [ ] `tests/session.test.ts` — stubs for D-12, OPS-09
- [ ] `tests/templates.test.ts` — stubs for TMPL-01 through TMPL-05
- [ ] `tests/fixtures.test.ts` — stubs for TERR-10
- [ ] `tests/helpers.ts` — shared `runTerrace()` helper and tmpDir utilities
- [ ] Framework install: `npm install` (run after `package.json` created as first task in 00-01)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end run completes on ts-monorepo within MET-ERG-02 time budget | OPS-08 | Time budget validation requires human observation | Run `terrace init && terrace spec validate && terrace baseline protect docs/COMPILED-SPEC.md --spec-ref CS-001 && terrace session start && terrace session end` in fixtures/ts-monorepo and record elapsed time |
| Inspect / classify / usage commands stay low-effort by default | ROUTE-01, EFF-01, EFF-02, USG-01, USG-02 | This is a product-behavior check, not a unit assertion | Confirm diagnostics return concise routing summaries without triggering deep governance passes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
