# Roadmap: Terrace

## Overview

Terrace builds an automatic effort router with built-in usage intelligence on top of a GSD fork. Seven phases progress from a proven walking skeleton (Phase 0) through a complete installation and template infrastructure (Phase 1), route-aware governance workflows (Phase 2), baseline protection and local enforcement (Phase 3), decision logging and usage reporting (Phase 4), delta-based session continuity (Phase 5), and trigger-based adversarial review with self-test hardening (Phase 6).

**Sequencing principle:** prove the core governance loop before building the full surface area, but keep the default path cheap. Phase 0 runs Terrace end-to-end on four real fixture repos with minimal implementations. Only then does Phase 1 build the full infrastructure on top of the proven skeleton. Each subsequent phase produces artifacts consumed by the next. No phase begins until its dependencies are on disk and working.

**Anti-bureaucracy principle:** Terrace blocks silent drift, not legitimate progress. Every enforcement gate has an explicitly logged override path, but routine work should stay on the low-effort path by default. Policy modes are internal safety rails; the user-facing experience is automatic routing to the cheapest safe effort.

---

## Phases

**Phase Numbering:**
- Integer phases (0, 1, 2, 3…): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 0: Bootstrap MVP** — Walking skeleton: minimal governance loop proven end-to-end on four fixture repos
- [ ] **Phase 1: Foundation** — Full template set, CLI scaffold, install infrastructure, lifecycle schema, routing policy, usage intelligence, GSD integration policy, and security model
- [ ] **Phase 2: Governance Workflows** — Intake through test architecture workflows, agents, tiered knowledge fragment system, and route-aware escalation
- [ ] **Phase 3: Baseline Protection & Enforcement** — Baseline builder agent, protect/status CLI, pre-commit hook, trigger-based enforcement, and local enforcement
- [ ] **Phase 4: Decision Log, Audit & CI** — Decision log CLI, usage reporting, full spec validate, audit command, and CI enforcement gates
- [ ] **Phase 5: Session Protocol & Lifecycle** — Session start/end CLI, SESSION.md artifacts, delta-based reconstruction, spec hash alerting, and phase transitions
- [ ] **Phase 6: Post-Build Governance & Self-Test** — Triggered adversarial review, regression capture, Terrace self-tests, schema versioning, and advanced presets

---

## Development Approach

Terrace is built test-first. Every plan in every phase writes tests before writing implementation code — no production code is committed without a prior failing test. This is non-negotiable: the framework must govern itself by the same principles it enforces on target repos.

**In practice:**
- Each plan begins with test stubs or acceptance tests derived from the phase success criteria
- Implementation proceeds only after a failing test exists for the behavior being built
- In multi-phase execution, RED is measured on the phase-delta test slice; prior-phase baseline tests are expected to stay GREEN unless intentionally changed
- A plan is not complete until all tests pass and no implementation exists without a corresponding test

---

## Policy Modes

Terrace enforces governance without blocking legitimate work. Four modes adapt enforcement intensity to repo maturity and task type, but they are internal policy states rather than the primary UX. Mode is set in `.terrace/policy.json` and recorded in `project-state.json`.

| Mode | Enforcement | Override | Use case |
|------|-------------|----------|----------|
| `lightweight` | Artifacts installed, no gates active | N/A | New repos, exploration, first install |
| `standard` | Core gates active, override with logged rationale | Decision-log entry required | Active development |
| `strict` | All gates active, no bypass without decision-log entry | Decision-log entry + explicit scope | Mature repos, compliance environments |
| `recovery` | Gates suspended, time-boxed, auto-expiry | Expiry date required in policy.json | Migrations, broken installs, messy states |

**Recovery mode rules:**
- Requires explicit expiry date in `policy.json`; Terrace warns on every session start while active
- On expiry, reverts to the mode that was active before recovery was entered
- All actions taken during recovery mode are logged in session artifacts
- Cannot be extended without a new decision-log entry explaining why

**Anti-bureaucracy stance encoded in enforcement design:**
- Blocking protections cannot be silently bypassed — but they can always be explicitly overridden with logged rationale
- False-positive rate is a first-class metric (see Operator-Cost Metrics); enforcement that blocks work it shouldn't blocks is a bug
- Override, deferral, and escape-hatch paths must be at least as visible as the block itself
- `recovery` mode exists precisely so that Terrace never forces users to corrupt state or bypass version control to get work done in messy situations
- Routine commands should remain low-effort even when enforcement is strict; escalation is signal-driven, not mood-driven

---

## Human Override Philosophy

Terrace governs responsibly. The governance model is not designed to prevent overrides — it is designed to make overrides legible.

**Principles:**

1. **Blocks are not bans.** Every enforcement gate has a supported override path. If no override path exists, the enforcement is a design defect.

2. **Overrides are visible.** Every override leaves a decision-log entry that names what was bypassed, why, and for how long. No silent bypasses, no `--no-verify` equivalents without a trace.

