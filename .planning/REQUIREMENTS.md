# Requirements: Terrace

**Defined:** 2026-04-05  
**Revised:** 2026-04-05 (second revision — source-donor audit incorporated)  
**Core Value:** Every session leaves the repo more legible and less fragile than before — through durable specs, protected tests, enforced alignment between intent and implementation, explicit project memory, and the minimum effort necessary to preserve that alignment.

---

## 1. Product Definition

**Terrace** is an automatic effort router with built-in usage intelligence for AI-assisted software development. It wraps an execution workflow (GSD) and forces project intent to be made explicit, compiled into durable artifacts, translated into a test architecture, and enforced through protected baselines, session protocols, and change-control mechanisms. Terrace decides the cheapest safe path automatically, then escalates only when drift, ambiguity, or risk justify the cost. TDD remains central, but the default posture is selective rigor, not maximum rigor everywhere.

Terrace is modular and extensible through **presets** — installable capability packs that add specialized testing, frontend quality, security posture, and tool integration without changing the governance core.

Terrace is also route-aware: routine inspect/classify/session/report commands stay low-effort by default, while deep governance passes are trigger-based rather than always-on.

Terrace exists to reduce:

- drift across sessions
- hidden assumptions
- silent behavior changes
- shallow AI planning
- regression amnesia
- local optimization at the expense of global product truth
- weak tests that pass but don't catch real failures

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
- Automatically classify tasks and cap effort by command class unless a trigger justifies escalation
- Prefer deterministic local tooling over model work for diffing, registry checks, freshness, and artifact mapping
- Help users understand where Terrace and GSD are spending tokens, then reduce waste over time

### Non-Goals

- Replace the repo's language-native test runner
- Replace project management tooling
- Replace CI/CD orchestration
- Auto-generate "specs" from code alone
- Act as a no-human fully autonomous PM system
- Serve as a web dashboard in v1
- Force users to manually pick lite / standard / deep modes during normal use

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

### Automation / Efficiency

- **MET-13**: explore / inspect / understand commands default to low effort unless explicitly escalated
- **MET-14**: deterministic local preprocessing resolves routine routing decisions before model escalation in the majority of commands
- **MET-15**: `/terrace-usage` identifies repeated expensive workflows and at least the top three token sinks in the current workspace
- **MET-16**: `/terrace-why` explains the selected effort level, triggered signals, and skipped deeper steps in a short diagnostic response

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
- **LIFE-07**: deep governance passes are trigger-based only; inspect/classify/usage/report commands never escalate to max effort by default

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
- `.terrace/routing-log.json`
- `.terrace/usage-log.json`
- `.terrace/steering.md`
- `.terrace/presets/registry.json`

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
- [ ] **TMPL-13**: `.terrace/steering.md` template exists as the project constitution — persistent context loaded at every session start, containing: project identity, non-negotiable constraints, active quality gates, and definition of done

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
- [ ] **CLI-13**: `terrace preset install <id>` installs a preset from the registry, registers its agents and workflows, and sets config flags
- [ ] **CLI-14**: `terrace preset list` shows installed and available presets with status
- [ ] **CLI-15**: `terrace steering` opens or creates `.terrace/steering.md` with project constitution template
- [ ] **CLI-16**: `terrace security check` runs the full security gate (Semgrep + Trivy + OSV) as a single command; available when `terrace-security` preset is installed

---

## 7a. Preset System

Terrace is modular and extensible through presets. A preset is an installable capability pack that adds agents, workflows, knowledge fragments, and config flags to the core governance layer.

### Preset Registry

- [ ] **PRST-01**: `.terrace/presets/registry.json` exists as a machine-readable catalog of installed presets
- [ ] **PRST-02**: each preset entry declares: `id`, `version`, `category`, `effect` (`Read-only` | `Read+Write`), `agents`, `workflows`, `fragments`, `flags`
- [ ] **PRST-03**: preset categories are: `governance` (core), `testing`, `frontend`, `security`, `integration`
- [ ] **PRST-04**: preset install is idempotent — re-running does not corrupt existing state
- [ ] **PRST-05**: preset install does not overwrite user-modified agent or workflow files without explicit confirmation
- [ ] **PRST-06**: preset uninstall removes registered components and config flags without leaving orphaned artifacts
- [ ] **PRST-07**: conflicting presets (e.g., two presets claiming the same workflow slot) surface a conflict warning rather than silently overwriting

### Built-In v1 Presets (Phase 6 — depend on full governance stack)

- [ ] **PRST-08**: `terrace-tea` preset available — integrates BMAD TEA test design, ATDD, and traceability workflows as a Terrace capability pack
- [ ] **PRST-09**: `terrace-mutation` preset available — installs StrykerJS, provides config template, wires mutation score gate into adversarial review
- [ ] **PRST-10**: `terrace-ui` preset available — installs Storybook + a11y addon, generates story scaffolds, registers story files as protected baseline anchors
- [ ] **PRST-11**: `terrace-security` preset available — configures Semgrep rules, provides CI YAML for Trivy/OSV, maps ASVS controls to spec requirements

### Preset Configuration Flags

