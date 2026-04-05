# Requirements: Terrace

**Defined:** 2026-04-05  
**Revised:** 2026-04-05  
**Core Value:** Every session leaves the repo more legible and less fragile than before — through durable specs, protected tests, enforced alignment between intent and implementation, and explicit project memory.

---

## 1. Product Definition

**Terrace** is a spec-and-test governance layer for AI-assisted software development. It sits around an execution workflow such as GSD and forces project intent to be made explicit, compiled into durable artifacts, translated into a test architecture, and enforced through protected baselines, session protocols, and change-control mechanisms.

Terrace exists to reduce:

- drift across sessions
- hidden assumptions
- silent behavior changes
- shallow AI planning
- regression amnesia
- local optimization at the expense of global product truth

Terrace does **not** replace the underlying execution loop. It governs and hardens it.

---

## 2. Goals

### Primary Goals

- Turn fuzzy product intent into durable, enforceable repo artifacts
- Ensure meaningful behavior is backed by explicit acceptance criteria and test coverage
- Treat tests as long-term anti-drift memory, not just verification
- Make AI sessions resumable without depending on chat history
- Make protected behavioral truths hard to erode accidentally
- Improve implementation quality without requiring one model/session to hold the entire project in context

### Non-Goals

- Replace the repo's language-native test runner
- Replace project management tooling
- Replace CI/CD orchestration
- Auto-generate "specs" from code alone
- Act as a no-human fully autonomous PM system
- Serve as a web dashboard in v1

---

## 3. Success Metrics

### Adoption / Usability

- **MET-01**: `terrace init` succeeds in a clean target repo in <= 2 commands
- **MET-02**: >= 90% of first-run installs complete without manual file repair
- **MET-03**: session start and session end workflows take < 30 seconds each in typical repos

### Governance Quality

- **MET-04**: 100% of protected tests have a valid `spec_ref`
- **MET-05**: 100% of accepted requirements in active phase map to at least one planned test layer
- **MET-06**: 100% of behavioral changes merged to main update either spec artifacts or decision log
- **MET-07**: 100% of severe bugs fixed produce a regression artifact

### Drift Resistance

- **MET-08**: protected-test edits without authorized rationale are blocked locally and/or in CI
- **MET-09**: session-start workflow detects spec hash drift between sessions
- **MET-10**: Terrace can reconstruct current project state from repo artifacts without requiring prior chat context

### Noise / False Positive Control

- **MET-11**: false-positive rate for protected-test enforcement remains low enough that developers do not routinely bypass it
- **MET-12**: spec validation warnings distinguish blocking issues from advisory issues

---

## 4. Lifecycle Model

Terrace must model project work as explicit phases.

### Allowed Phases

- `intake`
- `interrogation`
- `spec-compilation`
- `test-architecture`
- `baseline-protection`
- `implementation`
- `adversarial-review`
- `regression-capture`
- `handoff`

### Phase Rules

- **LIFE-01**: every active workstream has a single current phase
- **LIFE-02**: phase is stored in a machine-readable project state file
- **LIFE-03**: session start surfaces current phase
- **LIFE-04**: phase transitions are recorded in session artifacts
- **LIFE-05**: a phase cannot be marked complete if its blocking outputs are missing
- **LIFE-06**: blocking gaps from adversarial review prevent phase completion unless explicitly deferred with decision-log entry and future-phase assignment

### Phase Completion Criteria

- `intake` complete when normalized understanding and initial scope file exist
- `interrogation` complete when open ambiguities are below threshold or explicitly logged as accepted assumptions
- `spec-compilation` complete when compiled spec, invariants, acceptance criteria, and permissions/state artifacts exist as applicable
- `test-architecture` complete when requirements map to test layers with rationale
- `baseline-protection` complete when required protected tests are registered
- `implementation` complete when scoped slice is built and corresponding tests pass
- `adversarial-review` complete when blocking gaps are resolved or formally deferred
- `regression-capture` complete when new learnings are written to durable artifacts
- `handoff` complete when session artifact records next slice and outstanding risks

