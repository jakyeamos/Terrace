# TERRACE AUDIT REPORT

## Strengths
- Terrace already has a strict core/CLI split, state transitions, audit/doctor checks, protected baselines, red/green gates, command contracts, session reconstruction, and GSD migration.
- Workflow state is recoverable through `.terrace/state.json`, and generated artifacts live under `docs/`.
- Phase and quick-task commands already preserve operational history and can stop on blockers.
- `terrace ship check` discovers project quality scripts and reports structured blockers/warnings.

## Critical Gaps
- Alignment existed as PRD/spec intent, but it did not require customer, problem, success metrics, risks, rollout, observability, validation, and cleanup in one feature-level artifact.
- Edge-case discovery was present as templates/fragments, but not a non-skippable gate for medium/large work.
- Architecture decisions and tradeoffs were not enforced before implementation.
- Pessimistic thinking was implied by review/testing flows, but there was no explicit "how does this fail?" artifact.
- Feature flag decisions were not required before shipping risky work.
- Test strategy existed, but feature work did not require a behavior-first `TEST-PLAN.md` before implementation.
- Observability and production validation were not ship blockers.
- Cleanup was not a completion blocker, so temporary flags/code could linger.
- Quick workflows could still bias agents toward band-aid choices without an explicit sustainable-architecture default.

## Skippable or Weakly Enforced Areas
- Customer and problem clarity were shallow unless users voluntarily filled PRD/spec docs.
- Edge cases, risks, feature flags, observability, validation, and cleanup could be skipped by going straight to phase/quick execution.
- Architecture maintainability was review guidance, not an enforced artifact.
- `terrace quick` optimized for speed but did not explicitly force "will this support future development and expansion?"

## Token / Workflow Inefficiencies
- Legacy GSD-style phase sequences can over-process small changes by forcing broad phase language when a small change only needs alignment-lite, test-first execution, and verification.
- Separate migrated artifacts can scatter context across phase plans, summaries, research, and handoff files.
- Users are incentivized to skip heavy steps when the workflow does not adapt to risk.
- Repeated planning artifacts waste cycles when the missing decision is actually a single gate: alignment, tests, observability, validation, or cleanup.

## Risk Summary
- Without adaptive gates, Terrace risks becoming either too heavy to use or too easy to bypass.
- Without the no band-aid rule, quick tasks can pass local verification while damaging architecture.
- Without observability and production validation, shipped work can be hard to debug after deploy.
- Without cleanup contracts, feature flags and temporary code can become permanent maintenance debt.

# TERRACE SENIOR CYCLE

Terrace uses tiered enforcement so rigor scales with risk.

## Tiers
- Tier 1 - Small Changes: alignment-lite, test-first, execute, verify.
- Tier 2 - Medium Features: alignment, edge cases, test strategy, execute, ship check.
- Tier 3 - Large / Risky Features: full alignment, architecture design, adversarial review, test strategy, observability plan, rollout strategy, production validation, cleanup.

## Required Phases

1. Align
- Purpose: identify customer, problem, metrics, non-goals, risks, rollout, validation, and cleanup intent.
- Required artifact: `docs/terrace/features/<id>/ALIGNMENT.md`.
- Exit criteria: customer, problem, success metrics, risks, feature flag decision, observability, validation, and cleanup are explicit.
- Skippable: Tier 1 only.

2. Interrogate
- Purpose: challenge assumptions and identify edge cases/failure modes before design.
- Required artifact: `docs/terrace/features/<id>/INTERROGATION.md`.
- Exit criteria: "how does this fail?" is answered and failure modes are testable or consciously deferred.
- Skippable: Tier 1 and Tier 2.

3. Map
- Purpose: establish codebase context, architecture, risks, tests, and observability surface.
- Required artifacts: `docs/terrace/codebase/MAP.md`, `ARCHITECTURE.md`, `RISKS.md`, `TESTING.md`, `OBSERVABILITY.md`.
- Exit criteria: likely change areas and system constraints are known.
- Skippable: Tier 1 and Tier 2.

4. Design
- Purpose: record architecture decisions, tradeoffs, maintainability constraints, and no band-aid reasoning.
- Required artifact: `docs/terrace/features/<id>/DESIGN.md`.
- Exit criteria: the implementation path is maintainable and supports future expansion.
- Skippable: Tier 1 and Tier 2.

5. Test (TDD)
- Purpose: define behavior-first tests before implementation.
- Required artifact: `docs/testing/TEST-PLAN.md`.
- Exit criteria: tested behavior, untested behavior, failure scenarios, and critical paths are explicit.
- Skippable: never.

6. Execute
- Purpose: implement only after required alignment/test/design gates are satisfied for the tier.
- Required artifact: existing phase/quick execution artifacts.
- Exit criteria: RED evidence exists before implementation and scope remains tied to the plan.
- Skippable: never.

7. Verify
- Purpose: prove behavior with tests and relevant project quality gates.
- Required artifact: existing validation/review artifacts.
- Exit criteria: targeted tests and relevant quality gates pass or blockers are recorded.
- Skippable: never.