- [ ] **PRST-12**: each preset defines typed config flags in its manifest (e.g., `tea_use_playwright_utils: boolean`, `mutation_threshold_break: number`)
- [ ] **PRST-13**: flags are stored in `.terrace/policy.json` under a namespaced key matching the preset id
- [ ] **PRST-14**: flag values drive conditional workflow behavior (e.g., skip Playwright step if `tea_use_playwright_utils: false`)

---

## 7b. Knowledge Fragment System

Governance agents use a tiered knowledge fragment system to load context selectively, avoiding bloated prompts and enabling efficient context engineering. This pattern is derived from BMAD TEA's `tea-index.csv` architecture.

### Fragment Index

- [ ] **FRAG-01**: each governance agent has a `fragments/` directory and a `fragment-index.json` (or `.csv`) listing available fragments with: `id`, `name`, `tags`, `tier` (`core` | `extended` | `specialized`), `file`
- [ ] **FRAG-02**: `core` fragments are always loaded into agent context; `extended` fragments load on-demand based on phase or config; `specialized` fragments load only when specific flags or stack types are detected
- [ ] **FRAG-03**: step-01 of each multi-step governance workflow reads the fragment index and loads the appropriate tier before proceeding
- [ ] **FRAG-04**: fragment conditional loading reduces agent context size by at least 40% compared to loading all fragments (measured against a reference project)
- [ ] **FRAG-05**: fragment content is markdown — readable by humans, loadable by agents, diffable in git

### Required Fragment Sets (v1)

- [ ] **FRAG-06**: `terrace-spec-interrogator` agent has fragments covering: question-round templates, assumption-logging patterns, edge-case probing patterns, fast-mode path
- [ ] **FRAG-07**: `terrace-spec-compiler` agent has fragments covering: spec YAML frontmatter schema, invariant catalog patterns, permissions matrix format, state machine format
- [ ] **FRAG-08**: `terrace-test-architect` agent has fragments covering: test layer selection criteria, risk scoring (P0-P3), fixture architecture, mock policy, CI tier assignment
- [ ] **FRAG-09**: `terrace-verifier-adversary` agent has fragments covering: spec drift detection patterns, gap severity classification, regression test requirements

---

## 7c. Effort Routing and Usage Intelligence

Terrace classifies work locally first, then escalates only when the task class or changed artifacts justify it. This family encodes the automatic effort router, the default effort ceilings, delta-based context loading, trigger-based deep governance, and usage reporting.

### ROUTE Family

- [ ] **ROUTE-01**: automatic task classification uses command type, changed-file count, changed-file categories, protected tests touched, spec artifacts touched, behavior change, active slice, ambiguity, and safety-critical domain as routing signals
- [ ] **ROUTE-02**: deterministic local preprocessing handles diffing, registry checks, requirement mapping, artifact freshness, session reconstruction, and enforcement before model work is considered

### EFF Family

- [ ] **EFF-01**: effort ceilings exist by command class and are applied automatically without requiring manual lite / standard / deep selection
- [ ] **EFF-02**: explore / inspect / understand commands are hard-capped at low effort unless explicitly escalated
- [ ] **EFF-03**: classify / impact lookup / session resume / usage reporting default to low effort
- [ ] **EFF-04**: targeted spec patch and changed-behavior test design may use low-medium effort when impact is localized
- [ ] **EFF-05**: new subsystem, unclear PRD, auth, permissions, schema, and money-flow work may escalate high when triggers justify it

### DELTA Family

- [ ] **DELTA-01**: Terrace generates delta-context packets instead of whole-workspace dumps whenever the active slice is already defined
- [ ] **DELTA-02**: artifacts are regenerated only when stale or impacted
- [ ] **DELTA-03**: section-level or requirement-level rewrites are preferred over whole-doc regeneration

### TRIG Family

- [ ] **TRIG-01**: deep governance passes are trigger-based only, with explicit signals recorded for escalation
- [ ] **TRIG-02**: full spec compilation, full test architecture regeneration, and full adversarial review are never default for routine tasks
- [ ] **TRIG-03**: safety-critical domains (auth, permissions, money, state machines, schema) can trigger higher effort, but only after local analysis

### USG Family

- [ ] **USG-01**: `/terrace-usage` reports where Terrace and GSD usage is being spent, highlights repeated expensive workflows, and suggests concrete optimization opportunities
- [ ] **USG-02**: `/terrace-why` briefly explains why Terrace chose the current effort level, states what signals triggered it, and states what deeper steps were skipped to save tokens
- [ ] **USG-03**: repeated expensive operation detection is available to surface overfiring workflows across sessions
- [ ] **USG-04**: usage logging is append-only, compact, and safe to reconstruct from repo artifacts

---

## 8. Enforcement Mechanisms

