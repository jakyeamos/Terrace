---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | vitest.config.ts (Wave 0 installs) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | TMPL-01–13 | — | Templates written atomically, no partial state | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | INST-01–08 | — | Init is idempotent; no GSD file silently modified | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | GSD-01–07 | — | GSD modification recorded; partial patch causes explicit failure | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | SEC-01–07 | — | Trust model enforced; untrusted input rejected | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | VAL-01–05 | — | Spec validate distinguishes blocking vs warning | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | CLI-07,10,12–15 | — | CLI flags parsed correctly; unknown flags rejected | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 2 | LIFE-01–06 | — | Legal transitions enforced; illegal transitions rejected | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 2 | PRST-01–07,12–14 | — | Preset install idempotent; conflicts surfaced not silently overwritten | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 1-03-03 | 03 | 2 | OPS-08–14 | — | Doctor reports missing files and hook conflicts with remediation steps | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/templates.test.ts` — stubs for TMPL-01–13 template structure
- [ ] `tests/schemas.test.ts` — stubs for GSD-01–07 modification policy and schema validation
- [ ] `tests/init.test.ts` — stubs for INST-01–08 idempotent init
- [ ] `tests/validate.test.ts` — stubs for VAL-01–05 spec validation
- [ ] `tests/lifecycle.test.ts` — stubs for LIFE-01–06 phase transitions
- [ ] `tests/preset.test.ts` — stubs for PRST-01–07,12–14 preset registry
- [ ] `tests/doctor.test.ts` — stubs for OPS-08–14 diagnostics
- [ ] `tests/json-mode.test.ts` — stubs for CLI-07,10,12–15 flag parsing and JSON output
- [ ] `vitest.config.ts` — framework config
- [ ] `package.json` — vitest dependency and test script

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `terrace init` in clean repo completes without error | INST-01 | Requires real filesystem and subprocess | Run `mkdir /tmp/test-repo && cd /tmp/test-repo && git init && terrace init` and confirm exit 0 and expected files |
| `terrace init` in repo with existing GSD config reports changes | INST-04 | Requires real GSD config presence | Create a GSD .planning dir, run `terrace init`, confirm output lists what was created/changed without modifying GSD files |
| `terrace steering` opens/creates steering.md | PRST-07 | Requires $EDITOR or file open | Run `terrace steering` and confirm `.terrace/steering.md` exists with constitution template |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
