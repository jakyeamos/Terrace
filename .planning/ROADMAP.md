# Roadmap: Terrace

## Overview

Terrace builds a spec-driven, test-governed AI development framework on top of a GSD fork. The six phases progress from a stable template and CLI foundation, through pre-build governance workflows and agents, to baseline protection enforcement, decision log gating, session continuity, and finally post-build adversarial review. Each phase produces artifacts consumed by the next — no phase can begin until its dependencies are on disk and working.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Templates, CLI scaffold, installation, and enforcement infrastructure
- [ ] **Phase 2: Governance Workflows** - Pre-build governance workflows and interrogation/compiler/architect agents
- [ ] **Phase 3: Baseline Protection** - Baseline builder agent, protect/status CLI, and pre-commit hook
- [ ] **Phase 4: Decision Log Enforcement** - Decision log CLI, spec validate command, and hook enforcement
- [ ] **Phase 5: Session Protocol** - Session start/end CLI, SESSION.md artifacts, and spec hash alerting
- [ ] **Phase 6: Post-Build Governance** - Adversarial review workflow, verifier agent, and regression capture

## Phase Details

### Phase 1: Foundation
**Goal**: The installable skeleton exists — all governance artifact templates are defined, the CLI scaffold runs, and `terrace init` registers agents and installs the pre-commit hook infrastructure
**Depends on**: Nothing (first phase)
**Requirements**: TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05, TMPL-06, TMPL-07, TMPL-08, CLI-07, ENF-02, ENF-03, ENF-04, INST-01, INST-02, INST-03, INST-04
**Success Criteria** (what must be TRUE):
  1. All eight governance artifact templates exist with correct section structure (PRD.md, COMPILED-SPEC.md, TEST-ARCH.md, DECISION-LOG.md, SESSION.md, INVARIANTS.md, ACCEPTANCE-CRITERIA.md, PERMISSIONS-MATRIX.md)
  2. `terrace init` completes without error in a repo that already has GSD configured, registers agent stubs in `~/.claude/settings.json`, and does not modify any existing GSD files
  3. `.terrace/policy.json` exists with documented configurable governance gates and sensible defaults for personal use
  4. `.terrace/baseline-registry.json` schema is defined with required fields (spec_ref, locked_at, policy flags) and validated on read by the CLI
  5. Running `npx node terrace-tools.cjs --help` (or equivalent) shows all stub commands without crashing
**Plans**: TBD

### Phase 2: Governance Workflows
**Goal**: The four pre-build governance workflows are operational — intake, interrogation, spec compilation, and test architecture — each backed by a dedicated agent that can run end-to-end on a real feature request
**Depends on**: Phase 1
**Requirements**: WKFL-01, WKFL-02, WKFL-03, WKFL-04, AGNT-01, AGNT-02, AGNT-03
**Success Criteria** (what must be TRUE):
  1. Running the Intake workflow on a plain-English request produces a `docs/prd/PRD.md` that conforms to the TMPL-01 template structure
  2. Running the Interrogation workflow spawns `terrace-spec-interrogator` and produces at least one round of structured questions targeting goals, permissions, state transitions, edge cases, and failure modes
  3. Running the Spec Compilation workflow spawns `terrace-spec-compiler` and produces `docs/spec/COMPILED-SPEC.md` with YAML frontmatter containing requirement IDs, version, and protected flag
  4. Running the Test Architecture workflow spawns `terrace-test-architect` and produces `docs/testing/TEST-ARCH.md` mapping each SPEC-XX requirement to a test layer with rationale
**Plans**: TBD
**UI hint**: no

### Phase 3: Baseline Protection
**Goal**: Test files can be registered as protected against the spec, the pre-commit hook enforces that protection, and `terrace baseline status` surfaces coverage gaps
**Depends on**: Phase 2
**Requirements**: WKFL-05, AGNT-04, CLI-03, CLI-04, ENF-01
**Success Criteria** (what must be TRUE):
  1. `terrace baseline protect <file> --spec-ref <SPEC-ID>` writes an entry to `.terrace/baseline-registry.json` with the correct schema and refuses files that lack a `spec_ref`
  2. `terrace baseline status` compares the registry against TEST-ARCH.md and prints a gap report identifying protected tests with no spec_ref and TEST-ARCH behaviors with no protected test
  3. Committing a change to a registered protected test file without a matching decision log entry dated today causes the pre-commit hook to block the commit with a descriptive error
  4. The `terrace-baseline-builder` agent runs the Protected Baseline workflow, creates foundational tests, and registers them via `terrace baseline protect`
**Plans**: TBD

### Phase 4: Decision Log Enforcement
**Goal**: Behavioral changes to protected files require a logged decision entry, and `terrace decision log` makes creating compliant entries a one-liner
**Depends on**: Phase 3
**Requirements**: CLI-05, CLI-06
**Success Criteria** (what must be TRUE):
  1. `terrace decision log` creates a new entry in DECISION-LOG.md with `spec_ref` pre-filled from current context, date auto-populated, and all required fields present
  2. `terrace spec validate` reports on COMPILED-SPEC.md completeness (missing required sections, empty fields) and detects at least one class of spec-code drift indicator
  3. A commit that modifies a protected test file is blocked by the hook unless a decision log entry for today references the same `spec_ref` as the protected file's registry entry
**Plans**: TBD

### Phase 5: Session Protocol
**Goal**: Every session starts with a full context snapshot from repo artifacts and ends with a recorded handoff — no reliance on conversational memory
**Depends on**: Phase 1, Phase 3, Phase 4
**Requirements**: CLI-01, CLI-02, SESS-01, SESS-02, SESS-03
**Success Criteria** (what must be TRUE):
  1. `terrace session start` reads the current spec hash and phase, writes a SESSION.md file to `.planning/sessions/` with a complete context snapshot, and prints an alert if the spec hash differs from the hash recorded in the previous session
  2. `terrace session end` appends to the active SESSION.md: decisions made this session, files changed, identified risks, and what the next slice is
  3. SESSION.md files in `.planning/sessions/` are committed to the repo and readable by a cold-start agent that has no prior chat history with the project
**Plans**: TBD

### Phase 6: Post-Build Governance
**Goal**: After each GSD execution phase, the adversarial verifier runs, blocking gaps must be resolved before the phase completes, and any new regressions are captured into the protected baseline
**Depends on**: Phase 3, Phase 4
**Requirements**: WKFL-06, WKFL-07, WKFL-08, AGNT-05
**Success Criteria** (what must be TRUE):
  1. Running the Adversarial Review workflow spawns `terrace-verifier-adversary` and produces a gap list with each gap classified as blocking or non-blocking and mapped to a SPEC-XX requirement
  2. A phase cannot be marked complete while any blocking gap remains unresolved — resolution requires either a regression test, a decision log entry, or promotion to a future phase
  3. Running the Regression Capture workflow adds tests from adversarial review findings to the baseline registry via `terrace baseline protect`, closing the loop between discovered gaps and enforced protection
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/TBD | Not started | - |
| 2. Governance Workflows | 0/TBD | Not started | - |
| 3. Baseline Protection | 0/TBD | Not started | - |
| 4. Decision Log Enforcement | 0/TBD | Not started | - |
| 5. Session Protocol | 0/TBD | Not started | - |
| 6. Post-Build Governance | 0/TBD | Not started | - |