- [ ] **ENF-01**: pre-commit hook blocks commits that modify protected test files without matching decision-log coverage
- [ ] **ENF-02**: pre-commit hook is installed automatically by `terrace init` by default
- [ ] **ENF-03**: `.terrace/policy.json` controls which governance gates are active
- [ ] **ENF-04**: baseline registry stores protected test paths with `spec_ref`, `locked_at`, `policy_flags`, and optional severity
- [ ] **ENF-05**: enforcement distinguishes protected-test edits from ordinary test edits
- [ ] **ENF-06**: policy supports at least `strict`, `standard`, and `lightweight` modes, but the routing layer decides effort by command class rather than by user preference
- [ ] **ENF-07**: protected-test changes require explicit rationale, not just same-day log presence
- [ ] **ENF-08**: enforcement supports CI validation in addition to local hooks
- [ ] **ENF-09**: enforcement warnings must explain exactly what is missing and how to resolve it
- [ ] **ENF-10**: developers can intentionally defer a blocking issue only through explicit decision-log workflow

---

## 9. Pre-Build Governance Workflows

- [ ] **WKFL-01**: Intake workflow ingests PRD/request, normalizes understanding, creates `docs/prd/PRD.md`, and creates `.terrace/steering.md` (project constitution) if it does not exist, after local route classification
- [ ] **WKFL-02**: Interrogation workflow uses tri-modal architecture (Create / Edit / Validate modes) with step-file chaining — spawns `terrace-spec-interrogator` via sequential step files, each file naming the next, enabling resume from any interrupted step when escalation is justified
- [ ] **WKFL-02a**: interrogation Create mode runs structured question rounds targeting goals, permissions, state transitions, edge cases, and failure modes — loads knowledge fragments by tier before each round and stops early when ambiguity is already low enough
- [ ] **WKFL-02b**: interrogation Edit mode revises existing interrogation output without restarting from scratch
- [ ] **WKFL-02c**: interrogation Validate mode evaluates existing output against a completion checklist and produces a pass/fail report
- [ ] **WKFL-03**: interrogation output records unresolved assumptions explicitly
- [ ] **WKFL-04**: Spec Compilation workflow uses tri-modal architecture (Create / Edit / Validate) with step-file chaining — spawns `terrace-spec-compiler` to produce `docs/spec/COMPILED-SPEC.md` only when the spec artifact is stale or impacted
- [ ] **WKFL-05**: Spec Compilation workflow updates invariants, permissions matrix, and state-machine artifacts when relevant, preferably as section-level or requirement-level deltas
- [ ] **WKFL-06**: Test Architecture workflow uses tri-modal architecture (Create / Edit / Validate) — spawns `terrace-test-architect` to produce `docs/testing/TEST-ARCH.md` mapping each requirement to a test layer with P0-P3 risk score and CI tier assignment, defaulting to the smallest safe slice
- [ ] **WKFL-07**: Protected Baseline workflow spawns `terrace-baseline-builder` to create foundational tests and register them
- [ ] **WKFL-08**: a project cannot enter `implementation` phase unless required baseline artifacts exist or an explicit exception is logged

---

## 10. Post-Build Governance Workflows

- [ ] **WKFL-09**: Adversarial Review workflow spawns `terrace-verifier-adversary` to compare implementation against compiled spec and produce a gap list with severity only when the router triggers a deep governance pass
- [ ] **WKFL-10**: blocking adversarial-review gaps must be resolved, deferred, or remapped before phase completion
- [ ] **WKFL-11**: Regression Capture workflow adds tests from adversarial-review findings to baseline when applicable and prefers targeted additions over full rewrites
- [ ] **WKFL-12**: handoff workflow records current truth, remaining risks, and next slice in session artifacts
- [ ] **WKFL-13**: if implementation reveals spec errors, workflow requires spec update before calling work complete

---

## 11. Agent Definitions

- [ ] **AGNT-01**: `terrace-spec-interrogator` reduces ambiguity through structured question rounds
- [ ] **AGNT-02**: `terrace-spec-compiler` converts interrogation output + PRD into compiled spec artifacts
- [ ] **AGNT-03**: `terrace-test-architect` designs test matrix and assigns behaviors to test layers
- [ ] **AGNT-04**: `terrace-baseline-builder` creates foundational acceptance, invariant, contract, and regression tests
- [ ] **AGNT-05**: `terrace-verifier-adversary` attacks assumptions, finds gaps, and detects spec drift
- [ ] **AGNT-06**: `terrace-maintainer-curator` updates decision logs, regressions, session memory artifacts, and usage logs
- [ ] **AGNT-07**: each agent definition includes:
  - purpose
  - allowed outputs
  - forbidden actions
  - required inputs
  - handoff behavior
  - artifact ownership
  - fragment index reference (path to `fragment-index.json`)
- [ ] **AGNT-08**: each agent loads `.terrace/steering.md` as the first context item before any workflow step executes
- [ ] **AGNT-09**: route-aware commands expose a compact routing summary to the user; `terrace-usage` and `terrace-why` are read-only diagnostics and never trigger deep governance on their own

---

## 12. Session Protocol

- [ ] **SESS-01**: session start reads `.terrace/steering.md`, spec hash, current phase, current slice, active policy mode, route summary, and last decision log entry — presenting a concise summary of each and using delta loading by default
- [ ] **SESS-02**: session start alerts if spec hash changed since last session
- [ ] **SESS-03**: session end records what changed, what behavioral truth was added/modified, what remains risky, what routes were used, and next slice
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

