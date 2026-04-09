# Terrace Anti-Slop ESLint System — Design Spec

**Date:** 2026-04-08
**Status:** Approved — ready for implementation planning
**Author:** jakyeamos

---

## Overview

Terrace treats custom ESLint rules as a first-class anti-slop mechanism in its governance model. Rather than relying on agents to remember standards, Terrace encodes standards into the harness and installs them into every governed repo. The system is designed to compound over time: founder failure patterns become observations, observations become rules, rules prevent the same failures in future repos.

The distribution mechanism is `eslint-plugin-anti-slop`, a local npm package that Terrace manages and that the framework author (jakyeamos) evolves based on real signal from governed repos.

---

## Section A — Product Role

### Why lint belongs inside Terrace

Prompt engineering tells agents what good code looks like. It cannot verify the agent produced it. Custom ESLint rules transform "the agent should write real assertions" from a prompt suggestion into a CI gate. The agent either passes the gate or the plan is not complete.

For founders specifically this matters most. Founders have no senior engineer reviewing agent output. Terrace is the senior engineer. Lint rules are how it enforces quality without requiring the founder to recognize bad patterns themselves.

### What lint solves that prompt engineering cannot

| Problem | Prompt engineering | Lint rule |
|---|---|---|
| Assertionless test | Agent may ignore guidance | Hard block at CI |
| `useClient` without hooks | Inconsistent compliance | Auto-fixed or errored |
| Placeholder copy in prod | Easy to miss in review | Caught at file save |
| Mock echo test | Hard to describe precisely enough | AST pattern = exact match |
| Fake TDD compliance | Invisible in a passing test suite | Structural rule catches it |

### Quality stack position

```
Layer 1: Lint (eslint-plugin-anti-slop)
  → catches: structural slop, fake TDD patterns, missing assertions,
             placeholder copy, misused memos, unjustified use-client
  → when: at save (IDE), pre-commit (hook), CI gate
  → cost: near-zero per run

Layer 2: Test execution + coverage gate
  → catches: runtime failures, coverage regressions
  → misses: tests that pass but assert nothing real

Layer 3: Mutation testing (Stryker)
  → catches: tests that pass even when implementation is broken
  → misses: structural patterns, copy quality, API misuse

Layer 4: Baseline protection (Terrace Phase 3)
  → catches: spec drift, protected file changes without decision-log entry
  → misses: test quality within a passing suite

Layer 5: Adversarial review (Terrace Phase 6)
  → catches: architectural drift, requirement gaps, reasoning failures
  → misses: line-level structural patterns
```

Lint is Layer 1 because it is the cheapest and fastest feedback. The goal is to push as many detectable patterns down to Layer 1 as possible over time.

### What lint handles vs. other mechanisms

**Lint catches well:**
- Structural patterns detectable from the AST (missing `expect`, spy-only assertions, empty test bodies, specific import misuse)
- Copy quality (placeholder text, marketing language)
- Framework misuse patterns (useless memo, unjustified use-client)
- Near-exact structural signatures (tests with only one `vi.fn()` and no `expect`)

**Lint does NOT catch — use other mechanisms:**
- Whether a test actually fails when implementation breaks → mutation testing
- Whether coverage is real → coverage gate + mutation
- Whether the spec is being followed → Terrace baseline + adversarial review
- Whether a test's assertion logic is correct → cannot be determined statically
- Semantic duplicates → review heuristics

Never stretch lint past its natural boundary. A rule with 30% false positive rate is worse than no rule.

---

## Section B — Rule Lifecycle

### State machine

```
OBSERVING → CLASSIFIED → CANDIDATE → BENCHMARKED → APPROVED → STAGED → ACTIVE → RETIRED
                                           ↑
                                     (back if FP rate too high)
```

### Stage definitions

**OBSERVING**
Terrace instruments every enforcement gate and session artifact to emit typed failure events. Each event records: event_id, repo_id (anonymized), timestamp, gate category, AST signature, framework (vitest/jest), severity, policy mode. Events accumulate silently in `.terrace/slop-observations.ndjson` (Phase 1) or the remote telemetry endpoint (Phase 2).

