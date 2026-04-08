# Terrace Source-Donor Repo Audit & Implementation Plan

**Written:** 2026-04-05  
**Purpose:** Comprehensive analysis of source-donor repos, non-cloned system integration, and revised implementation blueprint.  
**Status:** Replaces previous narrow scope. This is the authoritative research artifact.

---

## Executive Summary

Terrace's revised vision is not just a stronger TDD framework. It is **the strongest overall AI-assisted development governance framework**, with TDD as the differentiator that elevates it from good to great. The previous requirements doc (REQUIREMENTS.md) captured the governance layer correctly but was written before the full source-donor picture was clear.

**What changes:**

1. **BMAD TEA** brings a sophisticated testing OS that Terrace should not rebuild from scratch — it should integrate TEA's workflows as a Terrace preset and borrow its knowledge fragment architecture for Terrace's own agent context engineering.
2. **Spec Kit** provides the extension/preset architecture model that Terrace should adopt for its own modularity.
3. **StrykerJS** provides mutation testing as a quality gate — Terrace wraps it rather than reimplements it.
4. **Storybook** provides UI isolation and documented component states — Terrace adds a UI preset that wires Storybook into the governance lifecycle.
5. **Playwright** provides E2E and component testing — already covered by BMAD TEA's Playwright Utils integration; Terrace surfaces it through a preset.
6. The 14 non-cloned systems split into: security enforcement toolchain (Semgrep, Trivy, OSV, ZAP), standards/baselines (ASVS, OpenSSF, SLSA, Scorecard), contract testing (Pact), accessibility (axe-core), and conceptual inspirations (Kiro, Kiro Powers, OpenSpec, Ruflo).

**Core architecture decision:** Terrace = GSD spine + governance layer + preset system. Everything else enters through presets, not the core.

---

## Updated Source Classification

### Category 1: Source-Donor Repos (Clone and Mine)

| Repo | Role | Action |
|------|------|--------|
| `gsd-build/get-shit-done` | Orchestration spine, workflow engine, CLI pattern | Fork — already baseline |
| `bmad-code-org/bmad-method-test-architecture-enterprise` | Testing OS, risk strategy, ATDD, traceability, NFR assessment | Clone and study deeply — integrate as `terrace-tea` preset |
| `github/spec-kit` | Extension/preset architecture, spec-driven workflow model | Clone and study architecture — reimplement extension system clean-room |
| `stryker-mutator/stryker-js` | Mutation testing engine, mutation score quality gates | Wrap as external engine — integrate via `terrace-mutation` preset |
| `storybookjs/storybook` | UI isolation, story-driven testing, component documentation | Wrap as external tool — integrate via `terrace-ui` preset |
| `microsoft/playwright` | Browser automation, E2E, component testing | Wrap as external engine — surface through `terrace-tea` and `terrace-ui` presets |

### Category 2: Dependencies (Install and Shell Out)

| System | Terrace Entry Point |
|--------|-------------------|
| `pact-foundation/pact-js` | `terrace-tea` preset, contract testing layer |
| `dequelabs/axe-core` | `terrace-ui` preset, accessibility quality gate |
| `semgrep/semgrep` | `terrace-security` preset, pre-commit + CI |
| `aquasecurity/trivy` | `terrace-security` preset, CI scanner |
| `google/osv-scanner` | `terrace-security` preset, dependency gate |

### Category 3: Standards / Baselines (Map Against)

| System | Terrace Usage |
|--------|---------------|
| `OWASP/ASVS` | `terrace-security` preset maps controls to requirements |
| `ossf/security-baseline` | `terrace-security` preset audit checklist |
| `ossf/scorecard` | Release gate scoring in `terrace-security` preset |
| `slsa-framework/slsa` | Target provenance state for v2 release gating |

### Category 4: Conceptual Inspirations (Reimplement Clean-Room)

| System | What Terrace Takes |
|--------|-------------------|
| `kirodotdev/Kiro` | Steering files, hook system, structured rule layers |
| `kirodotdev/powers` | On-demand context packs (maps to Terrace knowledge fragments) |
| `Fission-AI/OpenSpec` | Optional UX reference check (v2) |
| `ruvnet/ruflo` | Future plugin/runtime governance reference (v2+) |

---

## Layer 1: Source-Donor Repo Audit

---

### 1. GSD (`gsd-build/get-shit-done`)

**Why it belongs:** Terrace is built on this fork. It is the execution spine.

**High-yield zones:**

- `workflows/` — orchestrator markdown files with XML-tagged steps. This IS the control flow pattern Terrace extends.
- `bin/gsd-tools.cjs` + `bin/lib/` — the only structured write path for state, phase, roadmap. Terrace's `terrace-tools.cjs` must follow the same pattern.
- `~/.claude/agents/gsd-*.md` — subagent definitions with YAML frontmatter. Terrace agents follow exactly this structure.
- `templates/` — file contract system. Terrace adds governance templates here.
- `.planning/config.json` — workflow preferences that Terrace extends with `.terrace/policy.json`.
- `references/` — shared knowledge snippets loaded on-demand. Terrace extends with governance references.

**Directly useful source patterns:**
- File-as-message-bus: agents communicate through files, not RPC. Non-negotiable.
- Workflow-as-orchestrator: markdown files ARE the control flow. Non-negotiable.
- CLI-as-structured-write-path: only `gsd-tools.cjs` writes to STATE.md fields. Terrace follows with `terrace-tools.cjs` for `.terrace/` files.
- Subagent isolation with path-passing (not content-passing) to keep orchestrator context lean.
- Template layer as file contracts.