## 13a. Skill and Workflow Command Set

Terrace is a fork and evolution of GSD — not a wrapper. GSD commands serve as reference; Terrace builds improved equivalents with governance semantics. Every Terrace skill must be spec-anchored, governance-aware, and phase-typed.

### Porting Philosophy

- **Port with improvements (core loop)**: commands that directly serve Terrace's lifecycle but need governance upgrades — plans must reference spec artifacts, phase transitions must validate against the typed lifecycle, execution gates must check spec coverage
- **Port with major upgrades (governance-specific)**: commands where GSD's behavior is fundamentally insufficient for Terrace's model — replaced with Terrace-native equivalents that know about specs, protected baselines, and adversarial review
- **Port as-is (utilities)**: operational utilities with no governance implications — rename to `terrace-*` prefix, no logic changes

### Command Inventory by Tier

**Tier 1 — Port with improvements (core planning loop):**

- [ ] **SKIL-01**: `terrace-discuss-phase` — surfaces spec/interrogation context, not just approach clarification; routes to interrogation agent when appropriate
- [ ] **SKIL-02**: `terrace-plan-phase` — plans must reference spec artifacts; fails if spec artifacts required for phase are missing
- [ ] **SKIL-03**: `terrace-execute-phase` — adds governance gate (spec coverage check) before execution begins
- [ ] **SKIL-04**: `terrace-next` — advances through Terrace typed lifecycle (intake → interrogation → spec-compilation → ...) not just numbered phases
- [ ] **SKIL-05**: `terrace-progress` — shows spec hash, drift status, baseline protection state, and session history alongside plan/summary counts
- [ ] **SKIL-06**: `terrace-quick` — inline task execution without formal plan; records in session artifact; notes if used outside governance phase

**Tier 1 — Port with improvements (roadmap management):**

- [ ] **SKIL-07**: `terrace-add-phase` — validates new phase against allowed Terrace phase types before appending
- [ ] **SKIL-08**: `terrace-insert-phase` — same typed-phase validation; records insertion rationale in decision log
- [ ] **SKIL-09**: `terrace-remove-phase` — port as-is with decision-log recording
- [ ] **SKIL-10**: `terrace-research-phase` — port as-is
- [ ] **SKIL-11**: `terrace-analyze-dependencies` — port as-is

**Tier 2 — Port with major upgrades (governance-specific):**

- [ ] **SKIL-12**: `terrace-adversarial-review` (replaces `verify-work`) — spawns `terrace-verifier-adversary`; generates gap list with severity; blocks phase completion on unresolved blocking gaps
- [ ] **SKIL-13**: `terrace-validate-phase` (replaces `validate-phase`) — checks spec coverage and requirement-to-test mapping, not just Nyquist sampling
- [ ] **SKIL-14**: `terrace-audit` (replaces `audit-uat`) — audits spec drift, regression artifacts, and protected baseline integrity across phases
- [ ] **SKIL-15**: `terrace-new-project` (replaces `new-project`) — starts with intake phase, not just roadmap creation; creates PRD and steering.md
- [ ] **SKIL-16**: `terrace-new-milestone` (replaces `new-milestone`) — requires adversarial review gate before milestone transition
- [ ] **SKIL-17**: `terrace-complete-milestone` (replaces `complete-milestone`) — same gate; archives governance artifacts with milestone
- [ ] **SKIL-18**: `terrace-session-report` (replaces `session-report`) — outputs governance handoff artifact with spec hash, drift status, protected-baseline fingerprint
- [ ] **SKIL-19**: `terrace-pause-work` (replaces `pause-work`) — writes session artifact Terrace can reconstruct from without chat history
- [ ] **SKIL-20**: `terrace-resume-work` (replaces `resume-project`) — detects spec hash drift since last session on load

**Tier 3 — Port as-is (utilities):**

- [ ] **SKIL-21**: `terrace-note` — port as-is
- [ ] **SKIL-22**: `terrace-add-todo` / `terrace-check-todos` — port as-is
- [ ] **SKIL-23**: `terrace-health` — port as-is; extend to check governance artifact presence
- [ ] **SKIL-24**: `terrace-stats` — port as-is; extend to include spec coverage metrics
- [ ] **SKIL-25**: `terrace-ship` — port as-is; add pre-ship governance gate (spec + baseline check)
- [ ] **SKIL-26**: `terrace-forensics` — port as-is
- [ ] **SKIL-27**: `terrace-map-codebase` — port as-is
- [ ] **SKIL-28**: `terrace-usage` — reports where Terrace and GSD usage is being spent, highlights repeated expensive workflows, and suggests concrete optimization opportunities
- [ ] **SKIL-29**: `terrace-why` — explains why Terrace chose the current effort level, states what signals triggered it, and states what deeper steps were skipped to save tokens

### Deferred / Out of Scope