3. **Deferral is a first-class action.** A developer who cannot resolve a blocking issue must be able to defer it explicitly — with a linked future-phase assignment — rather than being forced to corrupt state.

4. **Escape hatches are honest.** `recovery` mode is a legitimate operational state, not a failure state. Entering it with an expiry date is preferable to working around enforcement invisibly.

5. **Critical protections cannot be silently disabled.** Policy modes can weaken enforcement, but the fact that protections are weakened must be visible in both the policy file and session output.

6. **Governance exists to reduce drift, not to enforce process.** If Terrace is blocking work that should be allowed, the right fix is usually policy configuration, a routing rule update, or a REQUIREMENTS.md amendment — not a workaround.

---

## Artifact Hierarchy

Not all artifacts are equal. This hierarchy prevents duplication, clarifies what is authoritative, and prevents secondary artifacts from being treated as sources of truth.

### Source Artifacts (primary — authoritative)

These artifacts are never derived from each other. When they conflict, humans resolve the conflict explicitly.

| Artifact | Role |
|----------|------|
| `docs/prd/PRD.md` | Intent source — what the product is meant to do |
| `docs/spec/COMPILED-SPEC.md` | Behavioral source — what the system must do, precisely |
| `docs/testing/TEST-ARCH.md` | Enforcement source — which behaviors are test-covered and at what risk tier |
| `docs/spec/DECISION-LOG.md` | Exception/change source — why behavioral truth was modified and by whom |
| `.planning/sessions/SESSION.md` | Continuity source — current project state for cold-start reconstruction |

### Derived Artifacts (supporting — generated from source artifacts)

These artifacts are created by workflows or agents reading source artifacts. They may be regenerated. Human edits are preserved but may be overwritten on re-generation unless explicitly protected.

| Artifact | Derived from |
|----------|-------------|
| `docs/prd/ACCEPTANCE-CRITERIA.md` | PRD.md + COMPILED-SPEC.md |
| `docs/prd/EDGE-CASES.md` | PRD.md + interrogation rounds |
| `docs/spec/INVARIANTS.md` | COMPILED-SPEC.md |
| `docs/spec/PERMISSIONS-MATRIX.md` | COMPILED-SPEC.md |
| `docs/spec/STATE-MACHINES.md` | COMPILED-SPEC.md |
| `docs/spec/REGRESSIONS.md` | Adversarial review + COMPILED-SPEC.md |
| `docs/testing/COVERAGE-PLAN.md` | TEST-ARCH.md |
| `.terrace/baseline-registry.json` | TEST-ARCH.md + `terrace baseline protect` |
| `.terrace/project-state.json` | `terrace phase set` + session commands |

### Optional / Advanced Artifacts (phase-gated or preset-dependent)

These artifacts exist only when their governing phase or preset is active. They should not be assumed present by early-phase logic.

| Artifact | Gated by |
|----------|----------|
| `docs/prd/CLARIFICATIONS.md` | Phase 2 (interrogation output) |
| `docs/spec/DOMAIN-GLOSSARY.md` | Phase 2 optional; preset or explicit request |
| `docs/testing/PROTECTED-TESTS-POLICY.md` | Phase 3; `policy.json` is primary |
| Preset-specific fragments and config | Phase 6 presets (terrace-tea, terrace-mutation, terrace-ui, terrace-security) |

**Invariant:** downstream agents (researcher, planner, executor) that read a governance artifact must check whether it is a source or derived artifact before treating it as authoritative. COMPILED-SPEC.md is always authoritative; REGRESSIONS.md may be stale if adversarial review has not run.

---

## Operator-Cost Metrics

Behavioral correctness alone is not enough. These metrics are treated as product constraints, not nice-to-haves. Targets are validated in Phase 0 (baseline) and verified across subsequent phases.

| ID | Metric | Target |
|----|--------|--------|
| MET-ERG-01 | `terrace init` cold-start time in clean repo | < 30 seconds |
| MET-ERG-02 | Full intake → compiled-spec workflow time on real feature request | < 10 minutes |
| MET-ERG-03 | False-positive enforcement rate (blocks that should not have blocked) | < 5% over 30-day window |
| MET-ERG-04 | Recovery time from blocked commit to unblocked state | < 5 minutes with documented path |
| MET-ERG-05 | Cold-start reconstruction: agent resumes work from SESSION.md without user providing context | 100% success rate on fixture repos |
| MET-ERG-06 | Agent context per governance workflow step (with fragment system active) | < 15 000 tokens |
| MET-ERG-07 | Fragment conditional loading: context reduction vs loading all fragments | ≥ 40% reduction (FRAG-04) |
| MET-ERG-08 | Explore / inspect / usage commands run at low effort by default | 100% of the time unless explicitly escalated |
| MET-ERG-09 | `terrace usage` identifies repeated expensive workflows and overfiring deep passes | Top 3 waste sources surfaced |

