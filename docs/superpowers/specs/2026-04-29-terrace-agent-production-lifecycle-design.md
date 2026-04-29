# Terrace Agent Production Lifecycle Design

## Purpose

Terrace should become a production workbench for AI-assisted development, not only a stricter project checklist. The next product layer should help an agent understand the work, split it safely, interrogate weak assumptions, write company-grade documentation, review itself against durable rules, and leave enough evidence for a human to trust the result.

This spec extends the current Senior Cycle with auxiliary commands that are useful in real production teams: an always-current Tier One report card, handoffs, workstreams, design-source ingestion, production preflight, AI review protocols, documentation generation, test-suite evaluation, rule lifecycle management, and standards backfill.

## Product Principles

- Agent work must be restartable from repository state.
- Generated artifacts must be useful to humans, not just agents.
- Every blocker should name the missing evidence and the command that produces it.
- Shortcuts are allowed only when they have an owner, expiry, and cleanup trigger.
- Tests should prove behavior without turning into an oversized maintenance burden.
- Company rules should be first-class and auditable because engineering standards change.
- Documentation should read like something a senior engineer would actually send.
- Project health should be visible without asking an agent for a fresh audit after every sprint.

## Scope

This is one roadmap theme with nine buildable slices:

1. Tier One report card.
2. Agent handoff packs.
3. Risk-based workstreams.
4. Design-source adapters.
5. Production failure preflight.
6. AI review protocols.
7. No-band-aid debt tracking.
8. Documentation and test-suite quality commands.
9. Rule audit, rule authoring, and standards backfill.

The first implementation plan should not build all nine at once. The recommended first cut is Tier One report card, handoff packs, debt tracking, and preflight because those improve the existing Senior Cycle immediately and establish reusable artifact patterns.

## Command Surface

### Tier One Report Card

Commands:

- `terrace report`
- `terrace report update`
- `terrace report open`
- `terrace report history`

Artifacts:

- `.terrace/report-card.json`
- `docs/terrace/REPORT-CARD.md`
- `docs/terrace/report-history/<timestamp>.md`

The report card should answer the question the user currently has to ask manually after every sprint: "How far are we from the Tier One goal?"

It should update automatically after major Terrace commands, including:

- `terrace phase complete`
- `terrace quick complete`
- `terrace ship check`
- `terrace audit`
- `terrace test eval`
- `terrace docu`
- `terrace rule audit`
- `terrace backfill`
- `terrace debt audit`

The report card should include:

- overall Tier One readiness score
- status label
- last updated command
- current blockers
- current warnings
- completed sprint outcomes
- missing Senior Cycle artifacts
- quality ladder status
- documentation status
- test-suite strength status
- debt status
- rule health
- production readiness
- next three actions

Scores should be explainable. Terrace should not produce a magic percentage with no evidence. Each score should list the checks that moved it up or down.

Suggested score bands:

- 95-100: Tier One ready.
- 85-94: strong, with named polish or operational gaps.
- 70-84: usable but not Tier One.
- 50-69: foundations exist, but production confidence is incomplete.
- below 50: planning or governance is too weak for production claims.

`terrace report` should never mutate state. `terrace report update` should recompute and write the current card. Commands that auto-update the report card should use the same writer internally.

### Agent Handoff Packs

`terrace handoff create [--feature <id>] [--for codex|claude|generic]`

Creates `docs/terrace/handoffs/<timestamp>-<feature>.md` plus a compact JSON summary under `.terrace/handoffs/`.

The handoff should include:

- Current feature, tier, phase, active slice, and next command.
- Missing Senior Cycle gates.
- Changed files and likely ownership boundaries.
- Relevant decisions, rules, debts, and blockers.
- Safe next action.
- Explicit "do not touch" boundaries when known.
- Verification commands already run and commands still required.

This should be optimized for context reloads and delegated agents. It should be dense, factual, and small enough to paste into an AI session.

### Risk-Based Workstreams

`terrace workstreams plan <feature>`

Creates `docs/terrace/features/<feature>/WORKSTREAMS.md` and `.terrace/workstreams/<feature>.json`.

The planner should split work into lanes such as:

- product/spec
- tests
- frontend
- backend
- data/migrations
- observability
- docs
- cleanup

Each lane should include owned files, dependencies, collision risks, verification commands, and whether it can run in parallel. Shared files, package exports, schemas, auth, billing, and migrations should be marked as coordination points.

### Design-Source Adapters

Existing Stitch support should become a broader design-source layer.

Commands:

- `terrace design-source import stitch <feature> <ref>`
- `terrace design-source import v0 <feature> <ref>`
- `terrace design-source import figma <feature> <ref>`
- `terrace design-source import screenshot <feature> <path>`
- `terrace design-source diff existing-ui <feature> <route-or-path>`

Outputs:

- `docs/terrace/features/<feature>/UI-SPEC.md`
- `docs/terrace/features/<feature>/UI-DIFF.md`
- `docs/terrace/features/<feature>/UI-ASSETS.md`
- `docs/terrace/features/<feature>/UI-VERIFY.md`

