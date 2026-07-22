# Terrace Roadmap

## Milestone: Terrace becomes a comparable product to GSD

Goal: close the practical workflow gap with GSD while preserving Terrace's strict-core, repo-local architecture.

Definition of comparable:

- A senior engineer can initialize, understand, plan, recover, parallelize, and ship work in Terrace without falling back to GSD for the core workflow.
- Terrace has first-class roadmap authoring and planning artifacts, not just GSD migration compatibility.
- Terrace has a compact operator surface that exposes current truth and next action.

## Phase 1: Planning Package Parity

### Goal

Make Terrace able to create and maintain a full GSD-style planning package for itself.

### Why this phase exists

Terrace currently has `.planning/PROJECT.md` and `.planning/STATE.md`, but it lacks the rest of the planning surface needed to behave like a self-hosted GSD-managed project.

### Deliverables

- First-class `.planning/REQUIREMENTS.md`
- First-class `.planning/ROADMAP.md`
- `.planning/config.json` defaults for parity-driven planning
- Command or workflow support that keeps these artifacts current

### Success Criteria

- Terrace can initialize or refresh its own planning package without manual markdown assembly.
- The planning package captures parity target, scope, and next command.
- New contributors can understand what product parity means from `.planning/` alone.

### Risk Tags

- product
- workflow
- architecture

## Phase 2: Codebase Map First-Class Workflow

### Goal

Turn `terrace map-codebase` into a clear equivalent to `/gsd-map-codebase` for brownfield understanding and agent handoff.

### Why this phase exists

Terrace already has a `map-codebase` command, but the planning layer does not yet use it as a durable prerequisite for roadmap and feature work.

### Deliverables

- `.planning/codebase/STACK.md`
- `.planning/codebase/INTEGRATIONS.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/STRUCTURE.md`
- `.planning/codebase/CONVENTIONS.md`
- `.planning/codebase/TESTING.md`
- `.planning/codebase/CONCERNS.md`
- Refresh semantics and roadmap references back to codebase findings

### Success Criteria

- Brownfield repos can run one command and get a useful codebase briefing.
- Phase plans can cite codebase docs directly.
- Stale maps are detectable and refreshable.

### Risk Tags

- workflow
- docs
- maintainability

## Phase 3: Native Roadmap Authoring

### Goal

Make Terrace able to create, edit, and manage roadmap phases directly instead of only consuming migrated GSD phases.

### Why this phase exists

Right now the roadmap lifecycle is execution-heavy but authoring-light. That blocks Terrace from being a complete planning system.

### Deliverables

- roadmap add/create flow
- roadmap edit flow
- dependency and risk-tag support
- roadmap-to-phase artifact linkage
- deterministic JSON output for roadmap mutations

### Success Criteria

- Users can author new phases without editing markdown by hand.
- A phase can move from creation to execution entirely inside Terrace.
- `terrace next` can route against Terrace-authored phases, not just migrated ones.

### Risk Tags

- workflow
- state
- architecture

## Phase 4: Recovery and Handoff Authority

### Goal

Strengthen interrupted-session recovery until Terrace is trustworthy as the system of record after agent pauses or failures.

### Why this phase exists

GSD’s biggest practical advantage is not just planning breadth; it is runtime continuity under interruption, pause, and recovery.

### Deliverables

- stronger session summaries
- stronger handoff packs
- explicit blocked-action capture
- recovery validation for stale or partial artifacts
- state-first reconstruction path

### Success Criteria

- Interrupted work can be resumed from Terrace state and emitted artifacts.
- Handoff artifacts are compact, specific, and unambiguous.
- Recovery failure modes are detectable instead of silently papered over.

### Risk Tags

- recovery
- workflow
- reliability

## Phase 5: Workstreams and Safe Parallelism

### Goal

Make `terrace workstreams plan` operationally useful for parallel development.

### Why this phase exists

Comparable workflow products need a real answer for “what can run in parallel and what must coordinate.”

### Deliverables

- lane ownership rules
- file or module ownership hints
- explicit coordination points
- verification commands by lane
- serial vs parallel execution markers

### Success Criteria

- Workstreams can be acted on without manual reinterpretation.
- Shared-file collisions and merge-risk areas are surfaced early.
- Handoff creation can consume workstream output.

### Risk Tags

- workflow
- parallelism
- merge-risk

## Phase 6: Operator Surface and Readiness Console

### Goal

Provide a compact operator surface that makes Terrace feel alive and actionable day to day.

### Why this phase exists

GSD currently wins on operational visibility. Terrace needs a compact truth surface even if it remains CLI-first.

### Deliverables

- project status summary command or mode
- active phase or feature summary
- blockers, debt, and review readiness summary
- recent session and handoff summary
- compact ship-readiness rollup

### Success Criteria

- A senior engineer can answer “where are we stuck?” in one command.
- Release blockers are visible without traversing multiple artifact directories.
- The operator surface is small enough to use continuously.

### Risk Tags

- ux
- workflow
- release

## Phase 7: Execution Safety and Worktree Coordination

### Goal

Add the minimum worktree and execution-safety model needed for safe parallel work and pause/recovery flows.

### Why this phase exists

Terrace does not need GSD’s full engine surface, but it does need a clear, deterministic stance on safe execution in multi-lane work.

### Deliverables

- worktree-aware planning metadata
- coordination warnings for shared paths
- pause/resume state transitions tied to execution evidence
- validation of incomplete execution artifacts

### Success Criteria

- Parallel execution can happen without undefined ownership.
- Unsafe shared-path work is flagged before implementation starts.
- Recovery logic understands whether a work item is paused, stale, blocked, or safe to continue.

### Risk Tags

- reliability
- execution
- architecture

## Phase 8: Final Parity Review and Product Positioning

### Goal

Judge whether Terrace is now a credible switch candidate and document the remaining intentional deltas versus GSD.

### Why this phase exists

Parity work is only useful if the product can explain where it matches GSD, where it intentionally differs, and why.

### Deliverables

- parity matrix
- remaining gap register
- migration guidance for GSD users
- product positioning update in README/docs

### Success Criteria

- Terrace can articulate its parity wins and deliberate non-goals.
- A GSD user can evaluate switching without reading source code.
- Remaining gaps are explicit, prioritized, and owned.

### Risk Tags

- product
- adoption
- docs

### Phase 10: QR remediation: terrace



**Goal:** Resolve Quality Runner findings for terrace using cluster-oriented, behavior-preserving remediation from run qr-fleet-continue-20260704-terrace.
**Requirements**: QR-TERRACE
**Depends on:** Phase 9
**Plans:** 2 plans

Plans:
- [ ] 10-01-PLAN.md - Primary QR cluster remediation
- [ ] 10-02-PLAN.md - Additional QR cluster remediation

**Cross-cutting constraints:**
- The post-remediation QR run records no unresolved regression for this plan scope.