> **REQUIREMENTS.md note:** MET-ERG-01 through MET-ERG-09 are not yet in REQUIREMENTS.md. These metrics should be added to §3 (Success Metrics) before Phase 2 planning begins.

---

## Phase Details

### Phase 0: Bootstrap MVP

**Goal**: The core governance loop is proven end-to-end in four real, messy fixture repos before the full infrastructure is built. A walking skeleton delivers: minimal `terrace init`, five source artifact templates, minimal intake → validate → baseline → session workflow, and a complete run against each fixture repo. Phase 0 exists to validate the value proposition, not to build the full product.

**Depends on**: Nothing (first phase)

**Fixture repos (required by Phase 0):**
- `fixtures/ts-monorepo` — TypeScript monorepo (multi-package workspace)
- `fixtures/script-repo` — small script repo (no framework, no test runner)
- `fixtures/no-tests` — repo with no existing tests
- `fixtures/gsd-modified` — repo with preexisting GSD configuration

**What Phase 0 builds (minimal, not final):**
- Minimal `terrace-tools.cjs`: init, validate-source, baseline-protect, session-start, session-end
- Five source artifact templates only: PRD.md, COMPILED-SPEC.md, TEST-ARCH.md, DECISION-LOG.md, SESSION.md
- Minimal `terrace init`: creates `.terrace/` skeleton and `docs/` directories; installs five templates
- Minimal `terrace spec validate`: validates presence and required sections of source artifacts only
- Minimal `terrace baseline protect`: writes entry to `baseline-registry.json` with spec_ref
- Minimal `terrace session start` and `terrace session end`: writes and appends SESSION.md

**What Phase 0 explicitly defers to Phase 1:**
- Derived artifact templates (8 of the 13 total)
- Full CLI surface (doctor, preset, steering, phase-set, migrate, audit, decision-log)
- Preset registry
- Pre-commit hook
- Security model documentation
- Full lifecycle schema validation

**Requirements**: TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05, TMPL-12, TERR-10, TERR-11 (partial), OPS-08, OPS-09

**Success Criteria** (what must be TRUE):
1. `terrace init` runs without error on all four fixture repos, creates `.terrace/` with minimal schema and `docs/` with five source artifact templates, and prints a manifest of every file created or skipped
2. The five source artifact templates (PRD.md, COMPILED-SPEC.md, TEST-ARCH.md, DECISION-LOG.md, SESSION.md) exist on disk with correct section structure matching their schema definitions
3. `terrace spec validate` runs on all four fixture repos and correctly distinguishes missing-file errors from malformed-content warnings for source artifacts
4. `terrace baseline protect <file> --spec-ref <ID>` writes a valid entry to `baseline-registry.json` and refuses to register without a valid spec_ref — verified on the ts-monorepo and no-tests fixtures
5. `terrace session start` and `terrace session end` produce a SESSION.md on disk with sufficient content to identify current phase, active slice, files changed, and next steps — demonstrated on all four fixture repos
6. A complete end-to-end run (init → intake → validate → baseline protect → session start → session end) completes on the ts-monorepo fixture without manual file repair and within the MET-ERG-02 time budget

**Plans**: 4 plans

Plans:
- [ ] 00-01-PLAN.md — RED test stubs for all Phase 0 requirements and fixture repo scaffolds (phase-delta RED, TDD wave 1)
- [ ] 00-02-PLAN.md — Minimal `terrace-tools.cjs` bootstrap + five source artifact templates + minimal `terrace init` (TDD wave 2)
- [ ] 00-03-PLAN.md — Minimal intake workflow, `terrace spec validate` (source artifacts), `terrace baseline protect`, `terrace session start/end` (TDD wave 2)
- [ ] 00-04-PLAN.md — End-to-end loop validation on all four fixture repos + GREEN full Phase 0 suite (TDD wave 3)

---

### Phase 1: Foundation

**Goal**: The full installable skeleton exists — all 13 governance artifact templates defined (including `steering.md` and all derived templates), the complete CLI scaffold runs, the preset registry infrastructure is in place, the lifecycle schema is machine-readable with transition validation, the routing policy and usage-intelligence surfaces exist, the GSD modification policy is established, the security trust model is documented, and `terrace init` completes cleanly in all four fixture repos.

**Depends on**: Phase 0

**What changed from original:**
- Now depends on Phase 0 (Phase 0 provides the proven skeleton this phase fills out)
- Fixture repo validation added to success criteria (Phase 0 proved the loop; Phase 1 must maintain it across the full install surface)
- 6 existing plans unchanged in structure

