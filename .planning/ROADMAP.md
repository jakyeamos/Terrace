# Roadmap: Terrace

## Overview

Terrace builds a spec-driven, test-governed AI development framework on top of a GSD fork. The six phases progress from a stable template and CLI foundation (including the preset system and steering constitution), through pre-build governance workflows and agents with tiered knowledge fragments, to baseline protection enforcement, decision log and CI gating, session continuity with lifecycle control, and finally post-build adversarial review with self-test hardening. Each phase produces artifacts consumed by the next — no phase can begin until its dependencies are on disk and working.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Templates, CLI scaffold, install infrastructure, lifecycle schema, GSD integration policy, and security model
- [ ] **Phase 2: Governance Workflows** - Intake through test architecture workflows and corresponding agents
- [ ] **Phase 3: Baseline Protection & Enforcement** - Baseline builder agent, protect/status CLI, pre-commit hook, and local enforcement policy
- [ ] **Phase 4: Decision Log, Audit & CI** - Decision log CLI, spec validate, audit command, and CI enforcement gates
- [ ] **Phase 5: Session Protocol & Lifecycle** - Session start/end CLI, SESSION.md artifacts, spec hash alerting, and phase transitions
- [ ] **Phase 6: Post-Build Governance & Self-Test** - Adversarial review, regression capture, Terrace self-tests, versioning, and migration

## Development Approach

Terrace is built test-first. Every plan in every phase writes tests before writing implementation code — no production code is committed without a prior failing test. This is non-negotiable: the framework must govern itself by the same principles it enforces on target repos.

**In practice:**
- Each plan begins with test stubs or acceptance tests derived from the phase success criteria
- Implementation proceeds only after a failing test exists for the behavior being built
- A plan is not complete until all tests pass and no implementation exists without a corresponding test

## Phase Details

### Phase 1: Foundation
**Goal**: The installable skeleton exists — all governance artifact templates are defined (including `steering.md`), the CLI scaffold runs, the preset registry infrastructure is in place, the lifecycle schema is machine-readable, the GSD modification policy is established, the security trust model is documented, and `terrace init` completes cleanly in a target repo
**Depends on**: Nothing (first phase)
**Requirements**: TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05, TMPL-06, TMPL-07, TMPL-08, TMPL-09, TMPL-10, TMPL-11, TMPL-12, TMPL-13, VAL-01, VAL-02, VAL-03, VAL-04, VAL-05, CLI-07, CLI-10, CLI-12, CLI-13, CLI-14, CLI-15, INST-01, INST-02, INST-03, INST-04, INST-05, INST-06, INST-07, INST-08, GSD-01, GSD-02, GSD-03, GSD-04, GSD-05, GSD-06, GSD-07, SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07, LIFE-01, LIFE-02, LIFE-03, LIFE-04, LIFE-05, LIFE-06, PRST-01, PRST-02, PRST-03, PRST-04, PRST-05, PRST-06, PRST-07, PRST-12, PRST-13, PRST-14, OPS-08, OPS-09, OPS-10, OPS-11, OPS-12, OPS-13, OPS-14
**Success Criteria** (what must be TRUE):
  1. All thirteen governance artifact templates exist on disk with correct section and schema structure — PRD.md, COMPILED-SPEC.md, TEST-ARCH.md, DECISION-LOG.md, SESSION.md, INVARIANTS.md, ACCEPTANCE-CRITERIA.md, PERMISSIONS-MATRIX.md, EDGE-CASES.md, STATE-MACHINES.md, REGRESSIONS.md, project-state.json, and steering.md
  2. `terrace init` completes without error in a clean repo and in a repo with preexisting GSD configuration, installs Terrace artifacts, does not modify existing GSD files silently, and reports exactly what was created or changed
  3. `.terrace/project-state.json` exists with current phase, spec hash, active slice, last session, and policy mode, and `terrace phase set <phase>` updates the value after validating the transition is legal
  4. `terrace spec validate` runs against all governance artifacts and distinguishes blocking errors from warnings, and `terrace doctor` diagnoses broken installs, missing files, and hook conflicts with explicit remediation steps
  5. The security and GSD-integration constraints are encoded in config or documentation: Terrace lists what files it may touch, modifications to GSD files are recorded, and any GSD file that cannot be safely patched causes an explicit failure with remediation guidance rather than silent partial corruption
  6. `.terrace/presets/registry.json` exists with the correct schema, `terrace preset install` is idempotent and surfaces conflicts rather than silently overwriting, and `terrace steering` opens or creates `.terrace/steering.md` with the project constitution template
**Plans**: 6 plans