**CLASSIFIED**
`terrace lab` reads the observation ledger and classifies patterns using three metrics: recurrence score (distinct repos), severity score (how invisible without tooling), AST confidence (how cleanly it maps to a deterministic AST pattern). Patterns crossing all three thresholds promote automatically to CANDIDATE.

**CANDIDATE**
The framework author reviews the candidate. `terrace lab inspect <category>` shows: sample observations (anonymized), proposed AST signature, estimated FP risk, overlap with existing rules. Author approves or dismisses. Dismissed candidates return to OBSERVING with a `dismissed_reason` field.

**BENCHMARKED**
`terrace generate-rule <candidate-id>` scaffolds the rule file with passing/failing fixtures seeded from real observations. The benchmark gate runs automatically: all valid fixtures must pass with zero false positives, all invalid fixtures must trigger the rule. Real-repo probe runs the rule against Terrace's own test suite. Autofix check (if applicable) re-lints the fixed output.

**APPROVED**
Author runs `terrace lab approve <rule>` after reviewing the benchmarked rule. The rule is stamped with `approved_at`, `origin_observation_ids[]`, maturity level, and added to `eslint-plugin-anti-slop/src/index.mjs`. Not yet published.

**STAGED**
Rule runs silently (warn-only) against a set of known reference repos. FP rate and catch rate are measured in the wild. Minimum: 3–5 real repos, diverse test styles. Before Terrace v1 ships: minimum 3–5 repos per default rule. Rules with FP rate > 15% return to BENCHMARKED for scope reduction.

**ACTIVE**
Author publishes new version of `eslint-plugin-anti-slop` to npm. `terrace init` and `terrace update` install it in target repos at maturity-appropriate severity. Rule origin observation IDs travel with the rule into the agent contract.

**RETIRED**
Rules reevaluated quarterly. A rule retires if: FP rate in production exceeds 15% (measured by `eslint-disable` frequency), the pattern is now structurally impossible due to framework changes, or a better-scoped rule supersedes it. Retired rules are preserved in the registry with `retired_at` and `retirement_reason`.

---

## Section C — Rule Generation Workflow

### Generator inputs

1. **Observation ledger** — raw events for the candidate, filtered to high-confidence instances. `ast_signature` fields become seed material for invalid fixtures.
2. **Repo corpus** — for events with stored code fragments (opt-in Phase 2), the surrounding test context is extracted, anonymized (variable names hashed, string literals stripped), and used as fixture seeds.
3. **Existing rule library** — checked for structural overlap. If an existing rule covers 60%+ of the pattern, the generator proposes an extension rather than a new file.

### Generated output structure

```
eslint-plugin-anti-slop/
  src/rules/
    no-{pattern}.mjs                    ← rule skeleton with metadata header
  tests/rules/
    no-{pattern}/
      valid/
        01-{passing-case}.js            ← minimum 3 valid fixtures
        02-{edge-case}.js
        03-{edge-case}.js
      invalid/
        01-{failing-case}.js            ← minimum 3 invalid fixtures, seeded from observations
        02-{failing-case}.js
        03-{failing-case}.js
      RULE-NOTES.md                     ← AST pattern explanation, edge cases, FP risks
```

Before STAGED, fixture minimums double: 6 valid, 6 invalid, with explicit coverage of async tests, nested describe blocks, shared assertion helpers, and `.each` variants.

### Rule skeleton header

```js
// GENERATED from candidate: <observation-id>
// Observation count: N | Repos affected: N | AST confidence: N/10
// Review before publishing. See tests/rules/<rule>/RULE-NOTES.md
```

Visitor body is intentionally incomplete. The generator provides structure, fixtures, and context. The author fills in the visitor logic.

### Framework-agnostic detection

Rules use shared detection sets in `_shared.mjs`:

```js
const TEST_IDENTIFIERS = new Set(["it", "test", "it.each", "test.each"]);
const ASSERTION_IDENTIFIERS = new Set(["expect", "assert"]);
const SPY_FACTORIES = new Set([
  "vi.fn", "vi.spyOn",     // Vitest
  "jest.fn", "jest.spyOn", // Jest
]);
```

### Verification gate (`terrace lab benchmark <rule>`)