- `ui-phase`, `ui-review` — preset territory (`terrace-ui` preset, Phase 6)
- `autonomous` — governance model conflicts with fully autonomous mode; revisit in v2
- workspace commands (`new-workspace`, `list-workspaces`, `remove-workspace`) — defer until multi-project support is scoped
- `profile-user`, `manager` — not governance-relevant
- `add-tests` — superseded entirely by Terrace's TDD+spec model

### Phase Assignment

| Phase | Skills built |
|-------|-------------|
| Phase 1 (Foundation) | Skill stubs for all Tier 1–3 commands — scaffold only, no workflow logic |
| Phase 2 (Governance Workflows) | SKIL-01–06 (core loop), SKIL-07–11 (roadmap management), SKIL-21–27 (utilities) |
| Phase 4 (Decision Log, Audit & CI) | SKIL-28 (usage reporting) |
| Phase 5 (Session Protocol) | SKIL-18–20 (session lifecycle), SKIL-29 (route explanation) |
| Phase 6 (Post-Build Governance) | SKIL-12–17 (governance-specific upgrades) |

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
- [ ] **OPS-15**: explore / inspect / usage commands must remain low-effort by default unless a higher-effort trigger is explicit
- [ ] **OPS-16**: if routing signals conflict, deterministic local analysis wins and model escalation is deferred until local signals are exhausted

---

## 14a. Development Process

Terrace is built test-first. The framework enforces TDD on target repos — it holds itself to the same standard.

- [ ] **DEV-01**: no production code is committed for any Terrace feature without a prior failing test for that behavior
- [ ] **DEV-02**: every plan in every phase begins with test stubs or acceptance tests derived from the phase success criteria before implementation code is written
- [ ] **DEV-03**: a plan is not marked complete unless all tests for that plan's behavior pass and no implementation exists without a corresponding test
- [ ] **DEV-04**: Terrace's own pre-commit hook enforces the same protected-baseline rules on Terrace's own test suite during development

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
- [ ] **TERR-16**: tests verify explore / inspect / usage commands default to low effort and only escalate on explicit triggers
- [ ] **TERR-17**: tests verify `terrace-usage` surfaces repeated expensive workflows and top token sinks
- [ ] **TERR-18**: tests verify `terrace-why` reports the signals used for routing and the deeper steps that were skipped

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

### v1.5 Preset Capabilities (high-leverage, deferrable from v1 core)

- **PRST-V15-01**: `terrace-tea` preset stable — BMAD TEA test design, ATDD, traceability, NFR assessment workflows fully integrated
- **PRST-V15-02**: `terrace-mutation` preset stable — StrykerJS gate wired into adversarial review; incremental mode enabled by default
- **PRST-V15-03**: `terrace-ui` preset stable — Storybook + a11y + story-as-protected-anchor model working end-to-end
- **PRST-V15-04**: `terrace-security` preset (partial) — Semgrep + Trivy + ASVS control mapping in CI
- **PRST-V15-05**: tiered knowledge fragment system complete for all governance agents
- **PRST-V15-06**: tri-modal (Create/Edit/Validate) implemented for spec-compilation and test-architecture in addition to interrogation

### v2 Security and Release Posture

- **SEC-V2-01**: `terrace-security` preset complete — ZAP DAST, Scorecard, OpenSSF baseline check at release gate
- **SEC-V2-02**: SLSA provenance generation wired into release pipeline
- **SEC-V2-03**: public preset registry (community presets) with catalog.json equivalent to spec-kit's extension catalog

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

### Phase Mapping — Detailed Requirement Assignments