**Requirements**: TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05, TMPL-06, TMPL-07, TMPL-08, TMPL-09, TMPL-10, TMPL-11, TMPL-12, TMPL-13, VAL-01, VAL-02, VAL-03, VAL-04, VAL-05, CLI-07, CLI-10, CLI-12, CLI-13, CLI-14, CLI-15, INST-01, INST-02, INST-03, INST-04, INST-05, INST-06, INST-07, INST-08, GSD-01, GSD-02, GSD-03, GSD-04, GSD-05, GSD-06, GSD-07, SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07, LIFE-01, LIFE-02, LIFE-03, LIFE-04, LIFE-05, LIFE-06, PRST-01, PRST-02, PRST-03, PRST-04, PRST-05, PRST-06, PRST-07, PRST-12, PRST-13, PRST-14, OPS-08, OPS-09, OPS-10, OPS-11, OPS-12, OPS-13, OPS-14

**Success Criteria** (what must be TRUE):
1. All 13 governance artifact templates exist on disk with correct section and schema structure — PRD.md, COMPILED-SPEC.md, TEST-ARCH.md, DECISION-LOG.md, SESSION.md, INVARIANTS.md, ACCEPTANCE-CRITERIA.md, PERMISSIONS-MATRIX.md, EDGE-CASES.md, STATE-MACHINES.md, REGRESSIONS.md, project-state.json, and steering.md
2. `terrace init` completes without error on all four Phase 0 fixture repos (clean, GSD-modified, no-tests, script-repo), does not modify existing GSD files silently, and reports exactly what was created or changed; MET-ERG-01 (< 30 seconds) is met
3. `.terrace/project-state.json` exists with current phase, spec hash, active slice, last session, and policy mode; `terrace phase set <phase>` updates the value after validating the transition is legal
4. `terrace spec validate` runs against all 13 governance artifacts and distinguishes blocking errors from warnings; `terrace doctor` diagnoses broken installs, missing files, and hook conflicts with explicit remediation steps
5. The security and GSD-integration constraints are encoded in config or documentation: Terrace lists what files it may touch, modifications to GSD files are recorded, and any GSD file that cannot be safely patched causes an explicit failure with remediation guidance rather than silent partial corruption
6. `.terrace/presets/registry.json` exists with the correct schema, `terrace preset install` is idempotent and surfaces conflicts rather than silently overwriting, and `terrace steering` opens or creates `.terrace/steering.md` with the project constitution template

**Plans**: 6 plans

Plans:
- [ ] 01-01-PLAN.md — Project scaffold and RED test stubs for all Phase 1 requirements (phase-delta RED, Wave 1, TDD)
- [ ] 01-02-PLAN.md — All 12 Markdown governance artifact templates and 2 JSON schemas (Wave 2)
- [ ] 01-03-PLAN.md — CLI entry point, shared core utilities, and terrace init implementation (Wave 2)
- [ ] 01-04-PLAN.md — GSD pattern documentation, security model, and terrace doctor diagnostics (Wave 2)
- [ ] 01-05-PLAN.md — Phase lifecycle validator and preset registry manager (Wave 3)
- [ ] 01-06-PLAN.md — Spec validate module (full 13-artifact surface) and full-suite GREEN verification (Wave 3)

---

### Phase 2: Governance Workflows

**Goal**: The four pre-build governance workflows are operational — intake, interrogation, spec compilation, and test architecture — each using tri-modal architecture (Create/Edit/Validate) with step-file chaining, backed by dedicated agents that load tiered knowledge fragments and can run end-to-end on a real feature request; unresolved assumptions and fast-mode paths are explicitly handled; routing signals keep deep passes trigger-based instead of default; all three agents (spec-interrogator, spec-compiler, test-architect) are fully defined with fragment indexes.

**Depends on**: Phase 1

**What changed from original:**
- AGNT-03 (`terrace-test-architect`) moved here from Phase 3 — it is a pre-build governance agent and belongs with the other governance agents
- WKFL-06 (Test Architecture workflow) moved here from Phase 3 for the same reason
- Fragment system (FRAG-01–09) now has explicit plan coverage
- Skeletal plan structure added (was TBD)
- MET-ERG-06/07 (context budget and fragment reduction) are success criteria

**Requirements**: WKFL-01, WKFL-02, WKFL-02a, WKFL-02b, WKFL-02c, WKFL-03, WKFL-04, WKFL-05, WKFL-06, AGNT-01, AGNT-02, AGNT-03, AGNT-07, AGNT-08, FRAG-01, FRAG-02, FRAG-03, FRAG-04, FRAG-05, FRAG-06, FRAG-07, FRAG-08, FRAG-09, OPS-01, OPS-02, OPS-03, OPS-04