1. **Fixture gate** — all valid fixtures pass with zero reports; all invalid fixtures produce exactly the expected error
2. **Real-repo probe** — rule runs against Terrace's own test suite; any trigger is flagged for FP review
3. **Autofix check** — if the rule includes a `fix`, applying it to each invalid fixture must produce clean output on re-lint

All three must pass to advance to APPROVED.

---

## Section D — Rule Prioritization Model

### Scoring factors (weighted)

| Factor | Weight | What it measures |
|---|---|---|
| Recurrence | 25% | Distinct repos and sessions producing this pattern |
| Test quality impact | 20% | How badly the pattern undermines test suite confidence |
| AST detectability | 15% | How cleanly the pattern maps to a deterministic AST signature |
| False positive risk | 15% | Inverse — high FP risk lowers the score |
| Severity | 10% | How invisible this is to review without tooling |
| Agent frequency | 10% | How often AI agents specifically produce this pattern |
| Maintainability cost | 5% | How tightly coupled the rule is to framework internals |

### Promotion thresholds

| Composite score | Action |
|---|---|
| 7.5–10 | Auto-promote to CANDIDATE, flag for priority review |
| 5.0–7.4 | Promote to CANDIDATE, standard queue |
| 3.0–4.9 | Hold in CLASSIFIED, re-evaluate when recurrence grows |
| below 3.0 | Dismiss, log reason, keep in observation |

### Strategic value override

The scoring model can be manually overridden upward only. If a pattern is strategically critical even at low recurrence, `terrace lab flag <category> --reason "..."` force-promotes it to CANDIDATE with a logged rationale. No downward override — dismissal happens at the CANDIDATE stage.

---

## Section E — Test-Specific Anti-Slop Rules

### Rule maturity levels

- `default` — ships enabled (error) in all Terrace installs
- `template` — ships as warn in lightweight mode, configurable severity per project
- `optional` — off by default, explicitly opted in per repo

---

### `no-assertionless-test`

**Pattern:** `it`/`test` block with no `expect()` or `assert()` call in the callback body.

**Why:** The most common agent slop pattern. An agent under token pressure completes the test structure but omits the assertion. The test is green immediately, looks complete, and proves nothing. This is structurally compliant fake TDD.

**Detection:** Walk every `it`/`test` call. Traverse callback body for any `CallExpression` resolving to `expect` or `assert`. If none, report. Edge cases: shared assertion helpers (configurable via `assertionHelpers` in `.config/anti-slop.json`), `expect.assertions(n)` at top of block (valid — signals expectations will be checked).

**Maturity:** `default`
**Default severity:** `error`
**False positive risk:** Low
**Ship with v1:** Yes

---

### `no-spy-only-assertion`

**Pattern:** All `expect()` calls in a test block operate on spy variables only (declared via `vi.fn()`, `vi.spyOn()`, `jest.fn()`, `jest.spyOn()`), with no assertion on a return value or observable state.

**Why:** `toHaveBeenCalled()` alone verifies wiring, not behavior. Agents produce spy-only tests as a shorthand because the structural pattern (spy + expect = test) satisfies a surface reading of TDD. The behavioral requirement (the assertion tests something meaningful) is bypassed.

**Detection:** In each test block, track which variables are spy-derived. If every `expect()` call in the block operates on a spy variable and none operate on return values or state, report. A `toHaveBeenCalledWith()` with meaningful argument assertions is still flagged unless accompanied by a non-spy assertion — the distinction is argued in RULE-NOTES.md.

**Maturity:** `default`
**Default severity:** `warn` → `error` after STAGED validation confirms FP rate < 10%
**False positive risk:** Medium — integration tests that legitimately only verify call delegation exist. Escape hatch: `/* eslint-disable-next-line anti-slop/no-spy-only-assertion -- [rationale] */`
**Ship with v1:** Yes, after STAGED

---

### `no-mock-echo-test`

**Pattern:** A mock sets a literal return value; the assertion checks that exact literal on the function's output with no evident transformation.

**Why:** The mock defines the answer. The assertion checks the answer. The implementation is never involved — the test passes whether or not the function does anything. This is the canonical fake TDD pattern: 100% coverage, zero behavioral verification.