| Requirement | Phase | Status |
|-------------|-------|--------|
| TMPL-01 | Phase 1: Foundation | Pending |
| TMPL-02 | Phase 1: Foundation | Pending |
| TMPL-03 | Phase 1: Foundation | Pending |
| TMPL-04 | Phase 1: Foundation | Pending |
| TMPL-05 | Phase 1: Foundation | Pending |
| TMPL-06 | Phase 1: Foundation | Pending |
| TMPL-07 | Phase 1: Foundation | Pending |
| TMPL-08 | Phase 1: Foundation | Pending |
| TMPL-09 | Phase 1: Foundation | Pending |
| TMPL-10 | Phase 1: Foundation | Pending |
| TMPL-11 | Phase 1: Foundation | Pending |
| TMPL-12 | Phase 1: Foundation | Pending |
| TMPL-13 | Phase 1: Foundation | Pending |
| PRST-01 | Phase 1: Foundation | Pending |
| PRST-02 | Phase 1: Foundation | Pending |
| PRST-03 | Phase 1: Foundation | Pending |
| PRST-04 | Phase 1: Foundation | Pending |
| PRST-05 | Phase 1: Foundation | Pending |
| PRST-06 | Phase 1: Foundation | Pending |
| PRST-07 | Phase 1: Foundation | Pending |
| PRST-12 | Phase 1: Foundation | Pending |
| PRST-13 | Phase 1: Foundation | Pending |
| PRST-14 | Phase 1: Foundation | Pending |
| CLI-13 | Phase 1: Foundation | Pending |
| CLI-14 | Phase 1: Foundation | Pending |
| CLI-15 | Phase 1: Foundation | Pending |
| CLI-16 | Phase 6: Post-Build Governance & Self-Test | Pending |
| VAL-01 | Phase 1: Foundation | Pending |
| VAL-02 | Phase 1: Foundation | Pending |
| VAL-03 | Phase 1: Foundation | Pending |
| VAL-04 | Phase 1: Foundation | Pending |
| VAL-05 | Phase 1: Foundation | Pending |
| CLI-07 | Phase 1: Foundation | Pending |
| CLI-10 | Phase 1: Foundation | Pending |
| CLI-12 | Phase 1: Foundation | Pending |
| INST-01 | Phase 1: Foundation | Pending |
| INST-02 | Phase 1: Foundation | Pending |
| INST-03 | Phase 1: Foundation | Pending |
| INST-04 | Phase 1: Foundation | Pending |
| INST-05 | Phase 1: Foundation | Pending |
| INST-06 | Phase 1: Foundation | Pending |
| INST-07 | Phase 1: Foundation | Pending |
| INST-08 | Phase 1: Foundation | Pending |
| GSD-01 | Phase 1: Foundation | Pending |
| GSD-02 | Phase 1: Foundation | Pending |
| GSD-03 | Phase 1: Foundation | Pending |
| GSD-04 | Phase 1: Foundation | Pending |
| GSD-05 | Phase 1: Foundation | Pending |
| GSD-06 | Phase 1: Foundation | Pending |
| GSD-07 | Phase 1: Foundation | Pending |
| SEC-01 | Phase 1: Foundation | Pending |
| SEC-02 | Phase 1: Foundation | Pending |
| SEC-03 | Phase 1: Foundation | Pending |
| SEC-04 | Phase 1: Foundation | Pending |
| SEC-05 | Phase 1: Foundation | Pending |
| SEC-06 | Phase 1: Foundation | Pending |
| SEC-07 | Phase 1: Foundation | Pending |
| LIFE-01 | Phase 1: Foundation | Pending |
| LIFE-02 | Phase 1: Foundation | Pending |
| LIFE-03 | Phase 1: Foundation | Pending |
| LIFE-04 | Phase 1: Foundation | Pending |
| LIFE-05 | Phase 1: Foundation | Pending |
| LIFE-06 | Phase 1: Foundation | Pending |
| OPS-08 | Phase 1: Foundation | Pending |
| OPS-09 | Phase 1: Foundation | Pending |
| OPS-10 | Phase 1: Foundation | Pending |
| OPS-11 | Phase 1: Foundation | Pending |
| OPS-12 | Phase 1: Foundation | Pending |
| OPS-13 | Phase 1: Foundation | Pending |
| OPS-14 | Phase 1: Foundation | Pending |
| DEV-01 | All phases | Pending |
| DEV-02 | All phases | Pending |
| DEV-03 | All phases | Pending |
| DEV-04 | All phases | Pending |
| WKFL-01 | Phase 2: Governance Workflows | Pending |
| WKFL-02 | Phase 2: Governance Workflows | Pending |
| WKFL-03 | Phase 2: Governance Workflows | Pending |
| WKFL-04 | Phase 2: Governance Workflows | Pending |
| WKFL-05 | Phase 2: Governance Workflows | Pending |
| AGNT-01 | Phase 2: Governance Workflows | Pending |
| AGNT-02 | Phase 2: Governance Workflows | Pending |
| AGNT-07 | Phase 2: Governance Workflows | Pending |
| AGNT-08 | Phase 2: Governance Workflows | Pending |
| WKFL-02a | Phase 2: Governance Workflows | Pending |
| WKFL-02b | Phase 2: Governance Workflows | Pending |
| WKFL-02c | Phase 2: Governance Workflows | Pending |
| FRAG-01 | Phase 2: Governance Workflows | Pending |
| FRAG-02 | Phase 2: Governance Workflows | Pending |
| FRAG-03 | Phase 2: Governance Workflows | Pending |
| FRAG-04 | Phase 2: Governance Workflows | Pending |
| FRAG-05 | Phase 2: Governance Workflows | Pending |
| FRAG-06 | Phase 2: Governance Workflows | Pending |
| FRAG-07 | Phase 2: Governance Workflows | Pending |
| FRAG-08 | Phase 2: Governance Workflows | Pending |
| FRAG-09 | Phase 2: Governance Workflows | Pending |
| OPS-01 | Phase 2: Governance Workflows | Pending |
| OPS-02 | Phase 2: Governance Workflows | Pending |
| OPS-03 | Phase 2: Governance Workflows | Pending |
| OPS-04 | Phase 2: Governance Workflows | Pending |
| WKFL-06 | Phase 3: Baseline Protection & Enforcement | Pending |
| WKFL-07 | Phase 3: Baseline Protection & Enforcement | Pending |
| WKFL-08 | Phase 3: Baseline Protection & Enforcement | Pending |
| AGNT-03 | Phase 3: Baseline Protection & Enforcement | Pending |
| AGNT-04 | Phase 3: Baseline Protection & Enforcement | Pending |
| CLI-03 | Phase 3: Baseline Protection & Enforcement | Pending |
| CLI-04 | Phase 3: Baseline Protection & Enforcement | Pending |
| ENF-01 | Phase 3: Baseline Protection & Enforcement | Pending |
| ENF-02 | Phase 3: Baseline Protection & Enforcement | Pending |
| ENF-03 | Phase 3: Baseline Protection & Enforcement | Pending |
| ENF-04 | Phase 3: Baseline Protection & Enforcement | Pending |
| ENF-05 | Phase 3: Baseline Protection & Enforcement | Pending |
| ENF-06 | Phase 3: Baseline Protection & Enforcement | Pending |
| ENF-07 | Phase 3: Baseline Protection & Enforcement | Pending |
| OPS-05 | Phase 3: Baseline Protection & Enforcement | Pending |
| OPS-06 | Phase 3: Baseline Protection & Enforcement | Pending |
| OPS-07 | Phase 3: Baseline Protection & Enforcement | Pending |
| CLI-05 | Phase 4: Decision Log, Audit & CI | Pending |
| CLI-06 | Phase 4: Decision Log, Audit & CI | Pending |
| CLI-08 | Phase 4: Decision Log, Audit & CI | Pending |
| ENF-08 | Phase 4: Decision Log, Audit & CI | Pending |
| ENF-09 | Phase 4: Decision Log, Audit & CI | Pending |
| ENF-10 | Phase 4: Decision Log, Audit & CI | Pending |
| ENF-11 | Phase 4: Decision Log, Audit & CI | Pending |
| ENF-12 | Phase 4: Decision Log, Audit & CI | Pending |
| ENF-13 | Phase 4: Decision Log, Audit & CI | Pending |
| ENF-14 | Phase 4: Decision Log, Audit & CI | Pending |
| MET-01 | Phase 4: Decision Log, Audit & CI | Pending |
| MET-02 | Phase 4: Decision Log, Audit & CI | Pending |
| MET-03 | Phase 4: Decision Log, Audit & CI | Pending |
| MET-04 | Phase 4: Decision Log, Audit & CI | Pending |
| MET-05 | Phase 4: Decision Log, Audit & CI | Pending |
| MET-06 | Phase 4: Decision Log, Audit & CI | Pending |
| MET-07 | Phase 4: Decision Log, Audit & CI | Pending |
| MET-08 | Phase 4: Decision Log, Audit & CI | Pending |
| MET-09 | Phase 4: Decision Log, Audit & CI | Pending |
| MET-10 | Phase 4: Decision Log, Audit & CI | Pending |
| MET-11 | Phase 4: Decision Log, Audit & CI | Pending |
| MET-12 | Phase 4: Decision Log, Audit & CI | Pending |
| CLI-01 | Phase 5: Session Protocol & Lifecycle | Pending |
| CLI-02 | Phase 5: Session Protocol & Lifecycle | Pending |
| CLI-09 | Phase 5: Session Protocol & Lifecycle | Pending |
| SESS-01 | Phase 5: Session Protocol & Lifecycle | Pending |
| SESS-02 | Phase 5: Session Protocol & Lifecycle | Pending |
| SESS-03 | Phase 5: Session Protocol & Lifecycle | Pending |
| SESS-04 | Phase 5: Session Protocol & Lifecycle | Pending |
| SESS-05 | Phase 5: Session Protocol & Lifecycle | Pending |
| SESS-06 | Phase 5: Session Protocol & Lifecycle | Pending |
| PRST-08 | Phase 6: Post-Build Governance & Self-Test | Pending |
| PRST-09 | Phase 6: Post-Build Governance & Self-Test | Pending |
| PRST-10 | Phase 6: Post-Build Governance & Self-Test | Pending |
| PRST-11 | Phase 6: Post-Build Governance & Self-Test | Pending |
| WKFL-09 | Phase 6: Post-Build Governance & Self-Test | Pending |
| WKFL-10 | Phase 6: Post-Build Governance & Self-Test | Pending |
| WKFL-11 | Phase 6: Post-Build Governance & Self-Test | Pending |
| WKFL-12 | Phase 6: Post-Build Governance & Self-Test | Pending |
| WKFL-13 | Phase 6: Post-Build Governance & Self-Test | Pending |
| AGNT-05 | Phase 6: Post-Build Governance & Self-Test | Pending |
| AGNT-06 | Phase 6: Post-Build Governance & Self-Test | Pending |
| CLI-11 | Phase 6: Post-Build Governance & Self-Test | Pending |
| TERR-01 | Phase 6: Post-Build Governance & Self-Test | Pending |
| TERR-02 | Phase 6: Post-Build Governance & Self-Test | Pending |
| TERR-03 | Phase 6: Post-Build Governance & Self-Test | Pending |
| TERR-04 | Phase 6: Post-Build Governance & Self-Test | Pending |
| TERR-05 | Phase 6: Post-Build Governance & Self-Test | Pending |
| TERR-06 | Phase 6: Post-Build Governance & Self-Test | Pending |
| TERR-07 | Phase 6: Post-Build Governance & Self-Test | Pending |
| TERR-08 | Phase 6: Post-Build Governance & Self-Test | Pending |
| TERR-09 | Phase 6: Post-Build Governance & Self-Test | Pending |
| TERR-10 | Phase 6: Post-Build Governance & Self-Test | Pending |
| TERR-11 | Phase 6: Post-Build Governance & Self-Test | Pending |
| TERR-12 | Phase 6: Post-Build Governance & Self-Test | Pending |
| TERR-13 | Phase 6: Post-Build Governance & Self-Test | Pending |
| TERR-14 | Phase 6: Post-Build Governance & Self-Test | Pending |
| TERR-15 | Phase 6: Post-Build Governance & Self-Test | Pending |
| VER-01 | Phase 6: Post-Build Governance & Self-Test | Pending |
| VER-02 | Phase 6: Post-Build Governance & Self-Test | Pending |
| VER-03 | Phase 6: Post-Build Governance & Self-Test | Pending |
| VER-04 | Phase 6: Post-Build Governance & Self-Test | Pending |
| VER-05 | Phase 6: Post-Build Governance & Self-Test | Pending |
| VER-06 | Phase 6: Post-Build Governance & Self-Test | Pending |
| VER-07 | Phase 6: Post-Build Governance & Self-Test | Pending |