**Success Criteria** (what must be TRUE):
1. Running the Intake workflow on a plain-English request produces `docs/prd/PRD.md` conforming to TMPL-01; when no PRD exists, Terrace creates a provisional PRD from a user request without requiring manual scaffolding (OPS-01)
2. Running the Interrogation workflow uses tri-modal architecture (Create/Edit/Validate) with step-file chaining — each step file names the next, enabling resume from any interrupted step; when the user declines interrogation, a fast-mode assumption path records unresolved assumptions explicitly (WKFL-02, WKFL-02a/b/c, WKFL-03, OPS-02)
3. Running the Spec Compilation workflow spawns `terrace-spec-compiler` and produces `docs/spec/COMPILED-SPEC.md` with required YAML frontmatter; it updates INVARIANTS.md, PERMISSIONS-MATRIX.md, and STATE-MACHINES.md when relevant (WKFL-04, WKFL-05); formatting-only changes do not trigger behavioral drift warnings (OPS-03/04)
4. Running the Test Architecture workflow spawns `terrace-test-architect` and produces `docs/testing/TEST-ARCH.md` mapping each requirement to a test layer with P0–P3 risk score and CI tier assignment (WKFL-06)
5. Every agent definition (spec-interrogator, spec-compiler, test-architect) includes all AGNT-07 fields; every agent loads `.terrace/steering.md` as the first context item before any workflow step (AGNT-08)
6. Each governance agent has a `fragment-index.json` cataloguing core/extended/specialized fragments; fragment conditional loading reduces agent context by ≥ 40% vs loading all fragments, and per-step context stays within MET-ERG-06 budget (FRAG-01–09)

**Plans**: 6 plans

Plans:
- [ ] 02-01-PLAN.md — RED test stubs for all Phase 2 requirements; fragment-index.json schema and AGNT-07 contract tests (phase-delta RED, TDD wave 1)
- [ ] 02-02-PLAN.md — Agent definition framework: AGNT-07/08 base contract, steering.md loader, fragment-index.json schema and runtime loader; `core` tier loads unconditionally (TDD wave 2)
- [ ] 02-03-PLAN.md — `terrace-spec-interrogator` agent: fragment set (FRAG-06), tri-modal Interrogation workflow with step-file chaining, fast-mode path, unresolved-assumptions logging (WKFL-02, 02a/b/c, WKFL-03) (TDD wave 2)
- [ ] 02-04-PLAN.md — `terrace-spec-compiler` agent: fragment set (FRAG-07), Spec Compilation workflow with tri-modal architecture, derived artifact updates (WKFL-04/05), spec hash computation excluding non-semantic changes (OPS-03/04) (TDD wave 2)
- [ ] 02-05-PLAN.md — Intake workflow (WKFL-01, OPS-01) + `terrace-test-architect` agent: fragment set (FRAG-08), Test Architecture workflow (WKFL-06) with P0–P3 risk scoring and CI tier assignment (TDD wave 2)
- [ ] 02-06-PLAN.md — Fragment conditional loading (extended/specialized tiers), MET-ERG-06/07 validation, full Phase 2 GREEN suite on ts-monorepo fixture (TDD wave 3)

---

### Phase 3: Baseline Protection & Enforcement

**Goal**: Test files can be registered as protected against the spec; the pre-commit hook enforces that protection locally; `terrace baseline status` surfaces coverage gaps; renamed or deleted protected files produce blocking warnings rather than silent breakage; all four policy modes are implemented and tested; recovery mode is a first-class operational state.

**Depends on**: Phase 2

**What changed from original:**
- AGNT-03 and WKFL-06 moved to Phase 2 (where they belong as pre-build governance components)
- Recovery mode added as a new first-class policy mode (lightweight/standard/strict/recovery)
- Policy mode tests now include recovery mode behavior
- Skeletal plan structure added (was TBD)

**Requirements**: WKFL-07, WKFL-08, AGNT-04, CLI-03, CLI-04, ENF-01, ENF-02, ENF-03, ENF-04, ENF-05, ENF-06, ENF-07, OPS-05, OPS-06, OPS-07, SEC-05, SEC-07, TERR-04, TERR-05, TERR-06

**Success Criteria** (what must be TRUE):
1. `terrace baseline protect <file> --spec-ref <SPEC-ID>` writes an entry to `.terrace/baseline-registry.json` with spec_ref, locked_at, policy_flags, and optional severity; refuses registration without a valid spec_ref (CLI-03, ENF-04)
2. `terrace baseline status` cross-references the registry against TEST-ARCH.md and prints a gap report identifying protected tests with no spec_ref, requirements lacking a protected anchor, and registered files missing from disk (CLI-04)
3. Committing a change to a registered protected test file without a matching decision log entry causes the pre-commit hook to block the commit; the error message names exactly what is missing and how to resolve it (ENF-01, ENF-07, ENF-09)
4. `.terrace/policy.json` implements all four policy modes (lightweight/standard/strict/recovery); recovery mode requires an expiry date, warns on every session start while active, reverts automatically on expiry, and logs all actions taken during recovery to session artifacts (ENF-03, ENF-06, SEC-05, SEC-07)
5. Renamed protected files surface a blocking warning; deleted protected files block phase completion until replaced, deregistered with rationale, or explicitly deferred; conflicting exclusive anchors surface a conflict error (OPS-05, OPS-06, OPS-07)

**Plans**: 5 plans