**Detection:** Heuristic. Detect when `mockReturnValue`/`mockResolvedValue` sets a literal value and a corresponding assertion checks that same literal on the return, with no transformation visible in the AST between setup and assertion. Conservative — only fires when the mock output appears unchanged.

**Maturity:** `template`
**Default severity:** `warn`
**False positive risk:** High — legitimate tests mock dependencies and check the caller correctly propagates values. Rule must be conservative.
**Ship with v1:** Yes

---

### `no-setup-predetermines-answer`

**Pattern:** `const expected = <literal>` in test setup; assertion references that variable directly against the result.

**Why:** When the expected value is assigned in setup and the assertion references it, the test becomes a tautology if the implementation matches. Agents produce this when uncertain what the correct value should be — they pick a number, put it in setup, assert against it.

**Detection:** In `it`/`test` blocks, find `const expected = <literal>` in setup, then find `expect(result).toBe(expected)` referencing that variable. Flag when the only source of the expected value is a setup-local literal. Does not fire when the constant is imported or declared at module scope.

**Maturity:** `template`
**Default severity:** `warn`
**False positive risk:** Medium
**Ship with v1:** Yes

---

### `no-snapshot-without-behavior`

**Pattern:** `toMatchSnapshot()` or `toMatchInlineSnapshot()` is the only `expect()` assertion in the test block.

**Why:** Whole-component snapshots are coverage theater. They catch accidental rendering changes but encode no behavioral knowledge. Agents produce snapshot tests as a shortcut to coverage metrics. Over time, snapshot files become large, frequently updated, and meaningless.

**Detection:** Flag `toMatchSnapshot()` / `toMatchInlineSnapshot()` calls in any test block containing no other `expect()` assertion.

**Maturity:** `default`
**Default severity:** `warn`
**False positive risk:** Low — the rule is precise: snapshot-only is flagged, snapshot + assertion is not.
**Ship with v1:** Yes

---

### `no-duplicate-test-behavior`

**Pattern:** Two `it` blocks within the same `describe` share structurally identical assertion patterns against the same function.

**Why:** Agents pad test counts without expanding behavioral coverage. Two tests with different names but identical assertion structure do not increase coverage of distinct behaviors — they inflate metrics while adding maintenance burden.

**Detection:** Heuristic. Compare assertion structure (ignoring literal values) and argument types across sibling `it` blocks. High false positive risk — parametric tests, boundary condition testing, and equivalence class tests all produce structurally similar tests intentionally. Needs extensive STAGED validation.

**Maturity:** `optional`
**Default severity:** `warn`
**False positive risk:** High — may be better handled by mutation testing than lint.
**Ship with v1:** No — needs more staging

---

### `require-assertion-count-in-async-test`

**Pattern:** Async `it`/`test` block containing `.then()` callbacks with `expect()` calls inside, but no `await` on the promise and no `expect.assertions(n)`.

**Why:** If the promise never resolves, the assertion never runs and the test reports green. This is a runtime failure class that lint can partially detect structurally.

**Detection:** In `async` `it`/`test` blocks, detect `.then()` calls containing `expect()` where neither `await` nor `expect.assertions()` appears in the block.

**Maturity:** `template`
**Default severity:** `warn`
**False positive risk:** Low — the specific AST combination is unambiguously risky.
**Ship with v1:** Yes

---

### Starter pack summary

| Rule | Maturity | Severity | v1 |
|---|---|---|---|
| `no-assertionless-test` | default | error | yes |
| `no-spy-only-assertion` | default | warn → error | yes, post-STAGED |
| `no-mock-echo-test` | template | warn | yes |
| `no-setup-predetermines-answer` | template | warn | yes |
| `no-snapshot-without-behavior` | default | warn | yes |
| `no-duplicate-test-behavior` | optional | warn | no |
| `require-assertion-count-in-async-test` | template | warn | yes |

---

## Section F — Terrace Architecture Changes

### Planner changes

**Rule injection into agent contract**
When a phase plan is generated, Terrace reads `.terrace/rule-registry.json` and injects active rules into the plan's agent contract block. The agent sees enforcement requirements before writing any code. Rules are presented with: name, what they catch, why they exist, and the override path.