**Useful architecture concepts:**
- YOLO vs interactive mode in config.json — Terrace mirrors with `strict/standard/lightweight` in policy.json.
- Agent skill registration in settings.json — Terrace's `terrace init` follows this.
- Commit discipline: atomic commits after each structured write.

**Things NOT to copy:**
- GSD's roadmap/phase model is not being replaced — Terrace governance phases (intake → interrogation → spec-compilation → ...) sit AROUND GSD's plan/execute phases.
- GSD's STATE.md content — Terrace governance state lives in `.terrace/project-state.json`, not in STATE.md.
- GSD's research agent prompts — Terrace's spec-interrogator and spec-compiler are different roles.

**Terrace-native concept emerging from GSD:**
- **Governance wrapper**: pre-build governance phases before Phase 1, post-build governance phases after the last execution phase.

**Recommended action:** Fork and treat as spine — already done. Never modify core GSD files; extend only.

---

### 2. BMAD TEA (`bmad-code-org/bmad-method-test-architecture-enterprise`)

**Why it belongs:** TEA is the most sophisticated open testing OS built on the same LLM-as-engine pattern as GSD. It solves exactly what Terrace needs for test architecture: risk-based strategy, ATDD, traceability, NFR assessment, release gates.

**High-yield zones:**

- `src/agents/bmad-tea/resources/tea-index.csv` — **the most important file in the repo**. 40 knowledge fragments, tiered (core/extended/specialized), with config flags controlling conditional loading. This is the pattern Terrace should adopt for ALL its governance agents.
- `src/agents/bmad-tea/resources/knowledge/` — the 40 fragments themselves. Directly useful: `risk-governance.md`, `test-priorities-matrix.md`, `test-levels-framework.md`, `test-quality.md`, `data-factories.md`, `fixture-architecture.md`, `network-first.md`, `contract-testing.md`, `component-tdd.md`.
- `src/workflows/testarch/bmad-testarch-atdd/` — ATDD workflow with tri-modal architecture (Create/Edit/Validate). The `steps-c/` step-file chain is exactly the pattern Terrace's governance workflows should follow for the interrogation and spec-compilation phases.
- `src/workflows/testarch/bmad-testarch-trace/` — requirement-to-test traceability workflow. Maps directly to Terrace's test architecture and baseline protection phases.
- `src/workflows/testarch/bmad-testarch-test-design/` — risk-based test design. Maps to Terrace's test architecture phase.
- `src/module.yaml` — config flag system (`tea_use_playwright_utils`, `tea_use_pactjs_utils`, etc.). This is how Terrace presets should define their own flags.
- `src/workflows/testarch/bmad-testarch-ci/` — CI quality pipeline setup. Feeds Terrace's ENF-08/11/12/14 requirements.

**Directly useful source patterns:**
- **Tiered knowledge index (tea-index.csv)**: Terrace governance agents should each have their own index of knowledge fragments. Context engineering — not everything needs to be in context always.
- **Tri-modal workflow architecture (Create/Edit/Validate)**: Every Terrace governance workflow (interrogation, spec-compilation, test architecture, adversarial review) should offer Create/Edit/Validate modes.
- **Step-file chaining**: The `nextStepFile:` pattern keeps large workflows resumable and context-lean. Terrace governance workflows should use this for any workflow over 3 steps.
- **Subagent isolation with JSON handoff**: Heavy TEA workflows spawn subagents that write JSON to temp files. Terrace should do the same for parallel interrogation rounds and adversarial review.
- **P0-P3 risk prioritization**: Terrace's test architecture phase should assign priorities using the same P0-P3 scale.
- **Release gate logic**: TEA's `bmad-testarch-trace/` workflow produces a go/no-go gate decision. Terrace's adversarial review workflow should produce the same.

**Useful architecture concepts:**
- TEA is installable as a BMad module — Terrace should be installable as a GSD extension following the same model.
- `module.yaml` config flags drive conditional behavior at workflow level. Terrace policy.json is the equivalent.

**Interesting but non-essential:**
- TEA Academy (Teach Me Testing) — useful for documentation but not core to Terrace's governance function.
- TEA's NFR assessment workflow — valuable but v1.5 material.
- Playwright Utils MCP integration — future state.

**Things Terrace should NOT copy:**
- TEA's CLI (it's BMad-specific). Terrace has its own CLI.
- TEA's SKILL.md persona (Murat). Terrace agent definitions have their own identity.
- The BMad installer machinery. Terrace uses its own `terrace init`.

**Terrace-native concepts emerging from BMAD TEA:**
- **`terrace-tea` preset**: bundles TEA's test design + ATDD + traceability + CI workflows as an installable Terrace capability pack.
- **Knowledge fragment system**: every Terrace governance agent has a `fragments/` directory and a `fragment-index.csv` that enables tiered context loading.
- **Risk matrix**: Terrace's test architecture artifact includes P0-P3 risk scoring, not just test-layer assignment.

**Recommended action:** Clone and study deeply. Integrate test design + ATDD + traceability workflows as `terrace-tea` preset. Reimplement knowledge fragment architecture clean-room in Terrace's agent definitions.

---

### 3. Spec Kit (`github/spec-kit`)