Plans:
- [ ] 03-01-PLAN.md — RED test stubs for all Phase 3 requirements; policy mode test matrix setup (phase-delta RED, TDD wave 1)
- [ ] 03-02-PLAN.md — `terrace-baseline-builder` agent (AGNT-04): purpose, allowed outputs, forbidden actions, handoff; WKFL-07 Protected Baseline workflow producing foundational test registrations (TDD wave 2)
- [ ] 03-03-PLAN.md — `terrace baseline protect` (CLI-03) + `terrace baseline status` (CLI-04); `baseline-registry.json` schema; ENF-01–05 pre-commit hook with explicit error messages (TDD wave 2)
- [ ] 03-04-PLAN.md — All four policy modes in `policy.json` (ENF-03, ENF-06); recovery mode expiry, revert, and session-log behavior; SEC-05/07 policy mode documentation; OPS-05/06/07 rename/delete/conflict handling (TDD wave 2)
- [ ] 03-05-PLAN.md — WKFL-08 implementation gate enforcement; enforcement test suite (TERR-04/05/06); full Phase 3 GREEN suite on all four fixture repos (TDD wave 3)

---

### Phase 4: Decision Log, Audit & CI

**Goal**: Behavioral changes to protected files require a logged decision entry with explicit rationale; `terrace audit` generates a governance health report; `terrace usage` surfaces repeated expensive workflows and overfiring passes; CI enforcement gates run independently of local hook presence; all success metrics (MET-01–12) and ergonomics metrics (MET-ERG-01–07) are tracked.

**Depends on**: Phase 3

**What changed from original:**
- Ergonomics metrics (MET-ERG-01–07) added to success criteria
- Skeletal plan structure added (was TBD)

**Requirements**: CLI-05, CLI-06, CLI-08, ENF-08, ENF-09, ENF-10, ENF-11, ENF-12, ENF-13, ENF-14, MET-01, MET-02, MET-03, MET-04, MET-05, MET-06, MET-07, MET-08, MET-09, MET-10, MET-11, MET-12

**Success Criteria** (what must be TRUE):
1. `terrace decision log` creates a new DECISION-LOG.md entry with spec_ref pre-filled, date auto-populated, and all TMPL-04 fields present; a protected-test commit is blocked unless the entry explicitly references the same spec_ref as the protected file (CLI-05, ENF-08)
2. `terrace spec validate` detects missing requirement references, missing spec_refs, missing protected-test metadata, and artifact freshness issues; enforcement warnings name exactly what is missing and how to resolve it (CLI-06, ENF-09)
3. `terrace audit` generates a coverage report surfacing: requirements with no test coverage, protected tests with no spec_ref, decision-log entries with no spec_ref, and stale session/spec state; the report distinguishes blocking from advisory issues (CLI-08, MET-11, MET-12)
4. CI enforcement checks spec-sensitive changes updated corresponding artifacts, checks protected registry integrity, and runs independently of whether a local pre-commit hook is installed (ENF-11–14, MET-08)
5. All MET-01–12 targets are measurable against the ts-monorepo fixture; all MET-ERG-01–07 targets are validated against the workflow timing and false-positive data collected during Phase 3 and Phase 4 runs

**Plans**: 4 plans

Plans:
- [ ] 04-01-PLAN.md — RED test stubs for all Phase 4 requirements; metrics tracking scaffold (phase-delta RED, TDD wave 1)
- [ ] 04-02-PLAN.md — `terrace decision log` CLI (CLI-05): DECISION-LOG.md integration, spec_ref pre-fill, ENF-08–10 protected-test link enforcement (TDD wave 2)
- [ ] 04-03-PLAN.md — `terrace spec validate` full implementation (CLI-06): all 13 artifacts, drift detection, freshness checking; `terrace audit` (CLI-08): coverage report, severity classification (TDD wave 2)
- [ ] 04-04-PLAN.md — CI enforcement gate (ENF-11–14): standalone CI mode, artifact integrity check; MET-ERG baseline validation; full Phase 4 GREEN suite (TDD wave 3)

---

### Phase 5: Session Protocol & Lifecycle

**Goal**: Every session starts with a cheap, delta-based context snapshot from repo artifacts and ends with a recorded handoff; phase transitions are validated and recorded; Terrace can reconstruct project state from repo artifacts with no prior chat history — demonstrated against all four fixture repos.

**Depends on**: Phase 1, Phase 3, Phase 4

**What changed from original:**
- Cold-start reconstruction validated explicitly against all four fixture repos (not just described as a goal)
- Skeletal plan structure added (was TBD)

**Requirements**: CLI-01, CLI-02, CLI-09, SESS-01, SESS-02, SESS-03, SESS-04, SESS-05, SESS-06, TERR-11 (full)