### Requirement Family Summary

| Family | Count | Phase(s) | Notes |
|--------|-------|----------|-------|
| DEV | 4 | All phases | New — TDD development process mandate |
| TMPL | 13 | Phase 1 | +TMPL-13 (steering.md) |
| VAL | 5 | Phase 1 | |
| CLI | 16 | Phases 1, 3, 4, 5, 6 | +CLI-13/14/15 (preset, steering), +CLI-16 (security check) |
| PRST | 14 | Phases 1, 6 | PRST-01–07/12–14 Phase 1; PRST-08–11 Phase 6 |
| LIFE | 6 | Phase 1 | |
| GSD | 7 | Phase 1 | |
| SEC | 7 | Phase 1 | |
| INST | 8 | Phase 1 | |
| OPS | 14 | Phases 1, 2, 3 | |
| WKFL | 16 | Phases 2, 3, 6 | +WKFL-02a/b/c (tri-modal) |
| AGNT | 9 | Phases 2, 3, 6 | +AGNT-08 (steering load), +AGNT-09 (routing summary) |
| ROUTE | 2 | Phase 1 | Automatic task classification and local preprocessing |
| EFF | 5 | Phase 1 | Default effort ceilings and command-class caps |
| DELTA | 3 | Phases 1, 2 | Delta-context packets and section-level regeneration |
| TRIG | 3 | Phases 2, 4, 6 | Trigger-based deep governance and escalation control |
| USG | 4 | Phases 4, 5 | Usage reporting, reasoning, and waste detection |
| FRAG | 9 | Phase 2 | New — knowledge fragments |
| ENF | 14 | Phases 3, 4 | |
| MET | 12 | Phase 4 | |
| SESS | 6 | Phase 5 | |
| TERR | 15 | Phase 6 | |
| VER | 7 | Phase 6 | |
| **Total v1** | **220** | 6 phases | +33 from audit, +4 DEV (TDD mandate), +5 ROUTE/EFF/DELTA/TRIG/USG families |