---

## 5. Required Artifact Set

### Core Project Artifacts

- `docs/prd/PRD.md`
- `docs/prd/CLARIFICATIONS.md`
- `docs/prd/ACCEPTANCE-CRITERIA.md`
- `docs/prd/EDGE-CASES.md`
- `docs/spec/COMPILED-SPEC.md`
- `docs/spec/DOMAIN-GLOSSARY.md`
- `docs/spec/STATE-MACHINES.md`
- `docs/spec/PERMISSIONS-MATRIX.md`
- `docs/spec/INVARIANTS.md`
- `docs/spec/DECISION-LOG.md`
- `docs/spec/REGRESSIONS.md`
- `docs/testing/TEST-ARCH.md`
- `docs/testing/COVERAGE-PLAN.md`
- `docs/testing/PROTECTED-TESTS-POLICY.md`
- `.planning/sessions/`
- `.terrace/project-state.json`
- `.terrace/baseline-registry.json`
- `.terrace/policy.json`

Equivalent existing repo artifacts may be used if mapped explicitly.

---

## 6. Artifact Schemas and Validation Requirements

### Templates (Governance Artifacts)

- [ ] **TMPL-01**: `PRD.md` template exists with standard sections: problem, actors, desired outcomes, non-goals, constraints, success criteria, open questions
- [ ] **TMPL-02**: `COMPILED-SPEC.md` template exists with YAML frontmatter:
  - `spec_version`
  - `project`
  - `phase`
  - `requirements`
  - `protected`
  - `last_updated`
  - `source_refs`
- [ ] **TMPL-03**: `TEST-ARCH.md` template exists with requirement-to-test-layer mapping, rationale, fixture needs, mock policy, CI tier
- [ ] **TMPL-04**: `DECISION-LOG.md` template exists with fields:
  - `decision_id`
  - `date`
  - `author`
  - `spec_ref`
  - `change_type`
  - `rationale`
  - `impact`
  - `status`
- [ ] **TMPL-05**: `SESSION.md` template exists for recording session start state, current phase, files changed, decisions made, risks, and next slice
- [ ] **TMPL-06**: `INVARIANTS.md` template exists for cataloging system-level truths that must always hold, each with invariant ID, scope, and failure severity
- [ ] **TMPL-07**: `ACCEPTANCE-CRITERIA.md` template exists with observable success criteria tied to requirement IDs
- [ ] **TMPL-08**: `PERMISSIONS-MATRIX.md` template exists for explicitly documenting who can do what
- [ ] **TMPL-09**: `EDGE-CASES.md` template exists with failure mode, expected behavior, severity, and linked requirement/spec references
- [ ] **TMPL-10**: `STATE-MACHINES.md` template exists with entity/state transition tables and invalid transitions
- [ ] **TMPL-11**: `REGRESSIONS.md` template exists with bug summary, root cause, test added, and linked requirement/spec references
- [ ] **TMPL-12**: `.terrace/project-state.json` schema exists with current phase, current spec hash, active slice, last session, and active policy mode

### Validation

- [ ] **VAL-01**: `terrace spec validate` checks required sections and schema fields for all governance artifacts
- [ ] **VAL-02**: validation distinguishes blocking errors from warnings
- [ ] **VAL-03**: validation detects missing requirement references, missing `spec_ref`s, and missing protected-test metadata
- [ ] **VAL-04**: validation reports artifact freshness issues when session state and spec hash are stale
- [ ] **VAL-05**: validation supports repos using equivalent custom file names via configuration mapping

---

## 7. CLI Tooling (`terrace-tools.cjs` or successor package)