**Why it belongs:** Spec Kit provides the most mature open-source extension/preset architecture for AI-assisted spec-driven development. Its extension catalog model and preset system is exactly the architecture Terrace needs for modularity.

**High-yield zones:**

- `extensions/catalog.community.json` — the extension catalog structure. Terrace's preset registry should follow this model.
- `/speckit.constitution` command pattern — "project's governing principles and development guidelines." This IS what Terrace's steering file concept needs to become.
- `/speckit.specify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement` workflow — the spec-driven development lifecycle. Compare to Terrace's intake → interrogation → spec-compilation → test-architecture → implementation.
- Extension categories (`docs`, `code`, `process`, `integration`, `visibility`) and effect (`Read-only`, `Read+Write`) — Terrace preset categories should mirror this.
- Community extension examples: `spec-kit-cleanup` (post-implementation quality gate), `spec-kit-fixit` (spec-aware bug fixing), `spec-kit-fleet` (human-in-the-loop gates), `spec-kit-maqa-ext` (multi-agent QA with CI gate).

**Directly useful source patterns:**
- **Extension catalog as JSON**: machine-readable registry of available capability packs. Terrace's preset registry (`~/.terrace/presets/registry.json`) should be the same.
- **Constitution command**: a governing principles file that persists across all sessions. This is Terrace's steering file concept.
- **Spec-before-implementation lifecycle**: Spec Kit validates that specs exist before generating implementation. Terrace's lifecycle model (LIFE-01 through LIFE-06) enforces the same gate.
- **Extension effect classification**: distinguishing read-only artifacts from read+write operations. Terrace presets should declare what they can mutate.

**Useful architecture concepts:**
- The `specify init` CLI creates project scaffolding. `terrace init` should do the same.
- Extensions can be installed by category — users can install only what they need. Terrace presets follow this.

**Interesting but non-essential:**
- Spec Kit's Python-based CLI (`specify-cli`, `uv tool install`). Terrace uses Node.js.
- Spec Kit's specific file format for `.spec/` files. Terrace has its own artifact schema.

**Things Terrace should NOT copy:**
- Spec Kit's actual spec format — too tightly coupled to their workflow.
- Spec Kit's Python dependency. Terrace is Node.js-first.
- Spec Kit's `specify implement` which generates code from specs — Terrace governs implementation, doesn't replace the builder.

**Terrace-native concepts emerging from Spec Kit:**
- **Preset registry** (`terrace-registry.json`): structured catalog of installable Terrace capability packs.
- **Steering file**: a persistent constitution document that governs all sessions in a project (`docs/spec/STEERING.md` or `.terrace/steering.md`).
- **Preset categories**: `governance` (core Terrace), `testing` (TEA-derived), `frontend` (Storybook+Playwright), `security` (Semgrep+Trivy), `integration` (Pact).

**Recommended action:** Clone and study architecture. Reimplement extension/preset system clean-room in Terrace. Do not copy code — copy the model.

---

### 4. StrykerJS (`stryker-mutator/stryker-js`)

**Why it belongs:** Mutation testing is the answer to "but the tests pass" — Stryker proves whether tests are actually catching bugs by mutating the code and checking if tests fail. A mutation score below threshold means tests are structurally weak even if green.

**High-yield zones:**

- `packages/core/` — the mutation runner core. Understand the plugin API for test runner integration (Jest, Vitest, Mocha, Jasmine).
- Stryker config (`stryker.config.json`/`stryker.config.mjs`) — the quality gate mechanism. `thresholds.high`, `thresholds.low`, `thresholds.break` are the mutation score gates that Terrace should surface.
- `packages/instrumenter/` — the code mutation engine (operator support: arithmetic, equality, logical, array, string, etc.). Understanding what gets mutated informs what test coverage actually means.
- Dashboard reporting — Stryker's HTML report format shows which mutants survived (=untested behavior). This is what Terrace's adversarial review phase uses as evidence.

**Directly useful source patterns:**
- **Mutation score thresholds as quality gates**: `break` threshold blocks CI if mutation score falls below minimum. Terrace's enforcement layer should include mutation score in release gates.
- **Survived mutant = untested behavior**: Terrace's adversarial review workflow should run Stryker (when configured) and treat survived mutants as gap evidence.
- **Incremental mutation testing** (`--incremental` flag): only test mutations in changed files. Makes mutation testing feasible in CI without full-run overhead.

**Useful architecture concepts:**
- Stryker is language/framework-agnostic through its plugin system. Terrace's mutation testing integration should be similarly agnostic.
- Stryker's dashboard can publish results to a central service. For team use, this is the mutation score history. For personal use, HTML report is sufficient.

**Things Terrace should NOT copy:**
- Stryker's internal test runner orchestration — complex, well-maintained, not worth reimplementing.
- Stryker's mutator implementations — use the existing tool, don't rewrite it.

**Terrace-native concepts emerging from StrykerJS:**
- **Mutation gate**: a Terrace enforcement mechanism that runs Stryker with configured thresholds and blocks phase completion if mutation score is below `terrace.mutation.threshold.break`.
- **`terrace-mutation` preset**: installs Stryker, sets default thresholds, wires mutation gate into CI and optionally into post-implementation phase.

**Recommended action:** Wrap as external engine. `terrace-mutation` preset installs `@stryker-mutator/core` and the appropriate test runner plugin. Terrace provides the config template and gate logic.

---

### 5. Storybook (`storybookjs/storybook`)

