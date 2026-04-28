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
- source donor audit
- anti-slop ESLint design
- usage/why routing concept
- GSD command port taxonomy

The migration rule: keep concepts and tests when they fit the strict kernel; rewrite implementation where current code assumes Markdown or process artifacts own truth.

## Non-Goals For v1

- multi-developer collaboration
- remote service
- hosted dashboard
- multi-agent scheduler
- broad platform adapter matrix
- automatic product code generation by Terrace itself
- comprehensive GSD parity before the strict kernel is proven

## Success Criteria

Terrace v1 strict core is ready for personal use when:

1. A blank repo can run through init, intake, interrogation, spec, roadmap, one active slice, RED, GREEN, protect, and handoff.
2. `.terrace/state.json` can reconstruct the official workflow state without chat history.
3. RED cannot pass without failing test evidence mapped to a spec requirement and invariant/contract.
4. GREEN cannot pass unless configured project commands pass.
5. Agent-written tests are evaluated against `testing-trust`, not volume or coverage alone.
6. `terrace port gsd` can classify and migrate existing GSD-shaped artifacts without losing user-authored context.
7. The full core test suite runs without an LLM.

## Implementation Defaults

- `.terrace/state.json` starts with a versioned schema containing `project`, `workflow`, `roadmap`, `active_slice`, `red_gate`, `green_gate`, `protected_tests`, `decisions`, and `sessions`.
- The root CLI stays during transition and delegates to `packages/terrace-cli` once the package exists.
- Initial stack detectors cover Node/package.json, Python/pyproject.toml, Rust/Cargo.toml, and generic shell repos.
- `.terrace/events.jsonl` records one JSON object per command with `event_id`, `timestamp`, `command`, `from_state`, `to_state`, `result`, and `evidence_refs`.
- The first `terrace port gsd` milestone includes command classification, artifact inventory, state migration preview, and a dry-run report before any write.