**Test plan validation step**
Plans that include test writing add an explicit validation step: `terrace validate-tests` runs lint on test files before the plan is marked complete. A plan that writes hollow tests cannot be marked done.

### `terrace init` bootstrap

On install, `terrace init`:
1. Installs `eslint-plugin-anti-slop` at current version
2. Writes or merges `eslint.config.mjs` with default rule set at policy-mode-appropriate severities
3. Writes `.config/anti-slop.json` with configurable overrides
4. Adds `terrace lint` as a pre-commit hook step
5. Writes `.terrace/LINT-CONTRACT.md` — human-readable record of active rules, severities, and rationale

**Mode-severity mapping:**

| Policy mode | default rules | template rules |
|---|---|---|
| `lightweight` | warn | warn |
| `standard` | error | warn |
| `strict` | error | error |

### CI integration

Terrace adds a `terrace-lint` step to the generated CI workflow:

```yaml
- name: Terrace lint gate
  run: npx eslint --max-warnings 0 "**/*.test.{ts,tsx,js,jsx}"
```

Failure output is actionable: rule name, violation, file/line, override path, origin observation ID.

### `terrace lab` command surface

| Command | Action |
|---|---|
| `terrace lab status` | Observation ledger ranked by composite score |
| `terrace lab inspect <category>` | Sample observations, AST signature, FP risk |
| `terrace lab promote <category>` | Move pattern to CANDIDATE |
| `terrace lab dismiss <category> --reason` | Dismiss candidate, log reason |
| `terrace lab generate-rule <candidate-id>` | Scaffold rule, fixtures, notes |
| `terrace lab benchmark <rule>` | Fixture gate + real-repo probe + autofix check |
| `terrace lab approve <rule>` | Move to APPROVED, stamp metadata |
| `terrace lab stage <rule>` | Run against reference repos, measure FP rate |
| `terrace lab retire <rule> --reason` | Move to RETIRED |
| `terrace lab report` | Quarterly health summary |

The `terrace lab` surface is for the framework author only — not exposed to founder repos.

### Telemetry component

**Phase 1 (local):** Enforcement gates append to `.terrace/slop-observations.ndjson` (gitignored). Append-only, newline-delimited JSON.

**Phase 2 (remote, opt-in):** Same payload POSTed to Terrace telemetry endpoint, batched per session. Repo content is never sent. Events contain only: category, AST signature, framework, policy mode, timestamp, anonymized repo ID.

The Phase 1 event schema must be stable enough for Phase 2 with no migration.

### Rule registry

Two registries exist with distinct owners:

**Author registry** (`eslint-plugin-anti-slop/rule-registry.json`) — lives in the plugin package, committed to the plugin repo. Tracks the full lifecycle of every rule the author manages: `id`, `package`, `maturity`, `status`, `severity`, `origin_observations[]`, `observation_count`, `approved_at`, `staged_at`, `activated_at`, `fp_rate`, `last_evaluated`. This is the authoritative record of what shipped, why, and when.

**Target repo registry** (`.terrace/rule-registry.json`) — installed into each founder repo by `terrace init`. Read-only from the founder's perspective. Contains only the subset of fields needed for plan injection and agent contract generation: `id`, `maturity`, `status`, `severity`. Updated by `terrace update` when a new plugin version ships.

### Agent feedback during execution

When a lint rule fires during plan execution, the gsd-executor receives structured feedback:

```
LINT GATE FAILED — plan cannot be marked complete

Rule: anti-slop/no-assertionless-test
File: tests/payment.test.ts, line 34
Test: "charges the card on checkout"

This test has no expect() call. It will always pass regardless of
what the implementation does.

Required action: Add a behavioral assertion before this plan is complete.
Origin: obs_20260408_a3f1 (47 repos affected before this rule shipped)
```

`terrace validate-tests` must exit 0 before gsd-executor advances plan state.

---

## Section G — Improvement Lab Integration

### The feedback flywheel

```
Founder repo → agent writes code → lint fires
     ↓
Terrace logs observation event
     ↓
.terrace/slop-observations.ndjson (Phase 1) → telemetry endpoint (Phase 2)
     ↓
terrace lab classifies by recurrence + severity + AST confidence
     ↓
Author reviews candidates → promote → generate → benchmark → stage → approve
     ↓
New version of eslint-plugin-anti-slop ships to npm
     ↓
All Terrace-governed repos get the rule on next update
     ↓
Recurrence drops for that category → new failure classes surface
     ↓
Cycle repeats
```

