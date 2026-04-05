# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-05
**Phase:** 01-foundation
**Mode:** discuss
**Areas discussed:** Template depth, terrace init + GSD wiring, steering.md structure, Test framework

## Gray Areas Presented

| Area | Question | Options offered |
|------|----------|-----------------|
| Template depth | How detailed should the 13 governance artifact templates be? | Rich guides, Minimal stubs, Tiered |
| terrace init + GSD | What should init do with existing GSD config? | Active wiring, Passive install, Detect + report |
| steering.md structure | What constitutes the project constitution template? | Structured markdown, YAML + freeform, Kiro-style layers |
| Test framework | What test framework for Terrace's own code? | node:test, Vitest, Jest |

## Decisions Made

### Template depth
- **Selected:** Rich guides
- **Correction:** User clarified: templates must optimize for machine precision and token efficiency, not human readability. "Rich" means comprehensive structured coverage, not verbose prose.
- **Outcome D-01–D-03:** YAML frontmatter + terse directives. All 13 templates receive equal treatment.

### terrace init + GSD wiring
- **Selected:** (none — user provided freeform correction)
- **User correction:** "Terrace is its own thing — we are using GSD source code as reference. Update whatever documents you need to in order to make that be known."
- **Outcome D-06–D-10:** `terrace init` is self-contained. GSD-01–07 requirements become a `docs/architecture/GSD-PATTERNS.md` documenting adopted patterns. No live GSD dependency or wiring.

### steering.md structure
- **Selected:** Kiro-style layered rules (closest to stated preference)
- **Correction:** User wants machine precision + token optimization over human readability.
- **Outcome D-04–D-05:** YAML frontmatter + terse one-line directive sections. Hard budget: under 500 tokens in the template.

### Test framework
- **Selected:** Vitest
- **Outcome D-16–D-17:** Vitest as dev dependency for all Terrace tests. TDD mandate non-negotiable.

## Corrections Applied

| Area | Original assumption | User correction |
|------|--------------------|-----------------| 
| GSD wiring | Terrace is a GSD extension/plugin | Terrace is standalone; GSD is source reference only |
| Template format | Rich = human-readable guidance | Rich = machine precision + token efficiency |

## Deferred
- Live GSD integration — explicitly out of scope per user correction
- Human-readable template docs — deprioritized in favor of machine precision