- [ ] **CLI-01**: `terrace session start` reads current spec hash, current phase, active slice, last session artifact, and writes a new session snapshot
- [ ] **CLI-02**: `terrace session end` appends decisions made, files changed, risks, protected-artifact changes, and next slice
- [ ] **CLI-03**: `terrace baseline protect <file> --spec-ref <SPEC-ID>` registers a test file as protected in `.terrace/baseline-registry.json`
- [ ] **CLI-04**: `terrace baseline status` cross-references baseline registry against `TEST-ARCH.md` and reports:
  - protected tests with no `spec_ref`
  - requirements with no protected anchor where required
  - registered files missing on disk
- [ ] **CLI-05**: `terrace decision log` creates a decision-log entry with current context prefilled
- [ ] **CLI-06**: `terrace spec validate` checks artifact completeness and detects drift indicators
- [ ] **CLI-07**: `terrace init` installs Terrace artifacts, agent definitions, hooks, and settings integrations in current repo
- [ ] **CLI-08**: `terrace audit` generates coverage and governance health report
- [ ] **CLI-09**: `terrace phase set <phase>` updates project state and validates transition legality
- [ ] **CLI-10**: `terrace doctor` diagnoses broken install, missing files, invalid config, and hook conflicts
- [ ] **CLI-11**: `terrace migrate` upgrades repo artifacts to latest Terrace schema version
- [ ] **CLI-12**: all CLI commands return machine-readable JSON in `--json` mode

---

## 8. Enforcement Mechanisms

- [ ] **ENF-01**: pre-commit hook blocks commits that modify protected test files without matching decision-log coverage
- [ ] **ENF-02**: pre-commit hook is installed automatically by `terrace init` by default
- [ ] **ENF-03**: `.terrace/policy.json` controls which governance gates are active
- [ ] **ENF-04**: baseline registry stores protected test paths with `spec_ref`, `locked_at`, `policy_flags`, and optional severity
- [ ] **ENF-05**: enforcement distinguishes protected-test edits from ordinary test edits
- [ ] **ENF-06**: policy supports at least `strict`, `standard`, and `lightweight` modes
- [ ] **ENF-07**: protected-test changes require explicit rationale, not just same-day log presence
- [ ] **ENF-08**: enforcement supports CI validation in addition to local hooks
- [ ] **ENF-09**: enforcement warnings must explain exactly what is missing and how to resolve it
- [ ] **ENF-10**: developers can intentionally defer a blocking issue only through explicit decision-log workflow

---

## 9. Pre-Build Governance Workflows

- [ ] **WKFL-01**: Intake workflow ingests PRD/request, normalizes understanding, and creates `docs/prd/PRD.md`
- [ ] **WKFL-02**: Interrogation workflow spawns `terrace-spec-interrogator` to reduce ambiguity through structured question rounds targeting goals, permissions, state transitions, edge cases, and failure modes
- [ ] **WKFL-03**: interrogation output records unresolved assumptions explicitly
- [ ] **WKFL-04**: Spec Compilation workflow spawns `terrace-spec-compiler` to produce `docs/spec/COMPILED-SPEC.md`
- [ ] **WKFL-05**: Spec Compilation workflow updates invariants, permissions matrix, and state-machine artifacts when relevant
- [ ] **WKFL-06**: Test Architecture workflow spawns `terrace-test-architect` to produce `docs/testing/TEST-ARCH.md` mapping each requirement to a test layer with rationale
- [ ] **WKFL-07**: Protected Baseline workflow spawns `terrace-baseline-builder` to create foundational tests and register them
- [ ] **WKFL-08**: a project cannot enter `implementation` phase unless required baseline artifacts exist or an explicit exception is logged

---

## 10. Post-Build Governance Workflows

