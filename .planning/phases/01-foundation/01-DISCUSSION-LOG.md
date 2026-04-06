# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-06
**Phase:** 01-foundation
**Mode:** discuss
**Trigger:** Roadmap was significantly revised; Phase 0 (Bootstrap MVP) was added as a new first phase. Existing context and plans no longer fully valid.

---

## What Changed in the Roadmap

- Phase 0 (Bootstrap MVP) introduced as a new first phase — delivers minimal terrace-tools.cjs, 5 source artifact templates, minimal terrace init, and validates on four fixture repos
- Phase 1 now **depends on Phase 0** — extends Phase 0's skeleton rather than building from greenfield
- Phase 1 success criteria updated to require `terrace init` completes on all four Phase 0 fixture repos
- Fixture repos (ts-monorepo, script-repo, no-tests, gsd-modified) are now an explicit integration test surface for Phase 1

## Decisions That Were Invalidated

| Old | Updated |
|-----|---------|
| "Greenfield — no existing source to reuse" | Phase 0 delivers terrace-tools.cjs (minimal) + 5 source templates — Phase 1 extends these |
| terrace-tools.cjs built fresh per gsd-tools pattern | Phase 1 refactors Phase 0's minimal file into command registry, then extends |
| No mention of Phase 0 dependency | Hard dependency added — Phase 1 cannot begin until Phase 0 completes |

## Decisions That Remain Valid (carried forward)

All format/philosophy decisions (machine-precision templates, 500-token steering.md budget, idempotent init with manifest, no GSD dependency, Vitest, TDD) confirmed unchanged.

---

## Areas Discussed

### Phase 0 Handoff Contract
| Question | Answer |
|----------|--------|
| How solid is Phase 0's output? | Phase 0 has no plans yet — only roadmap. Phase 1 treats Phase 0 roadmap deliverables as guaranteed starting state. Phase 0 must complete before Phase 1 begins. |

**Decision:** Phase 1's 01-01 covers only net-new Phase 1 requirements. Phase 0's test suite must remain GREEN throughout Phase 1 execution.

### terrace-tools.cjs Extension
| Question | Answer |
|----------|--------|
| Extend in place vs refactor first? | Refactor then extend |
| Refactor target? | Command registry pattern — central commands map with named handler functions |

**Decision:** 01-03 explicitly refactors Phase 0's minimal file into command registry, then adds Phase 1 commands (doctor, preset install, steering, phase set, full spec validate, extended init). Single file, stdlib only.

### Template Scope for 01-02
| Question | Answer |
|----------|--------|
| Does Phase 1's 01-02 touch Phase 0's 5 source templates? | Yes — Phase 1 brings all 13 to full Phase 1 spec |

**Decision:** 01-02 updates the 5 Phase 0 source templates to full spec AND adds the 8 derived templates. All 13 delivered to final form in one plan.

### Fixture Repo Upgrade Path
| Question | Answer |
|----------|--------|
| What happens when Phase 1's init runs on a Phase 0 fixture repo? | Full re-init with manifest diff |

**Decision:** `terrace init` re-runs full install, reports what would change for existing files, requires `--force` to overwrite. The 5 Phase 0 source templates get updated to full Phase 1 spec when `--force` is used.
