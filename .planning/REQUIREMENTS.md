# Requirements: Terrace

**Defined:** 2026-04-05
**Core Value:** Every session leaves the repo more legible and less fragile than before — through durable specs, protected tests, and enforced alignment between intent and implementation.

## v1 Requirements

### Templates (Governance Artifacts)

- [ ] **TMPL-01**: PRD.md template exists with standard sections (problem, user roles, desired outcomes, non-goals, constraints)
- [ ] **TMPL-02**: COMPILED-SPEC.md template exists with YAML frontmatter (requirement IDs, version, protected flag) and prose body
- [ ] **TMPL-03**: TEST-ARCH.md template exists with behavior-to-test-layer mapping structure
- [ ] **TMPL-04**: DECISION-LOG.md template exists with spec_ref field, date, rationale, and author fields
- [ ] **TMPL-05**: SESSION.md template exists for recording session start state, changes made, and handoff notes
- [ ] **TMPL-06**: INVARIANTS.md template exists for cataloging system-level truths that must always hold
- [ ] **TMPL-07**: ACCEPTANCE-CRITERIA.md template exists with observable success criteria tied to requirement IDs
- [ ] **TMPL-08**: PERMISSIONS-MATRIX.md template exists for explicitly documenting who can do what

### CLI Tooling (terrace-tools.cjs)

- [ ] **CLI-01**: `terrace session start` reads current spec hash and phase, writes SESSION.md with context snapshot
- [ ] **CLI-02**: `terrace session end` appends to SESSION.md: decisions made, files changed, risks, next slice
- [ ] **CLI-03**: `terrace baseline protect <file> --spec-ref <SPEC-ID>` registers a test file as protected in `.terrace/baseline-registry.json`
- [ ] **CLI-04**: `terrace baseline status` cross-references baseline-registry.json against TEST-ARCH.md and reports coverage gaps
- [ ] **CLI-05**: `terrace decision log` creates a decision log entry with spec_ref pre-filled from current context
- [ ] **CLI-06**: `terrace spec validate` checks COMPILED-SPEC.md completeness and detects spec-code drift indicators
- [ ] **CLI-07**: `terrace init` installs agent definitions, registers skills in `~/.claude/settings.json`, and installs pre-commit hook in current repo

### Enforcement Mechanisms

- [ ] **ENF-01**: Pre-commit hook blocks commits that modify protected test files without a matching decision log entry dated today
- [ ] **ENF-02**: Pre-commit hook is installed automatically by `terrace init` (not optional)
- [ ] **ENF-03**: `.terrace/policy.json` controls which governance gates are active (allows lightweight mode for personal use)
- [ ] **ENF-04**: Baseline registry (`.terrace/baseline-registry.json`) stores protected test paths with spec_ref, locked_at, and policy flags

### Pre-Build Governance Workflows

- [ ] **WKFL-01**: Intake workflow ingests PRD/request, normalizes understanding, creates `docs/prd/PRD.md`
- [ ] **WKFL-02**: Interrogation workflow spawns terrace-spec-interrogator agent to reduce ambiguity through structured question rounds targeting goals, permissions, state transitions, edge cases, failure modes
- [ ] **WKFL-03**: Spec Compilation workflow spawns terrace-spec-compiler agent to produce `docs/spec/COMPILED-SPEC.md` from PRD + interrogation output
- [ ] **WKFL-04**: Test Architecture workflow spawns terrace-test-architect agent to produce `docs/testing/TEST-ARCH.md` mapping each SPEC-XX requirement to a test layer with rationale
- [ ] **WKFL-05**: Protected Baseline workflow spawns terrace-baseline-builder agent to create foundational tests and register them via `terrace baseline protect`

### Post-Build Governance Workflows