8. Observe
- Purpose: plan post-launch debugging.
- Required artifact: `docs/terrace/features/<id>/OBSERVABILITY.md`.
- Exit criteria: logs, metrics, traces, analytics, and debugging path are named.
- Skippable: Tier 1; required before ship for Tier 2+.

9. Ship
- Purpose: release only when quality gates, observability, and validation are ready.
- Required artifact: `docs/terrace/ship/SHIP.md`.
- Exit criteria: `terrace ship check` passes or blocking risks are explicitly resolved.
- Skippable: never for protected work.

10. Validate
- Purpose: confirm production success after deploy.
- Required artifact: `docs/terrace/features/<id>/VALIDATION.md`.
- Exit criteria: success signals, monitoring plan, rollback conditions, and owner are explicit.
- Skippable: Tier 1; required before ship for Tier 2+.

11. Cleanup
- Purpose: remove temporary flags/code/docs debt.
- Required artifact: `docs/terrace/features/<id>/CLEANUP.md`.
- Exit criteria: flags, temporary code, and documentation updates are removed or tracked.
- Skippable: Tier 1; required before completion for Tier 2+.

# ARTIFACT STRUCTURE

- Alignment: `docs/terrace/features/<id>/ALIGNMENT.md`.
- Codebase mapping: `docs/terrace/codebase/MAP.md`, `ARCHITECTURE.md`, `RISKS.md`, `TESTING.md`, `OBSERVABILITY.md`.
- Test strategy: `docs/testing/TEST-PLAN.md`.
- Observability plan: `docs/terrace/features/<id>/OBSERVABILITY.md`.
- Production validation: `docs/terrace/features/<id>/VALIDATION.md`.
- Cleanup contract: `docs/terrace/features/<id>/CLEANUP.md`.
- UI/Stitch workflow: `docs/terrace/features/<id>/UI-STITCH.md`, `UI-REFRESH.md`, `UI-DIFF.md`.
- Tier One report card: `.terrace/report-card.json`, `docs/terrace/REPORT-CARD.md`, `docs/terrace/report-history/<timestamp>.md`.
- Agent handoff packs: `.terrace/handoffs/<timestamp>-<feature>.json`, `docs/terrace/handoffs/<timestamp>-<feature>.md`.
- Production preflight: `docs/terrace/features/<id>/PREFLIGHT.md`.
- Debt tracker: `.terrace/state.json` `debt[]`, plus `docs/terrace/features/<id>/DEBT.md`.

# ENFORCEMENT SYSTEM

- No execution without `ALIGNMENT.md` for Tier 2+.
- No implementation without `docs/testing/TEST-PLAN.md`.
- No ship without observability and validation for Tier 2+.
- No completion without `CLEANUP.md` for Tier 2+.
- Tier 3 additionally requires interrogation, codebase map, architecture/risk/testing/observability context, and design.
- Every generated plan includes the no band-aid rule: choose sustainable architecture by default, even through `terrace quick`.
- `terrace ship check` now includes Tier One report, production preflight, and debt categories in addition to Senior Cycle, migration readiness, project scripts, and dirty-tree checks.
- `terrace phase complete`, `terrace quick complete`, `terrace audit`, `terrace ship check`, `terrace preflight`, `terrace handoff create`, and debt mutations refresh the Tier One report card.
- Ownerless debt or debt without expiry/cleanup metadata is blocking. Debt that is not marked allowed to ship is a warning until resolved or formalized.
- Tier 2+ active feature work blocks ship when `PREFLIGHT.md` is missing. Tier 1 receives a warning.

# CLI / WORKFLOW CHANGES

- `terrace align <feature>`
- `terrace interrogate <feature>`
- `terrace map-codebase`
- `terrace design <feature>`
- `terrace test-plan <feature>`
- `terrace observe <feature>`
- `terrace validate-prod <feature>`
- `terrace cleanup <feature>`
- `terrace ui import-stitch <feature>`
- `terrace ui plan-refresh <feature>`
- `terrace ui diff <feature>`
- `terrace report`
- `terrace report update`
- `terrace report open`
- `terrace report history`
- `terrace handoff create [--feature <id>] [--for codex|claude|generic]`
- `terrace debt add <feature>`
- `terrace debt list`
- `terrace debt audit`
- `terrace debt resolve <id>`
- `terrace preflight <feature> [--mode init|pre-ship|incident]`

`terrace next` now routes active feature work through `seniorCycleStatus(cwd, feature, tier)` before falling back to generic phase routing. Ship checks include Senior Cycle observability and validation blockers, phase completion requires cleanup for Tier 2+ work, and quick tasks require test-plan plus verification evidence before completion.

# STEP-BY-STEP IMPLEMENTATION PLAN

1. Ship audit/spec documentation and command contracts.
2. Expand artifact writers into richer templates as field expectations stabilize.
3. Add explicit feature tier selection and risk detection heuristics.
4. Add installed-package e2e coverage for the new command surface.
5. Deepen UI/Stitch integration with real import metadata and browser verification artifacts.
