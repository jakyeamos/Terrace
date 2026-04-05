# Terrace

## What This Is

Terrace is a spec-driven, test-governed development framework for AI-assisted projects. It is a fork and evolution of GSD, merging GSD's planning and execution machinery with a governance layer that converts product intent into durable, enforceable truth before any implementation begins. It installs into Claude Code and is designed to eventually be usable across other AI coding environments (Codex, Cursor, Ollama, and others).

## Core Value

Every session leaves the repo more legible and less fragile than before — through durable specs, protected tests, and enforced alignment between intent and implementation.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Spec governance workflow: intake → interrogation → spec compilation → test architecture → protected baseline → vertical-slice implementation → adversarial review → regression capture
- [ ] Pre-build governance phases bolt on before GSD-style execution phases
- [ ] Post-build adversarial review and regression capture phases follow execution
- [ ] Durable artifact set: docs/prd/, docs/spec/, docs/testing/ directory structure with defined file contracts
- [ ] Protected test policy: baseline tests cannot be casually changed — require linked spec delta + decision log entry
- [ ] Decision log enforcement: behavioral changes require logged rationale
- [ ] Session start/end protocol: reconstruct context from repo artifacts, not conversational memory
- [ ] Agent mode system: explicit switching between Spec Interrogator, Spec Compiler, Test Architect, Baseline Test Builder, Builder, Verifier/Adversary, Maintainer roles
- [ ] Multi-platform portability: core workflow designed to be AI-tool-agnostic (platform strategy TBD, v2+)
- [ ] Installable as a framework: can be added to a Claude Code setup the way GSD is installed

### Out of Scope

- Autonomous code generation without spec and test anchors — Terrace enforces governance, not raw generation
- Running tests — that is the repo's own CI/test tooling; Terrace governs what tests must exist, not how they execute
- Project management / ticket tracking / sprint coordination — not a team PM tool
- Replacing GSD — Terrace merges GSD's best structural ideas rather than discarding them
- Multi-platform adapter implementation in v1 — platform portability is a goal but the strategy is undecided; v1 targets Claude Code

## Context

- Built on a GSD fork as the baseline — inherits GSD's phase/plan/execute architecture, skill system, and planning directory conventions
- The governing PRD defines 7 phases (Intake, Interrogation, Spec Compilation, Test Architecture, Protected Baseline, Vertical Slice, Adversarial Review) and 7 explicit agent modes
- Primary motivation: AI-assisted projects naturally drift across sessions; Terrace counters this with spec artifacts, protected tests, and enforced change-control
- Personal use first; open source release is the eventual target
- User regularly works across Claude Code, Codex, Cursor, Ollama — multi-platform portability is a real constraint, not a nice-to-have

## Constraints

- **Baseline**: GSD fork — must retain compatibility with GSD's skill/workflow infrastructure where possible
- **Platform**: v1 targets Claude Code; multi-platform is out of scope until architecture is decided
- **Philosophy**: No meaningful implementation begins until ambiguity is reduced enough that another builder could execute without hidden context
- **Protected tests**: Cannot be weakened to get green CI — must link to spec delta and decision log
- **TypeScript strict mode**: All TypeScript in the framework must use strict mode

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fork GSD as baseline | GSD provides proven phase/plan/execute machinery; rebuilding from scratch adds no value | — Pending |
| Merge governance into GSD, not replace it | GSD's execution strengths + Terrace's spec governance > either alone | — Pending |
| Pre-build + post-build governance phases wrapping GSD execution | "Both" structure preserves GSD's mid-cycle strengths while adding intake and review phases | — Pending |
| Multi-platform strategy deferred to v2 | Platform adapter architecture is unknown; shipping v1 in Claude Code first reduces speculative complexity | — Pending |

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
*Last updated: 2026-04-05 after initialization*