- [ ] **WKFL-09**: Adversarial Review workflow spawns `terrace-verifier-adversary` to compare implementation against compiled spec and produce a gap list with severity
- [ ] **WKFL-10**: blocking adversarial-review gaps must be resolved, deferred, or remapped before phase completion
- [ ] **WKFL-11**: Regression Capture workflow adds tests from adversarial-review findings to baseline when applicable
- [ ] **WKFL-12**: handoff workflow records current truth, remaining risks, and next slice in session artifacts
- [ ] **WKFL-13**: if implementation reveals spec errors, workflow requires spec update before calling work complete

---

## 11. Agent Definitions

- [ ] **AGNT-01**: `terrace-spec-interrogator` reduces ambiguity through structured question rounds
- [ ] **AGNT-02**: `terrace-spec-compiler` converts interrogation output + PRD into compiled spec artifacts
- [ ] **AGNT-03**: `terrace-test-architect` designs test matrix and assigns behaviors to test layers
- [ ] **AGNT-04**: `terrace-baseline-builder` creates foundational acceptance, invariant, contract, and regression tests
- [ ] **AGNT-05**: `terrace-verifier-adversary` attacks assumptions, finds gaps, and detects spec drift
- [ ] **AGNT-06**: `terrace-maintainer-curator` updates decision logs, regressions, and session memory artifacts
- [ ] **AGNT-07**: each agent definition includes:
  - purpose
  - allowed outputs
  - forbidden actions
  - required inputs
  - handoff behavior
  - artifact ownership

---

## 12. Session Protocol

- [ ] **SESS-01**: session start reads spec hash, current phase, current slice, active policy mode, and last decision log entry
- [ ] **SESS-02**: session start alerts if spec hash changed since last session
- [ ] **SESS-03**: session end records what changed, what behavioral truth was added/modified, what remains risky, and next slice
- [ ] **SESS-04**: session artifacts are committed to repo under `.planning/sessions/`
- [ ] **SESS-05**: Terrace can resume from repo artifacts without prior chat context
- [ ] **SESS-06**: session artifacts include protected-artifact changes when applicable

---

## 13. GSD Integration and Modification Policy

Terrace may modify GSD files during development, but those modifications must be controlled and legible.

- [ ] **GSD-01**: Terrace may patch existing GSD hooks, prompts, config, and workflow files when required for governance features
- [ ] **GSD-02**: every GSD-file modification performed by Terrace must be recorded in decision log or install/migration output
- [ ] **GSD-03**: Terrace must clearly distinguish Terrace-owned changes from preexisting GSD logic
- [ ] **GSD-04**: `terrace init` must not leave GSD in a broken state if interrupted
- [ ] **GSD-05**: modified GSD installations must remain operable after Terrace install
- [ ] **GSD-06**: Terrace must support idempotent re-runs of setup against already-modified GSD repos
- [ ] **GSD-07**: if a GSD file cannot be safely patched automatically, Terrace must fail with explicit remediation guidance rather than partially corrupting it

---

## 14. Operational Semantics and Edge Cases

### Spec / Session Edge Cases

- [ ] **OPS-01**: if no PRD exists, Terrace can start from user request and create a provisional PRD
- [ ] **OPS-02**: if user declines interrogation, Terrace must support a logged fast-mode assumption path
- [ ] **OPS-03**: formatting-only spec changes should not be treated as behavioral drift
- [ ] **OPS-04**: spec hash computation must exclude configured non-semantic changes where possible

### Protected Artifact Edge Cases

- [ ] **OPS-05**: if protected file is renamed, registry must update safely or surface a blocking warning
- [ ] **OPS-06**: if protected file is deleted, Terrace must block completion until replaced, deregistered with rationale, or explicitly deferred
- [ ] **OPS-07**: if two protected files claim the same exclusive anchor, Terrace must surface conflict

### Repo Variability

- [ ] **OPS-08**: Terrace must work even when repo has no existing tests
- [ ] **OPS-09**: Terrace is language-agnostic in governance layer and cannot assume TypeScript-only execution
- [ ] **OPS-10**: TypeScript strict-mode guidance may be enabled when applicable, but is not mandatory for non-TypeScript repos
- [ ] **OPS-11**: custom repo structures must be supported via config mapping