### Traceability Rules

- **TRACE-01**: every active requirement must have phase ownership
- **TRACE-02**: every protected test must map to a requirement or invariant
- **TRACE-03**: every decision-log entry affecting behavior must map to a requirement, invariant, or acceptance criterion
- **TRACE-04**: `terrace audit` surfaces unmapped requirements
- **TRACE-05**: ROUTE, EFF, DELTA, TRIG, and USG are introduced in this revision and will be finalized in the next roadmap re-run if their phase rows are still pending

---

## 23. Coverage Snapshot

**v1 requirement families included:**  
DEV, TMPL, VAL, CLI, PRST, FRAG, ENF, WKFL, AGNT, ROUTE, EFF, DELTA, TRIG, USG, SESS, GSD, OPS, TERR, INST, VER, SEC, LIFE, MET

**Total v1 requirements:** 220 across 6 phases

**Current status:**  
- Requirements defined: yes
- Artifact schemas defined: yes
- Lifecycle model defined: yes
- Edge-case handling defined: yes
- Terrace self-test requirements defined: yes
- GSD modification policy defined: yes
- Preset system defined: yes
- Knowledge fragment system defined: yes
- Effort routing and usage intelligence defined: yes
- Steering file defined: yes
- Tri-modal workflow architecture defined: yes
- Source-donor audit complete: yes (see `.planning/research/SOURCE-DONOR-AUDIT.md`)
- Phase-family traceability defined: yes
- Detailed roadmap mapping: pending — 220 v1 requirements, roadmap to be re-run

---

*Requirements defined: 2026-04-05*  
*Revised: 2026-04-05 — second revision incorporating source-donor audit findings and automatic effort routing: added preset system (PRST), knowledge fragment system (FRAG), steering file (TMPL-13), tri-modal workflow architecture (WKFL-02a/b/c), preset CLI commands (CLI-13–15), AGNT-08/09, and ROUTE/EFF/DELTA/TRIG/USG families.*  
*Total v1 requirements: 220 across 23 families.*