Plans:
- [ ] 01-01-PLAN.md — Project scaffold and RED test stubs for all Phase 1 requirements (Wave 1, TDD)
- [ ] 01-02-PLAN.md — All 12 Markdown governance artifact templates and 2 JSON schemas (Wave 2)
- [ ] 01-03-PLAN.md — CLI entry point, shared core utilities, and terrace init implementation (Wave 2)
- [ ] 01-04-PLAN.md — GSD pattern documentation, security model, and terrace doctor diagnostics (Wave 2)
- [ ] 01-05-PLAN.md — Phase lifecycle validator and preset registry manager (Wave 3)
- [ ] 01-06-PLAN.md — Spec validate module and full-suite GREEN verification (Wave 3)

### Phase 2: Governance Workflows
**Goal**: The four pre-build governance workflows are operational — intake, interrogation, spec compilation, and test architecture — each using tri-modal architecture (Create/Edit/Validate) with step-file chaining, backed by a dedicated agent that loads tiered knowledge fragments and can run end-to-end on a real feature request, with unresolved assumptions and fast-mode paths explicitly handled
**Depends on**: Phase 1
**Requirements**: WKFL-01, WKFL-02, WKFL-02a, WKFL-02b, WKFL-02c, WKFL-03, WKFL-04, WKFL-05, AGNT-01, AGNT-02, AGNT-07, AGNT-08, FRAG-01, FRAG-02, FRAG-03, FRAG-04, FRAG-05, FRAG-06, FRAG-07, FRAG-08, FRAG-09, OPS-01, OPS-02, OPS-03, OPS-04
**Success Criteria** (what must be TRUE):
  1. Running the Intake workflow on a plain-English request produces a `docs/prd/PRD.md` that conforms to the TMPL-01 template; when no PRD exists at all, Terrace can start from a user request and create a provisional PRD
  2. Running the Interrogation workflow uses tri-modal architecture (Create/Edit/Validate) with step-file chaining — spawns `terrace-spec-interrogator` via sequential step files, each naming the next; when the user declines interrogation, a logged fast-mode assumption path is available
  3. Running the Spec Compilation workflow spawns `terrace-spec-compiler` and produces `docs/spec/COMPILED-SPEC.md` with YAML frontmatter containing spec_version, project, phase, requirements, protected, last_updated, and source_refs; it also updates invariants, permissions matrix, and state-machine artifacts when relevant
  4. Formatting-only changes to spec artifacts do not trigger behavioral drift warnings, and spec hash computation excludes configured non-semantic changes
  5. Every agent definition includes purpose, allowed outputs, forbidden actions, required inputs, handoff behavior, artifact ownership, and a fragment index reference; every agent loads `.terrace/steering.md` as the first context item before any workflow step
  6. Each governance agent has a `fragment-index.json` cataloguing core/extended/specialized fragments; `core` fragments load unconditionally, `extended` and `specialized` fragments load conditionally by phase or config flag; fragment conditional loading reduces agent context size by at least 40% vs loading all fragments
**Plans**: TBD

### Phase 3: Baseline Protection & Enforcement
**Goal**: Test files can be registered as protected against the spec, the pre-commit hook enforces that protection locally, `terrace baseline status` surfaces coverage gaps, and renamed or deleted protected files produce blocking warnings rather than silent breakage
**Depends on**: Phase 2
**Requirements**: WKFL-06, WKFL-07, WKFL-08, AGNT-03, AGNT-04, CLI-03, CLI-04, ENF-01, ENF-02, ENF-03, ENF-04, ENF-05, ENF-06, ENF-07, OPS-05, OPS-06, OPS-07
**Success Criteria** (what must be TRUE):
  1. `terrace baseline protect <file> --spec-ref <SPEC-ID>` writes an entry to `.terrace/baseline-registry.json` with spec_ref, locked_at, policy_flags, and optional severity, and refuses registration without a valid spec_ref
  2. `terrace baseline status` cross-references the registry against TEST-ARCH.md and prints a gap report identifying protected tests with no spec_ref, requirements lacking a protected anchor, and registered files missing from disk
  3. Committing a change to a registered protected test file without a matching decision log entry causes the pre-commit hook to block the commit with an error message that names exactly what is missing and how to resolve it
  4. `.terrace/policy.json` controls which enforcement gates are active, supports at least strict/standard/lightweight modes, and is installed by `terrace init` with sensible defaults
  5. If a protected file is renamed, the registry surfaces a blocking warning; if deleted, phase completion is blocked until the file is replaced, deregistered with rationale, or explicitly deferred; if two files claim the same exclusive anchor, Terrace surfaces a conflict
**Plans**: TBD