### Promotion triggers

A pattern surfaces as a candidate when **any two** of the following are true:
- Recurrence crosses repo threshold (default: 10 distinct repos)
- Manual flag via `terrace lab flag <category>`
- Same category fails lint gate 3+ times in the same repo
- Composite score crosses 7.5

### Lab scope boundary

The lab does not auto-generate rules. It does not auto-approve candidates. It does not ship to npm without author review. The lab is a research and triage tool — the author is the editor. Automatically approved rules with insufficient review produce false positives that erode founder trust.

### Quarterly reevaluation

`terrace lab report` generates a health summary covering: active rule count, rules flagged for high FP rate, rules with zero triggers in 90 days, new candidates, observation volume. Rules that hurt founders get scoped down or retired. Rules that never fire get retired. The rule set stays lean and trusted.

---

## Section H — Deliverables Summary

### Implementation roadmap

**Pre-launch (internal validation, before Terrace v1 ships to founders):**
- Design and validate the 6 v1 starter rules against 3–5 reference repos (STAGED gate)
- Build the NDJSON observation ledger writer into `terrace-tools.cjs`
- Build `terrace lab status` and `terrace lab inspect` commands (read-only lab interface)
- Ship `no-assertionless-test` and `no-snapshot-without-behavior` as the first confirmed `default` rules

**Phase 1 (v1 launch):**
- `terrace init` installs `eslint-plugin-anti-slop` with full starter pack
- CI template includes `terrace-lint` gate
- Rule registry and `LINT-CONTRACT.md` written on init
- Agent contract injection from rule registry in plan generation
- `terrace validate-tests` gate in gsd-executor

**Phase 2 (post-launch):**
- Full `terrace lab` command surface including `generate-rule`, `benchmark`, `approve`, `stage`, `retire`
- Opt-in telemetry endpoint with anonymized event collection
- Cross-repo candidate classification from telemetry
- Quarterly `terrace lab report`

**Phase 3 (scale):**
- Telemetry dashboard for cross-repo pattern visibility
- Automated recurrence threshold alerts
- Rule performance tracking (FP rate from eslint-disable frequency in target repos)

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| False positives erode founder trust | STAGED gate required before every default rule ships; FP rate tracked in production; quarterly retirement review |
| Rules too brittle for diverse codebases | `template` and `optional` maturity levels; configurable override lists in `.config/anti-slop.json` |
| Telemetry opt-in rate too low for Phase 2 signal | Phase 1 local observation still valuable for single-repo patterns; opt-in incentive via "your data improves the rules you get" messaging |
| Rule generation scaffolds wrong AST pattern | Benchmark gate catches this before APPROVED; fixture minimums enforce edge case coverage |
| Schema drift between Phase 1 and Phase 2 | Schema versioned in `event_schema_version` field from day one; migration path documented in registry |
| Lab produces too many low-value candidates | Composite scoring with explicit thresholds; only author can promote; dismissal is cheap and logged |

### Agent contract example (injected into plan)

```
## Enforcement Contract (Active Rules)
The following lint rules are enforced in this repo. Violations block CI.
A plan with failing lint is not a complete plan.

  ✗ anti-slop/no-assertionless-test [error]
    Every it/test block must contain at least one expect() call.
    Tests with no assertions always pass and prove nothing.
    Origin: 47 repos affected before this rule shipped.

  ✗ anti-slop/no-spy-only-assertion [warn]
    Spy assertions (toHaveBeenCalled) must be accompanied by behavioral assertions.
    Checking the wiring exists is not the same as checking behavior is correct.

  ✗ anti-slop/no-snapshot-without-behavior [warn]
    Snapshot tests must include at least one non-snapshot assertion.

  ✗ anti-slop/no-mock-echo-test [warn]
    Do not assert the exact value you configured a mock to return.
    The implementation must be involved in producing the asserted result.

Override path: add eslint-disable comment with written rationale.
Rationale is visible in code review and logged in session artifacts.
```
