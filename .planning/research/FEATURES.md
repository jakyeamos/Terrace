# Features Research

**Project:** Terrace
**Researched:** 2026-04-05
**Confidence:** HIGH (derived from GSD source, Terrace PRD, AI dev tooling ecosystem analysis)

---

## What AI Development Frameworks Provide

Surveyed: GSD, Aider, Cursor rules/agent mode, Claude Code projects, Cline, Continue.dev, custom CLAUDE.md workflows.

---

## Table Stakes

Features users expect from any serious AI-assisted development framework. Their absence causes abandonment.

### Workflow Structure
- **Phase/task decomposition** — Break work into phases; each phase has a goal, plans, and completion criteria
- **Session continuity** — Next session can resume from where the last one ended without relying on conversational memory
- **Context reconstruction** — Framework can derive current state from repo artifacts (not chat history)
- **Progress visibility** — User can see what's done, what's in progress, what's next at a glance

### Planning Artifacts
- **Structured project document** — Single source of truth for what the project is and why (PROJECT.md equivalent)
- **Requirements tracking** — Requirements have IDs, states (active/validated/dropped), and rationale
- **Decision capture** — Key decisions are recorded with rationale; not buried in chat

### Execution Quality
- **Commit discipline** — Changes are committed atomically with meaningful messages
- **TypeScript/type safety enforcement** — Framework assumes strict mode; doesn't let type drift accumulate
- **Test presence** — Framework acknowledges tests exist and should pass

### Installation / Onboarding
- **Single-command install** — `git clone + init` or equivalent
- **Works in Claude Code out of the box** — Skills/slash commands register without manual YAML editing
- **Doesn't break existing projects** — Can be added to an existing repo without destructive changes

---

## Differentiators

Features that separate high-quality frameworks from adequate ones. Present in the best tools; absent in most.

### Spec Governance (Terrace's Core Innovation)
- **PRD → spec pipeline** — Ambiguity is reduced before any implementation begins; spec is a durable artifact, not a prompt
- **Interrogation loop** — Structured question rounds that surface edge cases, permissions, state transitions, failure modes
- **Acceptance criteria as artifacts** — Success criteria are written down in a file, not implied from the PRD
- **Invariants catalog** — System-level truths that must always hold (documented, not assumed)
- **Permissions matrix** — Who can do what is explicit and auditable

### Test Architecture
- **Test matrix document** — Before code, a document maps each behavior to a test layer (unit/contract/integration/E2E)
- **Protected test policy** — Some tests are designated as behavioral truth anchors; they cannot be casually changed
- **Behavioral coverage over line coverage** — Framework tracks whether behaviors, invariants, and permissions are tested, not just lines
- **Regression as memory** — Every meaningful bug creates a regression test + regressions.md entry

### Change Control
- **Decision log enforcement** — Behavioral changes require a logged decision with rationale + spec reference
- **Spec delta requirement** — Changing a protected test requires a matching spec update
- **Silent behavior change prevention** — Framework detects when implementation drifts from spec without a logged decision

### Cross-Session Alignment
- **Session start protocol** — Every session begins by reading spec artifacts, not relying on memory
- **Session end protocol** — Every session ends by recording what changed, what remains uncertain, and what the next slice is
- **Handoff artifacts** — The repo always contains enough context for a cold-start agent to pick up work correctly

### Agent Role System
- **Distinct named roles** — Spec Interrogator, Spec Compiler, Test Architect, Baseline Builder, Builder, Verifier/Adversary, Maintainer — each with a clear purpose and scope
- **Role isolation** — The builder role does not relax requirements; the reviewer role does not defend the implementation
- **Explicit mode switching** — Framework workflow explicitly changes which agent role is active; no blending

### Multi-Platform Potential (v2 Differentiator)
- **Platform-agnostic workflow core** — Same governance logic runs in Claude Code, Codex, Cursor
- **Thin adapter layer** — Platform differences are isolated; governance logic is unchanged

---

## Anti-Features

Things Terrace should deliberately NOT build. Doing so would hurt quality or scope.

| Anti-Feature | Why Not |
|--------------|---------|
| **Test runner** | Not Terrace's job. Terrace governs what tests exist; pytest/jest/vitest runs them. Adding a test runner couples Terrace to language-specific tooling and balloons scope. |
| **Code generator** | Terrace does not write code without spec + test anchors. "Generate a CRUD API" without a spec is exactly what Terrace exists to prevent. |
| **Project management / tickets** | Not a sprint tracker. Terrace tracks phases and requirements; Jira/Linear/GitHub Issues handle team coordination. |
| **CI/CD pipeline management** | Terrace defines which tests belong in which CI gate; it does not manage the pipeline itself. |
| **Visual dashboard** | A web UI for viewing specs/tests/decisions would be a separate project. v1 is file-based; the repo IS the dashboard. |
| **AI model management** | Terrace doesn't decide which model to use. It delegates model choice to the user's Claude Code config. |
| **Automated spec generation from code** | Inferring specs from existing code produces shallow specs. Terrace generates specs from human intent + interrogation, not reverse-engineering. |

---

## Feature Complexity Assessment

| Feature | Complexity | Phase Dependency |
|---------|------------|------------------|
| Templates (PRD, SPEC, TEST-ARCH, DECISION-LOG, SESSION) | Low | Phase 1 — everything depends on these |
| terrace-tools.cjs CLI scaffold | Low-Medium | Phase 1 |
| Intake workflow | Low | Phase 2 |
| Interrogation workflow + agent | Medium | Phase 2 |
| Spec Compilation workflow + agent | Medium | Phase 2 |
| Test Architecture workflow + agent | Medium | Phase 2 |
| Baseline registry (JSON schema + CLI commands) | Low | Phase 3 |
| Protected Baseline workflow + agent | Medium | Phase 3 |
| Pre-commit hook | Low | Phase 3 |
| Decision log enforcement (CLI + hook extension) | Medium | Phase 4 |
| Session start/end protocol | Low | Phase 5 |
| Adversarial Review workflow + agent | Medium-High | Phase 6 |
| Regression Capture workflow | Low-Medium | Phase 6 |
| Multi-platform adapter layer | High | v2 |
| npm distribution | Low | v2 |

---

## Feature Dependencies

```
Templates ──────────────────────────────────┐
                                             │
terrace-tools.cjs scaffold ──────────────── ▼
                                    Governance workflows
                                    (Intake, Interrogation,
                                     Spec Compilation, Test Arch)
                                             │
                                             ▼
                                    Baseline Protection
                                    (registry, pre-commit hook,
                                     Protected Baseline workflow)
                                             │
                                             ▼
                                    Decision Log Enforcement
                                             │
                                             ▼
                                    Session Protocol
                                             │
                                             ▼
                                    Post-Build Governance
                                    (Adversarial Review,
                                     Regression Capture)
```

GSD execution layer (plan/execute/verify) is inherited and runs in parallel with mid-build phases. It does not depend on governance phases but is constrained by their outputs (spec, test architecture, protected baseline).