The command should not try to become a design tool. It should normalize design intent into implementation constraints: routes, components, states, responsive behavior, asset requirements, visual regressions to check, and browser verification requirements.

### Production Failure Preflight

`terrace preflight <feature> [--mode init|pre-ship|incident]`

Creates `docs/terrace/features/<feature>/PREFLIGHT.md`.

Preflight asks how the feature fails in production. It should produce testable or monitorable checks for:

- bad input
- permission errors
- slow network
- stale cache
- partial deploy
- missing environment variables
- failed migrations
- third-party outages
- rate limits
- rollback path
- observability gaps

For Tier 2+ work, `terrace ship check` should warn or block when preflight is missing depending on the project profile.

### AI Review Protocols

`terrace review ai --mode security|architecture|test-trust|ux|release [--feature <id>]`

Creates structured findings under `docs/terrace/reviews/<feature>/`.

Each finding should include:

- id
- mode
- severity
- file or artifact reference
- claim
- evidence
- recommended fix
- blocker or warning classification

The command should be usable by any agent, but the output format must be stable enough for `terrace ship check` to consume. A prose review is not enough.

### No-Band-Aid Debt Tracker

Commands:

- `terrace debt add <feature>`
- `terrace debt list`
- `terrace debt audit`
- `terrace debt resolve <id>`

Artifacts:

- `.terrace/debt.json`
- `docs/terrace/features/<feature>/DEBT.md`

Debt entries should include owner, reason, affected files, expiry condition, cleanup trigger, replacement design, and whether the debt is allowed to ship.

Examples of valid debt:

- temporary feature flag while rollout is staged
- compatibility shim while a migration is underway
- intentionally duplicated code while an abstraction is still unstable

Examples of invalid debt:

- "fix later" with no owner
- untracked temporary API usage
- bypassed validation
- broad catch blocks hiding unknown failures

`terrace ship check` should block expired or ownerless debt.

### Documentation Generation

`terrace docu <feature|change> [--type adr|runbook|release-note|migration|api|user-guide|handoff]`

Creates documentation from code changes, Senior Cycle artifacts, decisions, and verification evidence. This is not just "write docs." The command should infer what kind of documentation a production team would require.

Outputs may include:

- `docs/terrace/features/<feature>/DOCS.md`
- `docs/terrace/features/<feature>/ADR.md`
- `docs/terrace/features/<feature>/RUNBOOK.md`
- `docs/terrace/features/<feature>/RELEASE-NOTES.md`
- `docs/terrace/features/<feature>/MIGRATION-GUIDE.md`

The command should support a local writing-polish adapter. The adapter can call the existing humanizer/blader skill when available, but Terrace should treat it as optional. If the adapter is missing, Terrace should still produce a clean technical draft.

Required qualities:

- concise executive summary
- decision context
- operational impact
- rollout and rollback
- user-visible changes
- links to evidence
- explicit open questions

For Tier 3 work, `terrace ship check` should require docs or a documented exemption.

### Test Suite Evaluation

`terrace test eval [--feature <id>] [--changed]`

Creates `docs/testing/TEST-EVAL.md`.

The evaluator should score the test suite on trust, not size. It should look for:

- tests mapped to requirements
- tests that only assert mocks
- duplicate tests
- obsolete tests
- flaky patterns
- slow tests that should move tiers
- missing failure-mode coverage
- consolidation and deletion candidates
- snapshot overuse
- excessive integration coverage where a unit test would be clearer

Output should separate blockers from recommendations. A bloated test suite is not a win if it slows agents down, hides intent, or discourages refactoring.

### Interrogate Modes

The current `terrace interrogate <feature>` command should become mode-aware:

- `terrace interrogate init <feature>` for new features.
- `terrace interrogate adjust <feature>` for scope changes or feature revisions.
- `terrace interrogate risk <feature>` for production or security concerns.
- `terrace interrogate milestone <feature>` for milestone additions, removals, and sequencing changes.

Default `terrace interrogate <feature>` may remain as an alias for `terrace interrogate init <feature>`.

Each mode should produce a different artifact section while writing to the same feature directory:

- `INTERROGATION.md`
- `ADJUSTMENT.md`
- `RISK.md`
- `MILESTONE-INTERROGATION.md`

This keeps interrogation useful after initial planning. Real projects change midstream; Terrace should make those changes explicit instead of pretending the first plan stayed true.

### Rule Authoring and Rule Audit

Commands:

- `terrace rule add <domain> <rule-id>`
- `terrace add rule <domain> <rule-id>` as a natural alias.
- `terrace rule audit`

`terrace rule add` creates a durable rule artifact under `.terrace/rules/` and a human-readable companion under `docs/terrace/rules/`.

Rule fields:

- id
- domain
- rationale
- applies_to
- forbidden_patterns
- preferred_patterns
- examples
- enforcement_level
- owner
- created_at
- expires_at or review_after
- source, such as "platform team", "security", or "deprecation plan"

`terrace rule audit` should report:

- stale rules
- unused rules
- conflicting rules
- duplicate rules
- rules with no owner
- rules that are too vague for an agent to follow
- rules that should become automated checks

This matters for large-company workflows where teams deprecate APIs, ban old patterns, or issue new engineering guidance.

### Standards Backfill

`terrace backfill [--rule <id>] [--since <ref>] [--feature <id>]`

Creates `docs/terrace/backfill/<timestamp>-BACKFILL-SPEC.md`.

Backfill evaluates the current codebase against guidelines, rules, architecture decisions, deprecations, and decision artifacts. It should identify areas that were not updated to the current standard and produce a scoped remediation spec.

The output should include:

- standard or decision being backfilled
- affected files
- current violations
- migration plan
- test impact
- risk level
- workstream split
- staged rollout
- verification commands
- cleanup conditions

Backfill should not directly rewrite the codebase. It should produce a spec that a human or agent can review before implementation.

## Data Model Additions

Recommended state additions:

```json
{
  "handoffs": [],
  "workstreams": {},
  "design_sources": {},
  "preflights": {},
  "ai_reviews": [],
  "debt": [],
  "documentation": {},
  "test_evaluations": [],
  "rule_audits": [],
  "backfills": [],
  "report_card": {}
}
```

These fields may remain optional under the permissive schema until the command contracts stabilize.

## Ship Check Integration

The target `terrace ship check` category set is:

- senior_cycle
- tier_one_report
- migration_readiness
- production_preflight
- ai_review
- debt
- documentation
- test_eval
- rule_audit
- dirty_tree
- project quality scripts

Recommended enforcement:

- Tier 1: warnings for missing docs, preflight, and AI review.
- Tier 2: block on missing preflight, ownerless debt, and required docs for user-visible changes.
- Tier 3: block on missing preflight, AI review, documentation, production validation, cleanup, and unresolved rule conflicts.

## Implementation Order

### Phase 1: Report Card, Handoff, Debt, Preflight

Build:

- `terrace report`
- `terrace report update`
- automatic report-card refresh after major workflow commands
- `terrace handoff create`
- `terrace debt add/list/audit/resolve`
- `terrace preflight <feature>`

Why first: these reduce agent drift immediately, replace manual post-sprint audits with a live project health view, and add production realism without needing external integrations.

### Phase 2: Documentation and Test Evaluation

Build:

- `terrace docu <feature|change>`
- optional humanizer/blader adapter
- `terrace test eval`

Why second: docs and test quality are required in strong engineering cultures, and they feed ship readiness.

### Phase 3: Interrogate Modes and AI Review

Build:

- `terrace interrogate init|adjust|risk|milestone`
- `terrace review ai --mode ...`

Why third: mode-aware interrogation and structured review make planning and review less generic.

### Phase 4: Rules and Backfill

Build:

- `terrace rule add`
- `terrace add rule`
- `terrace rule audit`
- `terrace backfill`

Why fourth: rules and backfill are powerful but need the review and documentation primitives to be useful.

### Phase 5: Design Source Adapters and Workstreams

Build:

- `terrace design-source import ...`
- `terrace workstreams plan <feature>`

Why fifth: these become stronger once rules, docs, review, preflight, and debt can all feed the workstream planner.

## Test Strategy

Unit tests should cover:

- command routing
- artifact paths
- state updates
- missing-input behavior
- ship-check category aggregation
- report-card scoring and history snapshots
- rule conflict detection
- test evaluation classification

Fixture tests should cover:

- a small quick task
- a medium feature with docs and preflight
- a large/risky feature with review, debt, docs, and cleanup
- a standards backfill against a fake deprecated API
- a sprint completion that refreshes the Tier One report card

Installed-package tests should run a packed Terrace CLI inside a temporary consumer project and verify that generated artifacts are included in the published package.

## Open Decisions

- Whether the humanizer/blader adapter should be invoked automatically or only through `--polish`.
- Whether `terrace test eval` should parse test files statically only, or optionally run coverage and timing data.
- Whether rule audit should block ship by default or only when rules are marked `enforcement_level: blocking`.
- Whether workstreams should create multiple handoff packs automatically or only describe lanes.
- Whether design-source adapters should stay text-only at first or support screenshots through a browser verification layer.
- Which score weights should define Tier One readiness by default, and whether project profiles should override them.

## Acceptance Criteria

- Every new command writes deterministic JSON output with `--json`.
- Every generated artifact has a stable path and is referenced in state.
- `terrace ship check` can consume blockers from debt, docs, preflight, AI review, rule audit, and test evaluation.
- `terrace report update` writes a self-contained Tier One report card with score evidence and next actions.
- Major workflow commands refresh the report card or record why refresh was skipped.
- The documentation command can produce a useful draft without the local humanizer adapter.
- The test evaluator can recommend deletion or consolidation without treating fewer tests as weaker by default.
- Rule audit can identify stale, unused, conflicting, ownerless, and vague rules.
- Backfill produces a spec only; it does not mutate application code.
- Handoff packs are compact enough for AI context transfer and specific enough for a new session to continue safely.
