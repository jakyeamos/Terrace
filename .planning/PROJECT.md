# Terrace

## What This Is

Terrace is an automatic effort router with built-in usage intelligence for AI-assisted projects. It is a fork and evolution of GSD, hardening GSD's planning and execution machinery with a governance layer that chooses the cheapest safe path automatically, then escalates only when drift, ambiguity, or risk justify the cost. It installs into Claude Code and is designed to eventually be usable across other AI coding environments (Codex, Cursor, Ollama, and others).

## Core Value

Every session leaves the repo more legible and less fragile than before, while spending the minimum effort necessary to stay aligned — through durable specs, protected tests, selective governance, and enforced alignment between intent and implementation.

## Requirements

### Validated

- [x] Durable artifact set: `docs/prd/`, `docs/spec/`, `docs/testing/`, `.terrace/`, and `.planning/sessions/` are created and validated by the CLI
- [x] Spec governance workflow scaffold: intake, interrogation, spec compilation, test architecture, protected baseline, adversarial review, regression capture, and handoff roles exist
- [x] Protected test policy: baseline tests require a linked `spec_ref` and a matching decision-log entry before protected changes are allowed
- [x] Decision log enforcement: behavioral changes can be recorded with `terrace decision log --spec-ref <SPEC-ID>`
- [x] Session start/end protocol: context can be reconstructed from repo artifacts through `terrace session reconstruct`
- [x] Built-in preset registry: `terrace-tea`, `terrace-mutation`, `terrace-ui`, and `terrace-security` install through the preset registry

### Active

- [ ] Automatic task classification: Terrace routes each command to the cheapest safe effort band by default
- [ ] Local analyzer first: deterministic preprocessing handles diffing, registry checks, freshness, and impacted-artifact detection before model escalation
- [ ] Full fixture matrix hardening for every governance command across all four fixture repos
- [ ] Deep governance passes are trigger-based, not default
- [ ] Explore / inspect / understand commands are hard-capped at low effort unless explicitly escalated
- [ ] `/terrace-usage` and `/terrace-why` expose routing cost and rationale on demand
- [ ] Agent mode system hardening: explicit runtime switching between Spec Interrogator, Spec Compiler, Test Architect, Baseline Test Builder, Builder, Verifier/Adversary, Maintainer roles
- [ ] Multi-platform portability: core workflow designed to be AI-tool-agnostic (platform strategy TBD, v2+)
- [ ] Installable as a framework: can be added to a Claude Code setup the way GSD is installed

### Out of Scope

- Autonomous code generation without spec and test anchors — Terrace enforces governance, not raw generation
- Running tests — that is the repo's own CI/test tooling; Terrace governs what tests must exist, not how they execute
- Project management / ticket tracking / sprint coordination — not a team PM tool
- Replacing GSD — Terrace merges GSD's best structural ideas rather than discarding them
- Multi-platform adapter implementation in v1 — platform portability is a goal but the strategy is undecided; v1 targets Claude Code
- Manual lite / standard / deep mode selection as the normal UX — routing is automatic-first

## Context

- Built on a GSD fork as the baseline — inherits GSD's phase/plan/execute architecture, skill system, and planning directory conventions
- The governing PRD defines 7 phases (Intake, Interrogation, Spec Compilation, Test Architecture, Protected Baseline, Vertical Slice, Adversarial Review) and 7 explicit agent modes, but Terrace routes most work automatically before those deeper steps fire
- Primary motivation: AI-assisted projects naturally drift across sessions; Terrace counters this with spec artifacts, protected tests, enforced change-control, and effort ceilings that avoid wasting tokens on routine work
- Personal use first; open source release is the eventual target
- User regularly works across Claude Code, Codex, Cursor, Ollama — multi-platform portability is a real constraint, not a nice-to-have

## Constraints

- **Baseline**: GSD fork — must retain compatibility with GSD's skill/workflow infrastructure where possible
- **Platform**: v1 targets Claude Code; multi-platform is out of scope until architecture is decided
- **Philosophy**: No meaningful implementation begins until ambiguity is reduced enough that another builder could execute without hidden context, but Terrace should spend the minimum effort required to get there
- **TDD**: Terrace is built test-first — no production code is written without a prior failing test; for multi-phase execution this is enforced as phase-delta RED first while prior-phase baseline tests remain green unless intentionally changed
- **Protected tests**: Cannot be weakened to get green CI — must link to spec delta and decision log
- **TypeScript strict mode**: All TypeScript in the framework must use strict mode
- **Routing**: Explore-class commands and inspection flows default to low effort; higher effort requires a trigger, not a preference

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fork GSD as baseline | GSD provides proven phase/plan/execute machinery; rebuilding from scratch adds no value | — Pending |
| Merge governance into GSD, not replace it | GSD's execution strengths + Terrace's selective governance > either alone | — Pending |
| Automatic effort routing over manual mode selection | Users should not have to think in lite / standard / deep terms; Terrace should infer the cheapest safe path | — Pending |
| Deterministic local analysis before model escalation | Diffing, registry checks, freshness, and impacted-artifact detection should happen locally first | — Pending |
| Pre-build + post-build governance passes are trigger-based | "Both" structure still exists, but deep passes only fire when signals justify them | — Pending |
| Multi-platform strategy deferred to v2 | Platform adapter architecture is unknown; shipping v1 in Claude Code first reduces speculative complexity | — Pending |
| TDD for all Terrace development | Terrace enforces test-first governance on target repos — it must hold itself to the same standard; eat your own dog food | — Active |
| Phases 3-6 completed as compact readiness slice | The remaining roadmap needed a usable local framework surface more than historical per-plan ceremony | — Active |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition` or equivalent):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone` or equivalent):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-28 after roadmap readiness implementation*