- [ ] **WKFL-06**: Adversarial Review workflow spawns terrace-verifier-adversary agent to compare implementation against COMPILED-SPEC.md, produce a gap list with severity (blocking / non-blocking)
- [ ] **WKFL-07**: Adversarial Review workflow enforces that blocking gaps must be resolved (via regression test, decision log entry, or promoted to future phase) before phase is marked complete
- [ ] **WKFL-08**: Regression Capture workflow adds tests from adversarial review findings to baseline via `terrace baseline protect`

### Agent Definitions

- [ ] **AGNT-01**: terrace-spec-interrogator agent — reduces ambiguity through structured question rounds
- [ ] **AGNT-02**: terrace-spec-compiler agent — converts interrogation output + PRD into COMPILED-SPEC.md
- [ ] **AGNT-03**: terrace-test-architect agent — designs test matrix, assigns behaviors to test layers
- [ ] **AGNT-04**: terrace-baseline-builder agent — creates foundational acceptance, invariant, contract, and regression tests
- [ ] **AGNT-05**: terrace-verifier-adversary agent — attacks assumptions, finds gaps, detects spec drift

### Session Protocol

- [ ] **SESS-01**: Session start protocol reads spec hash, current phase, and last decision log entry — alerts if spec hash has changed since last session
- [ ] **SESS-02**: Session end protocol records what changed, what behavioral truth was added/modified, what remains risky, and what the next slice is
- [ ] **SESS-03**: Session artifacts are committed to the repo (`.planning/sessions/` directory)

### Installation and Distribution

- [ ] **INST-01**: Single-step install: `git clone + terrace init` registers all skills and agents
- [ ] **INST-02**: `terrace init` does not break existing projects or GSD configuration
- [ ] **INST-03**: Framework works in Claude Code out of the box after install (skills available as slash commands)
- [ ] **INST-04**: GSD existing functionality is preserved — Terrace extends, does not modify GSD files

## v2 Requirements

### Multi-Platform Support

- **PLAT-01**: Platform adapter layer isolates Claude Code tool primitives from governance workflow logic
- **PLAT-02**: Core governance workflows run in Codex environment
- **PLAT-03**: Core governance workflows run in Cursor environment
- **PLAT-04**: Terrace works with Ollama-based local models

### Distribution

- **DIST-01**: Published as npm package; installable via `npx terrace init`
- **DIST-02**: GitHub Actions workflow for automated release

### Enhanced Enforcement

- **ENF-05**: CI gate checks that spec-sensitive changes updated corresponding spec artifacts
- **ENF-06**: `terrace audit` generates a coverage report: requirements with no test coverage, protected tests with no spec_ref, decisions with no spec_ref

## Out of Scope

| Feature | Reason |
|---------|--------|
| Test runner | Terrace governs what tests must exist; pytest/jest/vitest runs them — language coupling is unacceptable |
| Code generation without spec+test anchors | Exactly what Terrace exists to prevent |
| Project management / ticket tracking | Not a team PM tool; Jira/Linear/GitHub Issues handle this |
| CI/CD pipeline management | Terrace defines which tests belong in which CI gate; it does not manage pipelines |
| Web dashboard / visual UI | v1 is file-based; the repo is the dashboard |
| Automated spec inference from existing code | Produces shallow specs; Terrace specs come from human intent + interrogation |
| Replacing GSD execution layer | GSD plan/execute/verify is solid; Terrace wraps it, doesn't replace it |

## Traceability

*(Populated during roadmap creation)*

| Requirement | Phase | Status |
|-------------|-------|--------|
| TMPL-01 through TMPL-08 | TBD | Pending |
| CLI-01 through CLI-07 | TBD | Pending |
| ENF-01 through ENF-04 | TBD | Pending |
| WKFL-01 through WKFL-08 | TBD | Pending |
| AGNT-01 through AGNT-05 | TBD | Pending |
| SESS-01 through SESS-03 | TBD | Pending |
| INST-01 through INST-04 | TBD | Pending |

**Coverage:**
- v1 requirements: 35 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 35 ⚠️

---
*Requirements defined: 2026-04-05*
*Last updated: 2026-04-05 after initial definition*
