# Terrace Product Requirements

## Objective

Make Terrace a credible alternative to GSD for solo and small-team AI-assisted software delivery by closing the most important capability gaps without abandoning Terrace's repo-local, strict-core architecture.

## Product Position

Terrace should not try to win by copying every GSD subsystem. It should become comparable on the workflows that matter most to an engineer evaluating a switch:

- project initialization
- codebase understanding
- roadmap and phase execution
- paused-session recovery
- multi-lane work planning
- release readiness and governance
- operator visibility into progress and blockers

## Comparison Baseline

Baseline comparison target:

- GSD product line: `gsd-2`
- Reference release: `v2.82.0`
- Reference date: `2026-05-10`

Terrace is allowed to differ architecturally, but it must offer a clear answer for each user-facing job that GSD currently handles well.

## Users

- Existing GSD users who want a simpler, repo-local workflow system
- Senior engineers who care about auditability, deterministic gates, and durable artifacts
- AI-assisted developers who need strong context recovery after session loss

## Core Jobs To Be Done

1. Initialize a project or feature from source intent without hand-assembling planning files.
2. Map an unfamiliar codebase and turn that map into planning context.
3. Create and execute roadmap phases with clear blockers, evidence, and next actions.
4. Recover from interrupted sessions without losing the authoritative project state.
5. Split a feature into parallel lanes with ownership, collision risks, and verification commands.
6. Judge ship readiness from one place using tests, docs, reviews, preflight checks, and debt.
7. See current progress and blockers without reading scattered markdown files manually.

## Functional Requirements

### FR-1: New-project parity

Terrace must provide a first-class initialization flow that writes a coherent planning package, not just Terrace governance docs.

Must support:

- project intake from existing PRD text
- explicit project summary and constraints
- generated `.planning/PROJECT.md`
- generated `.planning/REQUIREMENTS.md`
- generated `.planning/ROADMAP.md`
- generated `.planning/STATE.md`
- deterministic next command after initialization

### FR-2: Codebase map parity

Terrace must support brownfield mapping that produces a durable, structured codebase map suitable for future planning and agent handoff.

Must support:

- initial map generation
- refresh semantics for stale maps
- architecture, structure, stack, integrations, testing, conventions, and concerns artifacts
- links from roadmap phases back to codebase findings

### FR-3: Roadmap authoring parity

Terrace must support authoring and maintaining roadmap phases as a first-class workflow instead of treating phases only as migrated artifacts.

Must support:

- phase creation
- phase editing
- phase status transitions
- dependency tracking
- per-phase success criteria
- per-phase risk tags
- relationship between roadmap phases and execution artifacts

### FR-4: Session recovery parity

Terrace must reconstruct interrupted work from state and emitted artifacts well enough that an agent or engineer can continue safely.

Must support:

- paused-session summaries
- blocked human actions
- last known phase and next action
- handoff pack generation
- recovery behavior that prefers state over ambiguous prose

### FR-5: Workstream planning parity

Terrace must plan parallelizable work in a way that is operationally useful, not just descriptive.

Must support:

- lane ownership
- owned files or modules
- coordination points
- verification commands per lane
- explicit parallel vs serial execution markers

### FR-6: Operator visibility parity

Terrace must provide a compact operator surface that answers: what is active, what is blocked, what is next, and what is safe to ship.

Must support:

- project health summary
- current active feature or phase
- blockers and debt
- release readiness summary
- recent sessions and handoffs

CLI-only is acceptable in the first pass if it is compact and action-oriented.

### FR-7: Worktree and execution safety parity

Terrace must offer a safe execution model for parallel or interrupted work.

Must support:

- explicit workstream/worktree planning
- guardrails around shared files and merge-risk areas
- state updates when execution is paused or blocked
- deterministic recovery from stale or incomplete execution artifacts

### FR-8: Review and governance integration

Terrace must unify docs, AI review, test evaluation, preflight, debt, and rule audit into a single coherent release workflow.

Must support:

- blocking and warning severity
- traceable artifact paths
- consistent ship-check consumption
- explicit remediations

## Non-Goals

- Replicating every GSD internal engine or provider abstraction
- Building a rich GUI before the CLI/operator model is coherent
- Adding speculative integrations that do not feed planning or ship-readiness directly

## Success Criteria

- A new user can initialize Terrace planning artifacts in one flow and immediately plan phase 1.
- A brownfield repo can produce a useful codebase map without manual file curation.
- Terrace can author its own roadmap phases without relying on `port gsd`.
- `terrace next`, `resume`, `history`, and handoff flows are sufficient to continue interrupted work.
- Workstream planning is specific enough to drive parallel implementation safely.
- Release readiness consolidates the major engineering gates that currently live across separate commands.

## Priority Order

1. Planning package parity: project init, roadmap authoring, codebase map
2. Recovery and workstream parity
3. Operator visibility
4. Execution safety and worktree coordination
5. Optional UX polish after the workflow model is solid
## QR Remediation Requirements

- [ ] **QR-TERRACE**: Resolve the Quality Runner advisory clusters from run qr-fleet-continue-20260704-terrace for terrace without changing intended behavior, then verify with focused repo checks and a post-remediation QR comparison.