**Why it belongs:** Component isolation and documented states are the foundation of UI quality governance. Storybook makes component states testable, documented, and visible. Without it, UI testing is brittle snapshot testing or fragile E2E.

**High-yield zones:**

- **Story format (CSF3)**: Component Story Format 3 is the standard. Each story = a documented, testable component state. Terrace's UI preset should generate story scaffolds as part of the baseline test phase.
- **Storybook Test addon** (`@storybook/test`): runs stories as tests using `play` functions + Testing Library. This is the correct UI unit testing layer — not snapshot tests.
- **a11y addon** (`@storybook/addon-a11y`): runs axe-core on each story. This is the accessibility quality gate — axe-core accessed through Storybook, not standalone.
- **Interaction tests** (`play` functions): test component interactions deterministically. Maps to Terrace's "behavioral coverage over line coverage" principle.
- **Portable stories** (`@storybook/test`): stories can be reused in Vitest or Jest outside Storybook. Important for CI integration.

**Directly useful source patterns:**
- **Story as test surface**: a Storybook story is simultaneously documentation, isolated development environment, and test specification. Terrace's baseline test builder for UI projects should create stories as protected test anchors.
- **a11y + axe-core integration**: every story gets automated accessibility checking. This satisfies `dequelabs/axe-core` integration without requiring standalone axe setup.
- **Visual regression via Chromatic** (optional): Terrace's UI preset can optionally wire in Chromatic for visual diffing. Not core.

**Useful architecture concepts:**
- Storybook's addon system mirrors the Terrace preset system — addons are installable capabilities.
- The `@storybook/test-runner` connects Storybook to Playwright for full browser test execution of stories.

**Interesting but non-essential:**
- Storybook's full monorepo structure — don't study the internals.
- Chromatic integration in v1 — visual regression is v1.5.
- React Native / mobile Storybook — out of scope.

**Things Terrace should NOT copy:**
- Storybook's internal renderer architecture.
- Storybook's build system.

**Terrace-native concepts emerging from Storybook:**
- **`terrace-ui` preset**: installs Storybook + a11y addon + test addon. Generates story scaffold for new components. Wires story-based tests into the baseline protection registry with `spec_ref` pointing to UI requirements.
- **Story-as-protected-anchor**: a story registered in the baseline registry is a behavioral truth anchor for that component state.

**Recommended action:** Wrap as external tool. `terrace-ui` preset handles installation and integration with Terrace's governance layer.

---

### 6. Playwright (`microsoft/playwright`)

**Note:** Playwright is listed as a source-donor but was not cloned in `terrace-research/`. This is correct — Playwright does not need to be cloned. It should be treated as a dependency.