### Phase 4: Decision Log, Audit & CI
**Goal**: Behavioral changes to protected files require a logged decision entry with explicit rationale, `terrace audit` generates a governance health report, and CI enforcement gates can run independently of local hook presence
**Depends on**: Phase 3
**Requirements**: CLI-05, CLI-06, CLI-08, ENF-08, ENF-09, ENF-10, ENF-11, ENF-12, ENF-13, ENF-14, MET-01, MET-02, MET-03, MET-04, MET-05, MET-06, MET-07, MET-08, MET-09, MET-10, MET-11, MET-12
**Success Criteria** (what must be TRUE):
  1. `terrace decision log` creates a new entry in DECISION-LOG.md with spec_ref pre-filled from current context, date auto-populated, and all required TMPL-04 fields present; a protected-test commit is blocked unless the entry explicitly references the same spec_ref as the protected file
  2. `terrace spec validate` detects missing requirement references, missing spec_refs, missing protected-test metadata, and artifact freshness issues; enforcement warnings name exactly what is missing and how to resolve it
  3. `terrace audit` generates a coverage report that surfaces requirements with no test coverage, protected tests with no spec_ref, decision-log entries with no spec_ref, and stale session/spec state
  4. CI enforcement checks that spec-sensitive changes updated corresponding artifacts, checks protected registry integrity, and runs independently of whether a local pre-commit hook is installed
  5. Developers can intentionally defer a blocking issue only through the explicit decision-log workflow; policy modes cannot silently disable critical protections without recorded config
**Plans**: TBD

### Phase 5: Session Protocol & Lifecycle
**Goal**: Every session starts with a full context snapshot from repo artifacts and ends with a recorded handoff, phase transitions are validated and recorded, and the framework can reconstruct project state from repo artifacts with no prior chat history
**Depends on**: Phase 1, Phase 3, Phase 4
**Requirements**: CLI-01, CLI-02, CLI-09, SESS-01, SESS-02, SESS-03, SESS-04, SESS-05, SESS-06
**Success Criteria** (what must be TRUE):
  1. `terrace session start` reads the current spec hash, phase, active slice, policy mode, and last decision log entry, writes a SESSION.md to `.planning/sessions/`, and prints an alert if the spec hash differs from the hash recorded in the previous session
  2. `terrace session end` appends to the active SESSION.md: decisions made this session, files changed, behavioral truths added or modified, identified risks, protected-artifact changes, and what the next slice is
  3. SESSION.md files in `.planning/sessions/` are committed to the repo and contain enough context for a cold-start agent with no prior chat history to reconstruct the current project state
  4. `terrace phase set <phase>` updates `.terrace/project-state.json`, validates that the transition is legal given the current phase's completion criteria, and records the transition in session artifacts
**Plans**: TBD

### Phase 6: Post-Build Governance & Self-Test
**Goal**: After each implementation phase, the adversarial verifier runs as a hard gate, regressions are captured into the baseline, Terrace is tested as a framework against fixture repos, and artifact schemas are versioned and migratable
**Depends on**: Phase 3, Phase 4, Phase 5
**Requirements**: WKFL-09, WKFL-10, WKFL-11, WKFL-12, WKFL-13, AGNT-05, AGNT-06, CLI-11, CLI-16, PRST-08, PRST-09, PRST-10, PRST-11, TERR-01, TERR-02, TERR-03, TERR-04, TERR-05, TERR-06, TERR-07, TERR-08, TERR-09, TERR-10, TERR-11, TERR-12, TERR-13, TERR-14, TERR-15, VER-01, VER-02, VER-03, VER-04, VER-05, VER-06, VER-07
**Success Criteria** (what must be TRUE):
  1. Running the Adversarial Review workflow spawns `terrace-verifier-adversary` and produces a gap list where each gap is classified as blocking or non-blocking and mapped to a SPEC-XX requirement; a phase cannot be marked complete while any blocking gap remains unresolved without a decision-log entry assigning it to a future phase
  2. Running the Regression Capture workflow adds tests from adversarial-review findings to the baseline registry via `terrace baseline protect`, and the handoff workflow records current truth, remaining risks, and next slice in session artifacts
  3. Terrace CLI commands and enforcement logic are covered by tests that exercise success paths, failure paths, and policy-mode variations; enforcement tests verify that protected-test edits are blocked when required metadata is missing and allowed when rationale and references are valid
  4. Fixture repos exist for a TypeScript monorepo, a small script repo, a repo with no tests, and a repo with preexisting GSD modifications; fixture-based tests verify session reconstruction and artifact validation
  5. `terrace migrate` upgrades old artifact formats without silently discarding user-authored content, outputs a clear before/after summary, and Terrace artifact schemas carry version numbers so future migrations are mechanical rather than exploratory
  6. `terrace-tea`, `terrace-mutation`, `terrace-ui`, and `terrace-security` presets are installable, register correctly in `.terrace/presets/registry.json`, and `terrace security check` runs the full Semgrep + Trivy + OSV gate as a single command when `terrace-security` is installed
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/6 | Not started | - |
| 2. Governance Workflows | 0/TBD | Not started | - |
| 3. Baseline Protection & Enforcement | 0/TBD | Not started | - |
| 4. Decision Log, Audit & CI | 0/TBD | Not started | - |
| 5. Session Protocol & Lifecycle | 0/TBD | Not started | - |
| 6. Post-Build Governance & Self-Test | 0/TBD | Not started | - |