### Hook / Install Conflicts

- [ ] **OPS-12**: if pre-commit hook already exists, Terrace must merge safely or provide explicit conflict resolution
- [ ] **OPS-13**: if user settings file already contains custom entries, Terrace must preserve them
- [ ] **OPS-14**: failed installs must be reversible

---

## 15. Testing Requirements for Terrace Itself

Terrace must be tested as a governance framework, not only described as one.

### CLI and Config

- [ ] **TERR-01**: CLI command tests cover success and failure modes
- [ ] **TERR-02**: config parsing tests cover valid, invalid, partial, and legacy configurations
- [ ] **TERR-03**: JSON output mode is tested for stable machine-readable shape

### Enforcement

- [ ] **TERR-04**: enforcement tests verify protected-test edits are blocked when required metadata is missing
- [ ] **TERR-05**: enforcement tests verify allowed edits pass when rationale and references are valid
- [ ] **TERR-06**: policy-mode tests verify strict/standard/lightweight behavior differs as documented

### Install / Migration

- [ ] **TERR-07**: install tests cover clean repo, repo with preexisting hooks, repo with existing GSD setup, and already-initialized repo
- [ ] **TERR-08**: migration tests cover upgrading old Terrace artifact schemas
- [ ] **TERR-09**: rollback or repair path is tested after interrupted installs

### Cross-Repo / Fixture Testing

- [ ] **TERR-10**: fixture repos exist for at least:
  - TypeScript monorepo
  - small script repo
  - repo with no tests
  - repo with preexisting GSD modifications
- [ ] **TERR-11**: fixture-based tests verify session reconstruction and artifact validation
- [ ] **TERR-12**: path handling is tested across major OS path conventions where supported

### Governance Quality

- [ ] **TERR-13**: tests verify requirement-to-test mapping detection
- [ ] **TERR-14**: tests verify stale or missing `spec_ref`s are surfaced correctly
- [ ] **TERR-15**: tests verify formatting-only changes do not create false behavioral drift warnings

---

## 16. Installation and Distribution

- [ ] **INST-01**: single-step local install path exists
- [ ] **INST-02**: `terrace init` is idempotent
- [ ] **INST-03**: install does not overwrite unrelated user files silently
- [ ] **INST-04**: install reports exactly what files were created or modified
- [ ] **INST-05**: Terrace works in Claude Code after install
- [ ] **INST-06**: install supports repos with preexisting GSD configuration
- [ ] **INST-07**: uninstall or disable path is documented
- [ ] **INST-08**: install can run in non-interactive mode where needed

---

## 17. Versioning and Migration

- [ ] **VER-01**: Terrace artifact schemas are versioned
- [ ] **VER-02**: compiled spec frontmatter includes schema or spec version
- [ ] **VER-03**: `terrace migrate` upgrades old artifact formats
- [ ] **VER-04**: migration never silently discards user-authored content
- [ ] **VER-05**: migration outputs a clear before/after summary
- [ ] **VER-06**: backward compatibility policy is documented for at least one previous artifact version
- [ ] **VER-07**: Terrace-owned modifications to GSD files are version-aware where possible

---

## 18. Security and Trust Model

- [ ] **SEC-01**: Terrace must document what files it is allowed to create or modify
- [ ] **SEC-02**: Terrace must not send repo contents externally unless explicitly configured to do so
- [ ] **SEC-03**: Terrace must not execute arbitrary project code during install without explicit intent
- [ ] **SEC-04**: settings and hook modifications must be transparent to user
- [ ] **SEC-05**: policy modes cannot silently disable critical protections without recorded config
- [ ] **SEC-06**: any file mutation during install/migrate must be auditable in output
- [ ] **SEC-07**: lightweight mode must clearly state which protections are weakened or disabled

---

## 19. Enhanced Enforcement / CI