**How Terrace uses Playwright:**
- `terrace-tea` preset (via BMAD TEA's Playwright Utils integration) handles E2E testing.
- `terrace-ui` preset wires `@storybook/test-runner` (which uses Playwright under the hood) for story-based browser testing.
- Terrace's test architecture agent generates Playwright test scaffolds for E2E acceptance criteria.

**Terrace-native concept:** No separate Playwright preset needed — coverage is through `terrace-tea` and `terrace-ui`.

**Recommended action:** External dependency, not source-donor. Install via presets.

---

## Layer 2: Non-Cloned Repo / System Utilization Plan

---

### Pact JS (`pact-foundation/pact-js`)
- **Why not cloned:** It's a library, not a framework to study. The interface is stable and documented.
- **Classification:** Dependency
- **Lifecycle entry:** Implementation (test writing), CI (provider verification)
- **Terrace action:** `terrace-tea` preset exposes Pact through its contract testing knowledge fragment (`contract-testing.md` + `pactjs-utils-overview.md` from BMAD TEA). TEA's `bmad-testarch-automate` workflow already generates Pact consumer tests. Terrace surfaces this via the preset.
- **Core/Optional/Future:** Optional (microservices projects only)

### axe-core (`dequelabs/axe-core`)
- **Why not cloned:** It's an accessibility engine, not an architecture to study.
- **Classification:** Dependency
- **Lifecycle entry:** Pre-commit (via Storybook a11y), CI (via Storybook test-runner), local verification
- **Terrace action:** `terrace-ui` preset installs `@storybook/addon-a11y` which wraps axe-core. No direct axe-core integration needed — Storybook is the interface.
- **Core/Optional/Future:** Optional (UI projects)

### Semgrep (`semgrep/semgrep`)
- **Why not cloned:** It's a static analysis tool, not an architecture to study.
- **Classification:** CI tool
- **Lifecycle entry:** Pre-commit, CI, implementation
- **Terrace action:** `terrace-security` preset defines Semgrep rules for the target language/framework. Terrace generates `.semgrep/terrace-rules.yaml` during init. Pre-commit hook optionally runs `semgrep --config .semgrep/` on staged files.
- **Core/Optional/Future:** Optional (security-sensitive projects)
- **Terrace abstraction:** `terrace security check` runs the full security gate (Semgrep + Trivy + OSV) as a single command.

### Trivy (`aquasecurity/trivy`)
- **Why not cloned:** Scanner binary, not an architecture.
- **Classification:** CI tool
- **Lifecycle entry:** CI, release gating
- **Terrace action:** `terrace-security` preset adds a CI step for `trivy fs --exit-code 1 --severity HIGH,CRITICAL .` Terrace provides the CI YAML snippet.
- **Core/Optional/Future:** Optional (v1.5 for personal use, core for team)

### OSV-Scanner (`google/osv-scanner`)
- **Why not cloned:** Scanner binary.
- **Classification:** CI tool
- **Lifecycle entry:** CI, release gating
- **Terrace action:** `terrace-security` preset wires `osv-scanner --lockfile=package-lock.json` into CI. Terrace provides the CI YAML snippet.
- **Core/Optional/Future:** Optional

### OpenSSF Scorecard (`ossf/scorecard`)
- **Why not cloned:** API-based scoring, not local code.
- **Classification:** Policy/checkpoint
- **Lifecycle entry:** Release gating, maintenance
- **Terrace action:** `terrace-security` preset documents Scorecard as a release gate check. `terrace audit --scorecard` optionally shells out to `scorecard` CLI if installed.
- **Core/Optional/Future:** Optional (v2 for OSS projects)

### ZAP (`zaproxy/zaproxy`)
- **Why not cloned:** Security scanner, not an architecture.
- **Classification:** CI tool
- **Lifecycle entry:** Staging, release gating
- **Terrace action:** `terrace-security` preset documents ZAP as a staging DAST scan. Not wired into pre-commit. CI YAML snippet provided.
- **Core/Optional/Future:** Optional (staging environments only)

### OWASP ASVS
- **Why not cloned:** It's a standard document, not code.
- **Classification:** Standard/control catalog
- **Lifecycle entry:** Planning (requirements phase), design (spec compilation)
- **Terrace action:** `terrace-security` preset maps ASVS Level 1 controls to Terrace requirements categories. The spec interrogator agent includes ASVS-relevant questions when security requirements are detected.
- **Core/Optional/Future:** Optional but recommended for any project with auth/data/API

### OpenSSF Security Baseline
- **Why not cloned:** Policy document.
- **Classification:** Standard/control catalog
- **Lifecycle entry:** Release gating, maintenance
- **Terrace action:** `terrace audit --security-baseline` produces a pass/fail report against OpenSSF baseline controls. Mapped to `terrace-security` preset.
- **Core/Optional/Future:** Optional (v2 for OSS)

### SLSA Framework
- **Why not cloned:** Framework specification, not code.
- **Classification:** Standard/control catalog
- **Lifecycle entry:** Release gating (v2)
- **Terrace action:** Future target state. SLSA provenance generation would be a v2 `terrace-security` capability.
- **Core/Optional/Future:** Future (v2)

### Kiro (`kirodotdev/Kiro`)
- **Why not cloned:** Conceptual inspiration only — the interface model matters, not the code.
- **Classification:** Conceptual inspiration
- **What Terrace takes:**
  - **Steering files**: Kiro's `.kiro/steering/*.md` pattern — persistent context that shapes all sessions. Terrace implements this as `.terrace/steering.md` (the project constitution).
  - **Structured rule layers**: Kiro's spec → requirements → tasks → implementation pipeline with hook enforcement. Terrace's lifecycle model (LIFE-01 through LIFE-06) is the equivalent.
  - **Hooks**: Kiro's hook system triggers governance checks at defined points. Terrace's pre-commit hook + session protocols are the equivalent.
- **Terrace-native feature:** `.terrace/steering.md` — project constitution loaded at every session start. NOT the same as CLAUDE.md (which is global). Steering is project-specific governance intent.
- **Core/Optional/Future:** Core (v1)

### Kiro Powers (`kirodotdev/powers`)
- **Why not cloned:** Conceptual inspiration — on-demand context pack model matters.
- **Classification:** Conceptual inspiration
- **What Terrace takes:** The "powers" model = on-demand capability packs loaded into context when needed. This maps exactly to BMAD TEA's knowledge fragment system. Terrace agents load knowledge fragments from their `fragments/` directory based on the active preset and current phase.
- **Terrace-native feature:** Knowledge fragment system (tiered index + conditional loading per agent).
- **Core/Optional/Future:** Core (v1)

### OpenSpec (`Fission-AI/OpenSpec`)
- **Why not cloned:** Optional UX reference.
- **Classification:** Conceptual inspiration
- **What Terrace takes:** Reference for spec artifact format conventions. May influence COMPILED-SPEC.md frontmatter schema.
- **Core/Optional/Future:** Future (optional reference)

### Ruflo (`ruvnet/ruflo`)
- **Why not cloned:** Future-state reference only.
- **Classification:** Conceptual inspiration (future)
- **What Terrace takes:** Plugin/runtime governance model — relevant only if Terrace expands into a runtime platform.
- **Core/Optional/Future:** Future (v2+)

---

## Layer 3: Implementation Plan

---

### Core Architecture

```
Terrace = GSD Spine + Governance Layer + Preset System

GSD Spine:
  workflows/         — execution orchestration (plan-phase, execute-phase, verify)
  .planning/         — execution state (STATE.md, ROADMAP.md, phases/)
  bin/gsd-tools.cjs  — structured write path for execution state

Governance Layer (new):
  workflows/governance/   — intake, interrogation, spec-compilation, test-architecture,
                            protected-baseline, adversarial-review, regression-capture, handoff
  agents/terrace-*.md     — spec-interrogator, spec-compiler, test-architect,
                            baseline-builder, verifier-adversary, maintainer-curator
  bin/terrace-tools.cjs   — structured write path for governance state
  docs/                   — governance artifacts (prd/, spec/, testing/, decisions/)
  .terrace/               — governance config and registry
    policy.json           — governance gate configuration (strict/standard/lightweight)
    project-state.json    — current phase, spec hash, active slice, last session
    baseline-registry.json — protected test anchors
    steering.md           — project constitution (loaded every session start)
    presets/              — installed preset registrations

Preset System (new):
  presets/
    core/               — terrace-core (always installed)
    terrace-tea/        — BMAD TEA integration (test design, ATDD, traceability)
    terrace-mutation/   — StrykerJS mutation testing gate
    terrace-ui/         — Storybook + Playwright + axe-core
    terrace-security/   — Semgrep + Trivy + OSV + ASVS mapping
  registry.json         — available preset catalog (mirrors spec-kit's catalog.json)
```

### Package/Module Boundaries

```
terrace-tools.cjs (Node.js CommonJS)
├── session           — start/end, spec hash, drift detection
├── baseline          — protect, status, registry management
├── decision          — log entry creation, spec_ref linking
├── spec              — validate, drift detection
├── phase             — set, transition validation
├── audit             — coverage report, governance health
├── init              — install agents, settings, hook, steering
├── migrate           — artifact schema upgrades
├── doctor            — install diagnostics
├── preset            — install/uninstall/list presets
└── security          — run security gate (Semgrep + Trivy + OSV)

pre-commit hook (POSIX shell)
└── reads baseline-registry.json + docs/spec/DECISION-LOG.md
    blocks if: protected file changed AND no decision log entry today

knowledge-fragment-index.json (per agent)
└── id, name, tags, tier (core/extended/specialized), file path
    loaded by step-01 of each workflow to select context
```

### Main Workflow Lifecycle

```
TERRACE GOVERNANCE (pre-execution)
─────────────────────────────────────
/terrace:intake
  → terrace-tools.cjs phase set intake
  → Create docs/prd/PRD.md from template
  → Create .terrace/steering.md (project constitution)

/terrace:interrogate
  → Spawn terrace-spec-interrogator
  → Steps: preflight → question-rounds → assumption-log → handoff
  → Output: docs/spec/INTERROGATION.md

/terrace:compile-spec
  → Spawn terrace-spec-compiler
  → Steps: ingest → compile → invariants → permissions → state-machines → validate
  → Output: docs/spec/COMPILED-SPEC.md + supporting artifacts

/terrace:design-tests
  → Spawn terrace-test-architect (+ terrace-tea preset if installed)
  → Steps: risk-assessment → test-layer-mapping → mutation-plan → ci-tier → gate-decision
  → Output: docs/testing/TEST-ARCH.md

/terrace:protect-baseline
  → Spawn terrace-baseline-builder
  → Creates test files, registers them via terrace-tools.cjs baseline protect
  → Blocks implementation if gate fails

GSD EXECUTION (mid-execution, inherited)
─────────────────────────────────────────
/gsd:plan-phase N     → unchanged
/gsd:execute-phase N  → unchanged, but baseline regression gate runs implicitly
/gsd:verify-work      → unchanged, feeds into adversarial review

TERRACE POST-BUILD GOVERNANCE
──────────────────────────────
/terrace:adversarial-review
  → Spawn terrace-verifier-adversary
  → Compares implementation vs COMPILED-SPEC.md
  → Produces gap list (blocking / non-blocking)
  → Blocking gaps prevent phase completion

/terrace:capture-regressions
  → Adds new tests to baseline from adversarial findings

/terrace:handoff
  → terrace-tools.cjs session end
  → Writes .planning/sessions/SESSION-[timestamp].md
```

### Where GSD Remains the Spine

GSD's execution phases (plan → execute → verify) are unchanged. Terrace adds governance phases BEFORE Phase 1 and AFTER each phase's verify step. The ROADMAP.md structure remains GSD's. `.planning/STATE.md` remains GSD's. Terrace writes to `docs/` and `.terrace/` only — never to `.planning/` except for session artifacts in `.planning/sessions/`.

### Where TEA Logic Enters

TEA enters through the `terrace-tea` preset. When installed:
1. `/terrace:design-tests` spawns the TEA test-design workflow in addition to Terrace's test-architect agent.
2. TEA's P0-P3 risk matrix populates `docs/testing/TEST-ARCH.md`'s risk column.
3. TEA's ATDD workflow generates the failing acceptance tests that become Terrace protected baseline tests.
4. TEA's traceability workflow produces the requirement-to-test coverage map.
5. TEA's CI workflow generates the CI YAML for the quality pipeline.

### Where Mutation Testing Enters

Mutation testing (`terrace-mutation` preset) enters at two points:
1. **Post-baseline**: after protected baseline tests are written, `stryker run` establishes the baseline mutation score.
2. **Adversarial review gate**: if mutation score drops below threshold, adversarial review treats surviving mutants as behavioral gaps.

### Where Frontend Quality Systems Enter

Storybook + Playwright + axe-core (`terrace-ui` preset) enters:
1. **Baseline protection**: story files for UI components are registered as protected anchors.
2. **Test architecture**: UI requirements generate story-based test entries in TEST-ARCH.md.
3. **Adversarial review**: accessibility violations (axe-core via Storybook) and visual regressions surface as gaps.

### Where Security and Release Posture Enter

`terrace-security` preset enters:
1. **Spec interrogation**: ASVS control questions are injected when security requirements are detected.
2. **Test architecture**: security requirements map to specific test layers (Semgrep rules, Trivy scans, ZAP DAST).
3. **Pre-commit**: Semgrep runs on staged files.
4. **CI**: Trivy + OSV-Scanner run on PRs.
5. **Release gate**: Scorecard + OpenSSF baseline check runs before milestone completion.

### How Presets/Extensions Are Modeled

```
.terrace/presets/registry.json
{
  "installed": [
    {
      "id": "terrace-tea",
      "version": "1.0.0",
      "category": "testing",
      "effect": "Read+Write",
      "agents": ["terrace-tea-test-architect", "terrace-tea-atdd"],
      "workflows": ["design-tests-extended", "atdd"],
      "fragments": ["risk-governance", "test-priorities", "contract-testing"],
      "flags": {
        "tea_use_playwright_utils": true,
        "tea_use_pactjs_utils": false
      }
    }
  ]
}
```

Presets register agents, workflows, and knowledge fragments. The governance workflow loader checks which presets are installed and routes to extended step chains when available.

### How Terrace Handles Steering/Rules/Context

`.terrace/steering.md` is the project constitution (Kiro-inspired). It contains:
- Project identity (1 paragraph)
- Non-negotiable constraints (language, arch decisions)
- Active quality gates (which presets are enforced)
- What "done" means for this project

Loaded by `terrace session start`. Every agent that spawns reads it before any other context.

### Required vs Optional Capabilities

```
Required (core, always installed):
  - Governance templates (TMPL-01 through TMPL-12)
  - terrace-tools.cjs core commands
  - Pre-commit hook
  - policy.json + project-state.json + baseline-registry.json
  - Intake, interrogation, spec-compilation workflows
  - terrace-spec-interrogator, terrace-spec-compiler agents
  - Session start/end protocol
  - steering.md

Optional (preset-driven):
  - terrace-tea: test design, ATDD, traceability (testing-focused projects)
  - terrace-mutation: StrykerJS gate (mature codebases)
  - terrace-ui: Storybook + a11y (frontend projects)
  - terrace-security: Semgrep + Trivy + ASVS (security-sensitive projects)
  - terrace-contracts: Pact (microservices)
```

---

## Phased Roadmap

### v1 — Must-Have Terrace Core

**Goal:** Terrace works end-to-end on a Claude Code project. You can use it on a real project today.

1. **Foundation** — governance templates, `terrace-tools.cjs` scaffold, `terrace init`, steering file, GSD extension pattern established
2. **Governance Workflows** — intake, interrogation (with knowledge fragments), spec-compilation, test-architecture (basic, no TEA)
3. **Baseline Protection** — pre-commit hook, baseline registry, `baseline protect/status`, Protected Baseline workflow
4. **Decision Log & Audit** — `decision log`, `spec validate`, `audit` command, CI enforcement snippets
5. **Session & Lifecycle** — `session start/end`, phase state machine, steering file loading
6. **Post-Build Governance** — adversarial review with blocking gaps, regression capture, handoff workflow

### v1.5 — High-Leverage Upgrades

**Goal:** Terrace becomes genuinely differentiated from GSD + any other framework.

- `terrace-tea` preset: BMAD TEA integration (test design + ATDD + traceability)
- `terrace-mutation` preset: StrykerJS gate
- `terrace-ui` preset: Storybook + a11y
- `terrace-security` preset (partial): Semgrep + Trivy + ASVS mapping
- Tiered knowledge fragment system for all governance agents
- NFR assessment workflow
- Tri-modal workflows (Create/Edit/Validate) for interrogation and spec-compilation

### v2 — Advanced / Runtime / Platform

**Goal:** Terrace is installable by anyone, works across platforms, and has a published ecosystem.

- Multi-platform adapters (Codex, Cursor, Ollama)
- npm distribution (`npx terrace init`)
- `terrace-security` preset: ZAP, Scorecard, SLSA provenance
- Behavioral coverage dashboard artifact
- Multiple concurrent workstreams
- Public preset registry (community presets)
- Ruflo-inspired plugin governance if Terrace expands into a platform

---

## Dependency Strategy

| What | Terrace Action |
|------|----------------|
| GSD execution layer | Fork baseline — extend, never modify |
| BMAD TEA workflows | Integrate as `terrace-tea` preset — clean-room workflow files that call TEA agents |
| StrykerJS | `npm install @stryker-mutator/core` — wrap, don't reimplement |
| Storybook | `npx storybook init` — wrap, configure, wire into governance |
| Playwright | `npm install @playwright/test` — surface through presets |
| Pact JS | `npm install @pact-foundation/pact` — through `terrace-tea` preset |
| axe-core | Via `@storybook/addon-a11y` — through `terrace-ui` preset |
| Semgrep | Binary install via `terrace-security` init script |
| Trivy | Binary install via `terrace-security` init script |
| OSV-Scanner | Binary install via `terrace-security` init script |
| ASVS | Reference document — mapped in `terrace-security` knowledge fragments |
| OpenSSF | Reference document — mapped in `terrace-security` knowledge fragments |
| SLSA | Future — v2 |
| Scorecard | CLI install via `terrace-security` preset — optional |

---

## Repository Strategy

| Repo | Strategy |
|------|----------|
| `gsd-build/get-shit-done` | Forked baseline in `get-shit-done/` — read-only reference, extend only |
| `bmad-method-test-architecture-enterprise` | Research clone in `terrace-research/` — study deeply, port knowledge fragments and workflow patterns to `terrace-tea` preset |
| `spec-kit` | Research clone in `terrace-research/` — study extension architecture, implement clean-room |
| `stryker-js` | Research clone in `terrace-research/` — understand config/thresholds, then use as npm dependency |
| `storybook` | Research clone in `terrace-research/` — understand addon architecture, then use as npm dependency |
| All security tools | npm/binary dependencies — no local clones |
| All standards/baselines | Reference documents — no local clones |

---

## Risks and Guardrails

### Scope Creep
**Risk:** Terrace tries to integrate everything (TEA + Stryker + Storybook + Semgrep + Trivy + ZAP + Pact + axe + Scorecard + SLSA) in v1.  
**Guardrail:** Presets are optional. v1 core has zero optional preset requirements. Ship v1 core first.

### Repo Sprawl
**Risk:** `terrace-research/` grows to 10+ cloned repos, all "for reference."  
**Guardrail:** Only the 5 confirmed source-donors are in `terrace-research/`. All others are dependencies or references.

### Licensing Boundaries
**Risk:** Borrowing code from BMAD TEA (MIT) or Spec Kit (MIT) without attribution.  
**Guardrail:** Terrace reimplements clean-room. No copy-paste of code. Ideas and patterns are borrowed; implementations are original. License headers on all Terrace-original files.

### False Confidence from Passing Tests
**Risk:** Green CI but low mutation score. Tests pass but don't catch real bugs.  
**Guardrail:** `terrace-mutation` preset adds mutation gate. Even in v1 core, Terrace's test architecture doc requires test layer rationale — "why is this the right layer?" prevents shallow tests.

### Mutation Testing Overhead
**Risk:** Stryker runs take 30+ minutes. Developers disable the mutation gate.  
**Guardrail:** `--incremental` mode (only mutate changed files). Gate runs in CI nightly, not on every PR. Local `terrace mutation check` is optional.

### Frontend Complexity Creep
**Risk:** Storybook setup takes a sprint. UI preset becomes a project in itself.  
**Guardrail:** `terrace-ui` preset uses `npx storybook init` — one command. Story scaffolds are generated, not manually written. Accessibility via addon (one line in config), not custom axe setup.

### Noisy Security Scans
**Risk:** Semgrep and Trivy produce hundreds of warnings. Developers ignore them.  
**Guardrail:** `terrace-security` preset ships with opinionated rule sets (not all rules). `policy.json` has `security.fail_on: HIGH_CRITICAL` — ignore low/medium by default. False positive suppression via `.semgrepignore`.

### Overfitting to One Stack
**Risk:** Terrace assumes TypeScript + Node.js + Playwright everywhere.  
**Guardrail:** OPS-09 requirement: governance layer is language-agnostic. TypeScript-specific guidance is in `terrace-ui` preset only. Test architect agent detects stack and adapts.

---

## Prioritization

### Essential for Terrace's Identity (Build in v1)
1. Governance-before-execution: spec and test architecture before any implementation starts
2. Protected baseline tests with enforcement (pre-commit hook + decision log gate)
3. Steering file (project constitution, loaded every session)
4. Session start/end protocol with spec hash drift detection
5. Lifecycle state machine (LIFE-01 through LIFE-06)
6. Adversarial review with blocking gap enforcement
7. `terrace init` — single-command install that does not break GSD

### Valuable but Deferrable (v1.5)
1. BMAD TEA preset (`terrace-tea`) — powerful but requires stable core first
2. Knowledge fragment system for all agents — architecture improvement, not blocking
3. Mutation testing gate (`terrace-mutation`) — high value but adds setup overhead
4. Tri-modal workflows (Create/Edit/Validate) — quality of life, not blocking
5. NFR assessment workflow
6. Storybook + UI preset (`terrace-ui`)

### Tempting but Should Be Resisted
1. Building a web dashboard — file-based is correct for v1, web UI adds no governance value
2. Multi-platform adapters in v1 — Claude Code works; don't generalize until second platform is real
3. Full security preset in v1 — Semgrep alone adds complexity; defer the full suite to v1.5
4. Auto-generating specs from code — antithetical to Terrace's core thesis
5. Integrating everything from this audit immediately — the preset system exists precisely so you don't have to

---

## Final Recommendation

**Revised REQUIREMENTS.md is good but was written before this audit.** The following must be updated:

1. **Add TMPL requirements for steering.md** (`.terrace/steering.md` as project constitution)
2. **Add preset system requirements** (PRST-01 through PRST-N): preset registry, preset install/uninstall, preset categories, flag system
3. **Add knowledge fragment requirements** (FRAG-01 through FRAG-N): tiered index per agent, conditional loading, fragment directory structure
4. **Revise WKFL-02 (interrogation)** to specify tri-modal architecture (Create/Edit/Validate) and step-file chaining
5. **Add v1.5 requirements for `terrace-tea` preset** mapped explicitly to BMAD TEA workflow components
6. **Revise GSD-01 through GSD-07** — the policy has shifted from "prefer not to modify GSD" to "may patch when necessary, but must log every modification." This is already correct in the current REQUIREMENTS.md.
7. **Roadmap must now have 6 phases for v1 core** (as defined in the phased roadmap above) plus a v1.5 milestone for preset integration.

The revised architecture is: **GSD spine + governance layer + preset system**. The governance layer is the differentiator. The preset system is what makes Terrace extensible without being a bag of tools.

---

*Authored: 2026-04-05*  
*Supersedes: initial research files (STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, SUMMARY.md) — those remain valid at the component level but this document defines the integrated strategy.*