**Success Criteria** (what must be TRUE):
1. `terrace session start` reads current spec hash, phase, active slice, policy mode, and last decision log entry; writes a SESSION.md to `.planning/sessions/`; prints an alert if spec hash differs from previous session hash; MET-ERG-01 (< 30 seconds) met (CLI-01, SESS-01, SESS-02)
2. `terrace session end` appends to active SESSION.md: decisions made, files changed, behavioral truths added/modified, risks identified, protected-artifact changes, and next slice (CLI-02, SESS-03, SESS-06)
3. SESSION.md files are committed to the repo and contain enough context for a cold-start agent to reconstruct project state without prior chat history; MET-ERG-05 (100% success rate) demonstrated against all four fixture repos (SESS-04, SESS-05)
4. `terrace phase set <phase>` updates `project-state.json`, validates the transition is legal given current phase completion criteria, and records the transition in session artifacts (CLI-09, LIFE-04, LIFE-05)

**Plans**: 4 plans

Plans:
- [ ] 05-01-PLAN.md — RED test stubs for all Phase 5 requirements; cold-start reconstruction test harness against all four fixture repos (phase-delta RED, TDD wave 1)
- [ ] 05-02-PLAN.md — `terrace session start` (CLI-01): reads spec hash, phase, slice, policy mode, last decision-log entry; writes SESSION.md; hash-drift alert (SESS-01, SESS-02) (TDD wave 2)
- [ ] 05-03-PLAN.md — `terrace session end` (CLI-02): SESSION.md append with full SESS-03/06 fields; `terrace phase set` (CLI-09): transition validation, session recording (TDD wave 2)
- [ ] 05-04-PLAN.md — Cold-start reconstruction validation: repo-only context rebuild on all four fixture repos (SESS-05, TERR-11); MET-ERG-05 verification; full Phase 5 GREEN suite (TDD wave 3)

---

### Phase 6: Post-Build Governance & Self-Test

**Goal**: After each implementation phase, the adversarial verifier runs as a trigger-based hard gate; regressions are captured into the baseline; Terrace is tested as a framework against all four fixture repos; artifact schemas are versioned and migratable; four built-in presets are installable and working.

**Depends on**: Phase 3, Phase 4, Phase 5

**What changed from original:**
- Fixture repo validation is now a validation run (fixture repos were built in Phase 0); Phase 6 adds governance quality and self-test coverage over them
- Advanced presets (terrace-tea, terrace-mutation, terrace-ui, terrace-security) explicitly consolidated here — they are not core and should not be attempted before the governance core is trusted
- Skeletal plan structure added (was TBD)

**Requirements**: WKFL-09, WKFL-10, WKFL-11, WKFL-12, WKFL-13, AGNT-05, AGNT-06, CLI-11, CLI-16, PRST-08, PRST-09, PRST-10, PRST-11, TERR-01, TERR-02, TERR-03, TERR-04, TERR-05, TERR-06, TERR-07, TERR-08, TERR-09, TERR-10, TERR-11, TERR-12, TERR-13, TERR-14, TERR-15, VER-01, VER-02, VER-03, VER-04, VER-05, VER-06, VER-07

**Success Criteria** (what must be TRUE):
1. Running the Adversarial Review workflow spawns `terrace-verifier-adversary` and produces a gap list where each gap is classified as blocking or non-blocking and mapped to a SPEC-XX requirement; a phase cannot be marked complete while any blocking gap remains unresolved without a decision-log entry assigning it to a future phase (WKFL-09, WKFL-10, AGNT-05)
2. Running the Regression Capture workflow adds tests from adversarial-review findings to the baseline registry; the handoff workflow records current truth, remaining risks, and next slice in session artifacts; if implementation reveals spec errors, the workflow requires a spec update before marking work complete (WKFL-11, WKFL-12, WKFL-13, AGNT-06)
3. Terrace CLI commands and enforcement logic are covered by tests exercising success paths, failure paths, and all four policy mode variations; enforcement tests verify protected-test edits are blocked when required metadata is missing and allowed when rationale and references are valid (TERR-01–06)
4. Fixture-based tests validate session reconstruction, artifact validation, install behavior, and governance quality across all four fixture repos (TypeScript monorepo, script repo, no-tests repo, GSD-modified repo); all four test fixture repos pass the full governance suite (TERR-07–15)
5. `terrace migrate` upgrades old artifact formats without silently discarding user-authored content; outputs a clear before/after summary; Terrace artifact schemas carry version numbers so future migrations are mechanical rather than exploratory (VER-01–07, CLI-11)
6. `terrace-tea`, `terrace-mutation`, `terrace-ui`, and `terrace-security` presets are installable, register correctly in `.terrace/presets/registry.json`, do not conflict with each other, and `terrace security check` runs the full Semgrep + Trivy + OSV gate when `terrace-security` is installed (PRST-08–11, CLI-16)

**Plans**: 5 plans