- [ ] **ENF-11**: CI gate checks that spec-sensitive changes updated corresponding artifacts
- [ ] **ENF-12**: CI gate checks protected registry integrity
- [ ] **ENF-13**: `terrace audit` generates coverage report:
  - requirements with no test coverage
  - protected tests with no `spec_ref`
  - decisions with no `spec_ref`
  - stale session/spec state
- [ ] **ENF-14**: CI enforcement can be run independently of local hook presence

---

## 20. v2 Requirements

### Multi-Platform Support

- **PLAT-01**: platform adapter layer isolates Claude Code tool primitives from governance workflow logic
- **PLAT-02**: core governance workflows run in Codex environment
- **PLAT-03**: core governance workflows run in Cursor environment
- **PLAT-04**: Terrace works with Ollama-based local models

### Distribution

- **DIST-01**: published as npm package; installable via `npx terrace init`
- **DIST-02**: GitHub Actions workflow for automated release
- **DIST-03**: versioned release notes include schema migration notes

### Advanced Governance

- **ADV-01**: behavioral-coverage dashboard artifact can be generated from repo metadata
- **ADV-02**: requirement-to-test traceability can be exported as machine-readable JSON
- **ADV-03**: risk-based prioritization can mark requirements as critical / high / normal
- **ADV-04**: Terrace supports multiple concurrent workstreams with separate active slices

---

## 21. Out of Scope

| Feature | Reason |
|---------|--------|
| Test runner | Terrace governs what tests must exist; project-native tooling runs them |
| Code generation without spec+test anchors | Exactly what Terrace exists to prevent |
| Project management / ticket tracking | Jira/Linear/GitHub Issues handle this |
| CI/CD pipeline hosting | Terrace defines expectations, not the hosting/control plane |
| Web dashboard / visual UI | v1 is file-based; the repo is the dashboard |
| Automated spec inference from existing code alone | Produces shallow specs; Terrace centers human intent + interrogation |
| Replacing the entire execution layer | Terrace governs and hardens execution; it does not need to replace it |

---

## 22. Traceability Model

### Phase Mapping by Requirement Family

| Requirement Family | Primary Phase | Status |
|---|---|---|
| TMPL / VAL | spec-compilation | Pending |
| CLI | intake / session / enforcement | Pending |
| LIFE | lifecycle control | Pending |
| ENF | baseline-protection / CI | Pending |
| WKFL | multiple | Pending |
| AGNT | interrogation through handoff | Pending |
| SESS | intake / handoff | Pending |
| GSD | install / migration / execution integration | Pending |
| OPS | all phases | Pending |
| TERR | Terrace self-test | Pending |
| INST | installation | Pending |
| VER | migration / maintenance | Pending |
| SEC | installation / enforcement | Pending |
| PLAT / DIST / ADV | v2 | Pending |

### Traceability Rules

- **TRACE-01**: every active requirement must have phase ownership
- **TRACE-02**: every protected test must map to a requirement or invariant
- **TRACE-03**: every decision-log entry affecting behavior must map to a requirement, invariant, or acceptance criterion
- **TRACE-04**: `terrace audit` surfaces unmapped requirements

---

## 23. Coverage Snapshot

**v1 requirement families included:**  
TMPL, VAL, CLI, ENF, WKFL, AGNT, SESS, GSD, OPS, TERR, INST, VER, SEC, TRACE, LIFE, MET

**Current status:**  
- Requirements defined: yes
- Artifact schemas defined: yes
- Lifecycle model defined: yes
- Edge-case handling defined: yes
- Terrace self-test requirements defined: yes
- GSD modification policy defined: yes
- Phase-family traceability defined: yes
- Detailed roadmap mapping: pending next artifact

---

*Requirements defined: 2026-04-05*  
*Revised: 2026-04-05 to improve operational precision, edge-case handling, traceability, self-test rigor, and GSD integration flexibility.*
