# Terrace Core Standalone Design

## Intent

Terrace becomes a standalone, strict-core competitor to GSD for single-developer, TDD-driven, spec-driven project work. It keeps the useful GSD workflow shape — intake, interrogation, roadmap, phases, plans, execution, verification, handoff — but replaces loose workflow state with a deterministic kernel.

The product promise for v1:

> From a blank repo, Terrace can guide one developer from idea to spec, coarse roadmap, just-in-time TDD slices, RED evidence, implementation, GREEN verification, protected tests, and session handoff, with the official state recoverable from files on disk.

## Core Product Boundary

Terrace is not the code-writing agent. Terrace is the workflow governor.

The agent remains creative and probabilistic:

- proposes architecture
- writes tests
- writes implementation code
- updates docs when instructed
- suggests edge cases and improvements

Terrace remains deterministic and skeptical:

- owns canonical project state
- validates legal transitions
- verifies RED before implementation
- verifies GREEN after implementation
- records evidence
- protects durable tests
- logs decisions and overrides
- emits the next required action

Terrace does not try to make agents deterministic. It bounds agent output through a typed state machine and evidence gates.

## Canonical Truth Model

`JSON-led` is the v1 truth model.

Canonical truth:

- `.terrace/state.json`

Supporting deterministic files:

- `.terrace/config.json`
- `.terrace/events.jsonl`
- `.terrace/snapshots/*.json`
- `.terrace/baseline-registry.json`
- `.terrace/presets/registry.json`

Human and agent context:

- `docs/spec/*.md`
- `docs/testing/*.md`
- `docs/prd/*.md`
- `.planning/**`

Markdown artifacts explain and guide the work, but they do not own lifecycle truth. State transitions, active slice, RED/GREEN evidence, protected tests, and decisions are validated against JSON state.

## Workflow Shape

The user can describe a whole project up front. Terrace does not require the user to describe and build one feature at a time.

The v1 flow:

1. `terrace init`
2. `terrace intake record`
3. `terrace interrogate record`
4. `terrace spec compile`
5. `terrace roadmap create`
6. `terrace plan next`
7. agent writes RED tests
8. `terrace red verify`
9. agent writes implementation
10. `terrace green verify`
11. `terrace protect`
12. `terrace handoff`

The initial process creates a project-level spec and coarse roadmap. Detailed implementation plans are generated just in time. Only one executable slice is active at a time.

## Execution Modes

Terrace v1 supports strict execution and low-effort execution. Both modes remain deterministic; the difference is which gates are required before progress.

Strict mode is the default for spec-sensitive work:

- full state-machine enforcement
- hard RED gate
- GREEN verification
- protected-test registration
- decision-log requirement for behavioral drift
- security, architecture, and maintainability gates when those domains are active

Low-effort mode is for fast iteration, exploration, spikes, trivial changes, and roadmap execution where Terrace already has enough deterministic standards to keep the agent bounded:

- no deep interrogation unless uncertainty triggers it
- no full plan document required when the roadmap slice is small and well-formed
- lightweight RED evidence can be accepted for non-critical work if config permits it
- GREEN verification still runs configured commands
- all skipped gates are recorded in `.terrace/events.jsonl`
- low-effort mode cannot bypass protected-test changes, security-critical findings, or explicit strict-mode requirements

The user-facing intent is: Terrace should not force a full phase-plan ceremony when the roadmap already provides enough structure and the risk profile is low.

Primary low-effort command:

```bash
terrace quick <roadmap-item-or-request>
```

`terrace quick` is the Terrace-native successor to `gsd quick`. It creates or selects a small slice, applies the cheapest safe gate set, emits exact agent instructions, and records why deeper planning was skipped.

## Roadmap Execution

Terrace should be able to execute directly from a coarse roadmap when the roadmap item is sufficiently bounded.

Primary command:

```bash
terrace roadmap execute <phase-or-item>
```

Behavior:

- reads `.terrace/state.json` and roadmap records
- checks that the target item has clear goal, success criteria, risk tags, and dependencies
- classifies required effort as `low`, `standard`, or `strict`
- creates an active slice without requiring a separate full plan document when low-effort criteria pass
- emits deterministic test intent and agent instructions
- records the route decision and skipped gates

If the item is ambiguous, high-risk, security-sensitive, architecture-sensitive, or touches protected behavior, Terrace refuses direct execution and requires `terrace plan next`.

This is where Terrace can improve on GSD: roadmap execution is safe because typed state, policy, risk tags, and domain rules make the skip decision explicit and reviewable.

## State Machine

The strict core manages legal transitions:

```text
uninitialized
  -> initialized
  -> intake_recorded
  -> interrogated
  -> spec_compiled
  -> roadmap_ready
  -> slice_planned
  -> red_required
  -> implementation_allowed
  -> green_required
  -> protected
  -> handoff_ready
```

Every command reads current state, validates preconditions, performs a deterministic transition, appends an event, and prints the next required action.

Commands do not orchestrate agents. Commands accept or reject evidence produced between commands.

## RED Gate

Terrace v1 uses a hard RED gate. Implementation is blocked until Terrace observes meaningful failing test evidence for the active slice.

RED evidence is valid only when it maps to:

- active slice id
- active spec requirement
- test file path
- configured test command
- observed failing exit code
- behavior contract or invariant
- expected failure mode

Terrace must reject weak RED evidence:

- test failure unrelated to active slice
- missing test file
- snapshot churn with no behavior contract
- private implementation detail as the only claim
- generated test volume with no invariant mapping
- fixture/setup failure masquerading as behavior failure

The built-in `testing-trust` criterion is part of RED validation. Test count, coverage, and generated breadth are not trust signals by themselves.

## GREEN Gate

After the agent writes implementation, `terrace green verify` runs configured commands from `.terrace/config.json`.

Minimum v1 commands:

- `test_command`
- optional `typecheck_command`
- optional `lint_command`

`terrace init` auto-detects common stacks once and writes explicit commands into config. Terrace does not keep guessing silently. If no `test_command` exists, RED/GREEN verification refuses to run until config is provided.

GREEN evidence records:

- command
- exit code
- relevant stdout/stderr summary
- timestamp
- active slice id
- protected tests affected

## Test Intent

Terrace provides test intent, not test code.

For each active slice, Terrace derives:

- contracts
- invariants
- edge cases
- adversarial scenarios
- regression risks
- recommended test layers

The agent writes the actual tests using the project’s test framework. Terrace validates that the tests and RED evidence map back to the active test intent.

## First-Class Rule Domains

Terrace v1 treats security, architecture, pentesting, and maintainability as first-class rule domains, not optional prose in a planning document.

Each domain has:

- machine-readable rules
- CLI commands
- policy mode integration
- evidence requirements
- override path with decision-log entry
- event log output
- agent contract injection

Domain rules live under:

```text
.terrace/rules/
  security.json
  architecture.json
  pentest.json
  maintainability.json
  testing-trust.json
```

Rules are deterministic where possible and heuristic where necessary. Heuristic rules do not silently block by default unless policy marks them blocking.

### Security Domain

Primary commands:

```bash
terrace security check
terrace security rules
terrace security explain <rule-id>
```

Security covers dependency risk, secret exposure, unsafe configuration, dangerous auth/session changes, permissions drift, and protected-data handling. The security preset can wire external scanners such as Semgrep, Trivy, OSV, and Scorecard, but the strict core owns rule results, policy, and evidence.

Security-critical findings cannot be bypassed by low-effort mode. They require resolution or an explicit decision-log override with scope and expiry.

### Architecture Domain

Primary commands:

```bash
terrace architecture check
terrace architecture rules
terrace architecture explain <rule-id>
```

Architecture covers module boundaries, layering, dependency direction, public API stability, state ownership, side-effect boundaries, and cross-cutting complexity. Architecture rules should be project-specific enough to avoid generic design theater.

Architecture rules are generated from interrogation, steering, spec, and observed codebase shape. They are enforced during roadmap execution when a slice crosses module boundaries or changes shared contracts.

### Pentesting Domain

Primary commands:

```bash
terrace pentest plan
terrace pentest run
terrace pentest report
```

Pentesting is a controlled capability, not an uncontrolled exploit runner. v1 focuses on local, authorized project checks:

- auth and authorization abuse cases
- input validation probes
- insecure direct object reference checks
- SSRF/path traversal pattern checks where applicable
- dependency and container exposure checks through configured tools

Pentest commands require explicit project authorization in `.terrace/config.json`. Findings become regression/security test intent where possible.

### Maintainability Domain

Primary commands:

```bash
terrace maintainability check
terrace maintainability rules
terrace maintainability explain <rule-id>
```

Maintainability covers code complexity, duplication pressure, oversized files, unstable abstractions, low-signal tests, poor naming, unclear ownership, and missing observability around risky behavior.

Maintainability findings are usually advisory in low-effort mode and blocking in strict mode only when the rule is tied to active slice success criteria or protected architecture rules.

## Port Layer

Terrace should not discard the useful GSD-shaped workflow catalog. It should re-host it on the strict core.