Plans:
- [ ] 06-01-PLAN.md — RED test stubs for all Phase 6 requirements; full self-test harness scaffold across all four fixture repos (phase-delta RED, TDD wave 1)
- [ ] 06-02-PLAN.md — `terrace-verifier-adversary` agent (AGNT-05): fragment set (FRAG-09), Adversarial Review workflow (WKFL-09/10), gap severity classification, blocking-gap phase-gate (TDD wave 2)
- [ ] 06-03-PLAN.md — Regression Capture workflow (WKFL-11/12/13): baseline registration from adversarial findings; `terrace-maintainer-curator` agent (AGNT-06): decision-log, regression, and session-memory updates (TDD wave 2)
- [ ] 06-04-PLAN.md — `terrace migrate` schema versioning (CLI-11, VER-01–07); full Terrace self-test suite against all four fixture repos (TERR-01–15); governance quality validation (TERR-13–15) (TDD wave 2)
- [ ] 06-05-PLAN.md — Built-in presets: terrace-tea (PRST-08), terrace-mutation (PRST-09), terrace-ui (PRST-10), terrace-security (PRST-11, CLI-16); full Phase 6 GREEN suite (TDD wave 3)

---

## Progress

**Execution Order:**
Phases execute in numeric order: 0 → 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Bootstrap MVP | 0/4 | Not started | - |
| 1. Foundation | 0/6 | Not started | - |
| 2. Governance Workflows | 0/6 | Not started | - |
| 3. Baseline Protection & Enforcement | 0/5 | Not started | - |
| 4. Decision Log, Audit & CI | 0/4 | Not started | - |
| 5. Session Protocol & Lifecycle | 0/4 | Not started | - |
| 6. Post-Build Governance & Self-Test | 0/5 | Not started | - |

**Total planned**: 34 plans across 7 phases

---

## Structural Adjustments

Summary of architectural changes from the original roadmap:

### Added
- **Phase 0 (Bootstrap MVP)**: walking skeleton phase — proves the governance loop on four fixture repos before building the full infrastructure; 4 plans
- **Recovery policy mode**: `recovery` mode is a first-class operational state for migrations, broken installs, and messy repos; time-boxed with auto-expiry and session logging
- **Artifact hierarchy**: explicit source / derived / optional classification prevents secondary artifacts from being treated as authoritative sources
- **Human Override Philosophy**: encoded as a first-class framework stance; every block has a supported override path; overrides are logged, not silent
- **Operator-Cost Metrics (MET-ERG-01–07)**: ergonomics and cost treated as product constraints, validated in Phase 0 and tracked across phases
- **Skeletal plan structure for Phases 2–6**: all phases now have estimated plan counts, plan boundaries, and sequencing intent

### Moved
- **Fixture repo validation**: Phase 6 → Phase 0 (fixture repos built in Phase 0; Phase 6 runs full governance suite against them)
- **AGNT-03 (`terrace-test-architect`) and WKFL-06 (Test Architecture workflow)**: Phase 3 → Phase 2 — these are pre-build governance components, not enforcement components
- **Advanced presets (terrace-tea, terrace-mutation, terrace-ui, terrace-security)**: explicitly consolidated in Phase 6 with a clear statement that they are non-core and depend on the full governance stack being trusted

### Deferred (not removed)
- Full preset capability loading: Phase 1 scaffolds the preset registry; Phase 6 delivers the actual presets
- Schema migration tooling (`terrace migrate`): remains Phase 6
- Domain glossary, CLARIFICATIONS.md, PROTECTED-TESTS-POLICY.md: classified as optional/derived artifacts, not removed

### Preserved
- Test-first development mandate (non-negotiable, unchanged)
- All original requirements (no requirements deleted)
- Phase dependency chain (1→2→3→4→5→6, now 0→1→2→3→4→5→6)
- All governance ambition: spec, baseline, session, adversarial review, regression capture
- Agent architecture: fragment system, tri-modal workflows, step-file chaining
- steering.md as first context item for all agents

---

## Risk Controls

| Risk | Mitigation in revised structure |
|------|--------------------------------|
| Overengineering before proving value | Phase 0 forces end-to-end proof before full infrastructure is built; skeleton is minimal by design |
| Artifact proliferation and drift between artifacts | Artifact hierarchy explicitly classifies source vs derived vs optional; derived artifacts cannot override source artifacts |
| Bureaucracy blocking legitimate work | Recovery mode, explicit override paths, false-positive rate as tracked metric (MET-ERG-03) |
| TBD phases hiding roadmap flaws | All phases now have estimated plan counts, plan boundaries, and sequencing intent |
| Fragment system context bloat | MET-ERG-06/07 are success criteria; 40% reduction must be demonstrated, not assumed |
| Fixture testing too late to catch integration failures | Fixture repos built in Phase 0; all subsequent phases run against them |
| Phase 3 containing pre-build governance agents | AGNT-03 and WKFL-06 moved to Phase 2 where they belong |
| Recovery/migration scenarios leaving users stuck | Recovery mode is a first-class policy mode; `terrace doctor` provides explicit remediation paths |
| Preset complexity weighing down early phases | Presets consolidated in Phase 6; Phase 1 scaffolds registry only, no preset capability loading |