`terrace-port` is a first-class package/layer. Its job is to adapt existing GSD/Terrace workflow concepts into the deterministic kernel.

Primary command:

```bash
terrace port gsd
```

Responsibilities:

- inspect an existing GSD/Terrace-like repo
- classify known commands and artifacts into `as-is`, `improved`, or `replaced`
- migrate useful artifacts into `.terrace/state.json`
- preserve user-authored Markdown context
- install Terrace-native equivalents for strict state/gate behavior
- record all migrations in `.terrace/events.jsonl`

Port taxonomy:

- **Port with improvements:** core loop commands that still map to Terrace lifecycle but need state/gate enforcement.
- **Port with major upgrades:** governance flows where GSD behavior is insufficient and must become Terrace-native.
- **Port as-is:** low-risk utilities that do not affect workflow truth.

The existing `.planning/REQUIREMENTS.md` command taxonomy remains a product input, not discarded work.

## Package Architecture

Target monorepo structure:

```text
packages/
  terrace-core/
    src/state/
    src/config/
    src/events/
    src/gates/
    src/testing/
    src/roadmap/
    src/slices/
    src/snapshots/
    tests/

  terrace-cli/
    src/commands/
    src/output/
    tests/

  terrace-port/
    src/gsd/
    src/migrations/
    src/classifiers/
    tests/

  terrace-presets/
    src/tea/
    src/mutation/
    src/ui/
    src/security/
    src/architecture/
    src/pentest/
    src/maintainability/
    tests/

  terrace-agent/
    contracts/
    prompts/
    skills/
    tests/
```

The current root CLI remains prototype/reference until the new core can replace it.

## Existing Assets To Carry Forward

Substantial existing Terrace work should be migrated, not abandoned:

- `terrace init`
- `terrace doctor`
- `terrace audit`
- `terrace migrate`
- baseline protection
- decision log enforcement
- session reconstruction
- preset registry
- steering/project constitution
- tri-modal agent workflows: create/edit/validate
- fragment-index knowledge loading
- adversarial verifier
- maintainer curator
- TEA, mutation, UI, and security preset strategy
- first-class security, architecture, pentesting, and maintainability rule domains
- source donor audit
- anti-slop ESLint design
- usage/why routing concept
- GSD command port taxonomy
- `gsd quick` as the source pattern for `terrace quick`

The migration rule: keep concepts and tests when they fit the strict kernel; rewrite implementation where current code assumes Markdown or process artifacts own truth.

## Non-Goals For v1

- multi-developer collaboration
- remote service
- hosted dashboard
- multi-agent scheduler
- broad platform adapter matrix
- automatic product code generation by Terrace itself
- comprehensive GSD parity before the strict kernel is proven
- remote or third-party pentesting against systems the user does not own or control

## Success Criteria

Terrace v1 strict core is ready for personal use when:

1. A blank repo can run through init, intake, interrogation, spec, roadmap, one active slice, RED, GREEN, protect, and handoff.
2. `.terrace/state.json` can reconstruct the official workflow state without chat history.
3. RED cannot pass without failing test evidence mapped to a spec requirement and invariant/contract.
4. GREEN cannot pass unless configured project commands pass.
5. Agent-written tests are evaluated against `testing-trust`, not volume or coverage alone.
6. `terrace port gsd` can classify and migrate existing GSD-shaped artifacts without losing user-authored context.
7. `terrace quick` can execute low-risk roadmap work without a full plan document while recording skipped gates and route rationale.
8. Security, architecture, pentesting, and maintainability domains have rule files, command surfaces, and policy integration.
9. The full core test suite runs without an LLM.

## Implementation Defaults

- `.terrace/state.json` starts with a versioned schema containing `project`, `workflow`, `roadmap`, `active_slice`, `red_gate`, `green_gate`, `protected_tests`, `decisions`, and `sessions`.
- The root CLI stays during transition and delegates to `packages/terrace-cli` once the package exists.
- Initial stack detectors cover Node/package.json, Python/pyproject.toml, Rust/Cargo.toml, and generic shell repos.
- `.terrace/events.jsonl` records one JSON object per command with `event_id`, `timestamp`, `command`, `from_state`, `to_state`, `result`, and `evidence_refs`.
- The first `terrace port gsd` milestone includes command classification, artifact inventory, state migration preview, and a dry-run report before any write.
- Low-effort mode is represented in state as an execution policy with skipped-gate evidence, not as an informal agent instruction.
- First-class rule domains use a shared rule schema: `id`, `title`, `domain`, `scope`, `blocking`, `evaluation_method`, `policy_modes`, `required_evidence`, `warnings`, and `override`.
