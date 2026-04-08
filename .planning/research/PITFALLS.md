# Pitfalls Research

**Project:** Terrace
**Researched:** 2026-04-05
**Confidence:** HIGH (derived from GSD patterns, AI dev framework failure modes, Terrace PRD analysis)

---

## Pitfall 1: Governance Overhead Kills Adoption

**What it is:** The framework becomes slower to use than doing the work manually. Developers start skipping governance phases, then stop using the framework entirely.

**Warning signs:**
- Interrogation loops take 30+ minutes before any implementation begins
- Session start protocol requires reading 5+ files before doing anything
- Every small change triggers a protected test + spec delta + decision log chain

**Prevention:**
- Policy file (`~/.terrace/policy.json` or `.terrace/policy.json`) controls which gates are active per project. Personal use can disable interrogation approval gates; large team projects enable all gates.
- "Fast path" for unambiguous small changes: if the change touches no protected artifacts and no spec-sensitive behavior, no governance required.
- Automatic effort routing caps inspect / classify / usage commands at low effort by default so routine work does not trigger expensive passes.
- Session start protocol reads at most 2-3 files. Not 10. Keep STATE.md + the most recently modified spec artifact.
- The interrogation loop has an exit condition: "stop when ambiguity is low enough that another strong engineer could build it." Not "stop when all possible edge cases are surfaced."
- `/terrace-usage` exposes repeated expensive workflows so overfiring becomes visible instead of normalized.

**Phase to address this:** Phase 1 (policy.json schema defines what's skippable) + Phase 3 (protected test policy must have a "fast path" exemption rule).

---

## Pitfall 2: Spec Drift — The Spec Becomes Stale and Is Ignored

**What it is:** Implementation evolves faster than the spec. Developers stop trusting the spec because it doesn't match reality. Eventually the spec is just documentation theater.

**Warning signs:**
- COMPILED-SPEC.md has a last-modified date weeks older than the code it describes
- Decision log has entries that contradict the spec without a corresponding spec update
- Builders stop reading the spec before implementing

**Prevention:**
- Change-control policy: any commit that touches a spec-sensitive file (detected by terrace-tools.cjs `spec validate`) triggers a prompt to update the spec.
- Spec has a version field + hash. If the hash in SESSION.md doesn't match the current spec hash, session start protocol alerts the user before any work begins.
- The spec is not a complete formal document. It's a living artifact. Keeping it current matters more than making it comprehensive.
- Decision log entries must reference spec_ref. If a decision changes behavior without a spec_ref, that entry is incomplete.

**Phase to address this:** Phase 4 (decision log enforcement) + Phase 5 (session hash check).

---

## Pitfall 3: Protected Tests Become a Maintenance Burden

**What it is:** The protected test registry grows without discipline. Eventually ~40% of tests are "protected," which means nothing is truly protected. Alternatively, protected tests couple tightly to implementation details and block legitimate refactors.

**Warning signs:**
- baseline-registry.json has >20% of test files listed as protected
- A refactor that changes no behavior requires multiple decision log entries just to reorganize test structure
- Protected tests fail on CI for reasons unrelated to behavior (e.g., snapshot diffs, import paths)

**Prevention:**
- Protected tests must test behavior, not implementation. A protected test that imports an internal function by name is testing the wrong thing.
- Only tests that map to a `spec_ref` can be protected. No spec reference = not protectable.
- Baseline registry has a `review_date` field. Every 30 days (or each milestone), review whether each protected entry is still the right anchor.
- The policy file limits what percentage of the test suite can be protected (suggested default: 15%).

**Phase to address this:** Phase 3 (baseline protection mechanism) must include quality criteria for what can be protected.

---

## Pitfall 4: Multi-Platform Abstraction Too Early

**What it is:** Building platform adapters before the governance workflows are stable means adapting the wrong thing. The adapter layer must be refactored as the workflows evolve.

**Warning signs:**
- Spending time on "how does this work in Cursor?" before v1 works in Claude Code
- Creating platform-specific workflow variants before the canonical workflow is proven
- Adding conditional branches in workflows for different platforms

**Prevention:**
- Hard scope boundary: v1 is Claude Code only. Multi-platform is v2.
- Design the governance workflows as pure markdown (no Claude Code tool dependencies in the logic itself) where possible. This is the correct default approach anyway.
- When a workflow step uses a Claude Code tool (AskUserQuestion, Agent), isolate it in a clearly marked section: `<!-- Claude Code only: ... -->`. This makes the future adapter job mechanical.
- Don't build the adapter layer until you have 2-3 platforms actually trying to use Terrace. Speculative adapters almost always adapt the wrong interface.

**Phase to address this:** Phase 2 (workflow definition) — document isolation markers from the start.

---

## Pitfall 5: Session Protocol That Nobody Uses

**What it is:** Session start/end protocols are defined but developers skip them because they're manual steps with no enforcement and no visible benefit.

**Warning signs:**
- `.planning/sessions/` directory is empty or has only 1-2 entries
- Builders routinely start work without knowing the current spec hash or last decision log entry
- "I forgot we decided that" appears frequently in chat

**Prevention:**
- Session start should be triggered automatically, not manually. Wire it to Claude Code's session start hook (which already exists in the user's AIOS setup).
- Session end should write something useful enough to make it worth running: not just a timestamp, but the 3 most important things that happened + what's risky + what's next.
- The session protocol must be fast. If `terrace-tools.cjs session start` takes more than 2 seconds, it will be skipped.
- Provide a visible payoff: session start prints the current spec version, current phase, and any unresolved risks from the last session. This makes it feel useful, not bureaucratic.

**Phase to address this:** Phase 5 (session protocol) must include the AIOS hook integration.

---

## Pitfall 6: Decision Log as Documentation Theater

**What it is:** The decision log is maintained but not enforced. Developers learn they can make behavioral changes without a decision log entry and nothing breaks. The log becomes historical decoration.

**Warning signs:**
- Decision log has entries but the pre-commit hook was never installed
- Protected test files were modified without decision log entries
- Decision log entries exist for minor choices but not for major behavioral changes

**Prevention:**
- Enforcement must be automatic, not social. The pre-commit hook is the only reliable enforcement mechanism.
- The hook must be installed by `terrace init`. If it's optional, it won't be installed.
- Decision log entries must be easy to create. `terrace-tools.cjs decision log` should be a one-liner that opens a template with the relevant spec_ref pre-filled.
- The hook checks for decision log entries, not just their existence. A blank entry file doesn't pass.

**Phase to address this:** Phase 4 (decision log enforcement) — hook installation must be part of `terrace init`.

---

## Pitfall 7: GSD Fork Divergence

**What it is:** Terrace diverges from the GSD codebase to the point where GSD upstream improvements cannot be applied. Terrace must maintain its own version of everything GSD provides.

**Warning signs:**
- Changes to GSD core files (gsd-tools.cjs, core workflows) to accommodate Terrace governance
- Terrace workflows import GSD workflow steps by copy-paste rather than by reference
- GSD upstream releases cannot be applied without merge conflicts in core files

**Prevention:**
- Terrace should extend GSD, not modify it. New files only; no changes to existing GSD files in v1.
- If a GSD file must be changed to accommodate Terrace, that's a signal to contribute the change upstream or to use a hook/override mechanism instead.
- Keep the GSD fork as a submodule or read-only reference (`get-shit-done/` directory) rather than copying files into the Terrace repo.
- Document which GSD files Terrace reads and which it extends. That list becomes the compatibility contract.

**Phase to address this:** Phase 1 (foundation) — establish the extension pattern before any GSD files are touched.

---

## Pitfall 8: Weak Test Architecture Documents (Test Matrix Theater)

**What it is:** The test matrix document (TEST-ARCH.md) is written but doesn't map behaviors to actual test locations. It's a plan that never connects to reality. Protected baseline tests don't actually cover the behaviors listed in the spec.

**Warning signs:**
- TEST-ARCH.md lists behaviors but no corresponding test file paths
- "Unit test" is listed for behaviors that require integration testing
- The test matrix hasn't been updated since Phase 3 but the spec has changed

**Prevention:**
- TEST-ARCH.md must reference actual test file paths (or planned paths) for each behavior. Abstract "unit test" entries are not acceptable.
- The Test Architect agent's output is reviewed against the spec: for each SPEC-XX entry, there must be a corresponding TEST-ARCH entry with a concrete test layer and rationale.
- At every milestone, run `terrace-tools.cjs baseline status` to compare the baseline registry against the TEST-ARCH entries. Missing coverage is flagged as a gap, not ignored.

**Phase to address this:** Phase 3 (baseline mechanism) must include `baseline status` that cross-references TEST-ARCH.

---

## Pitfall 9: Adversarial Review Without Teeth

**What it is:** The adversarial review phase produces a list of gaps, which are logged and then ignored. The next phase begins before gaps are resolved. Adversarial review becomes a formality.

**Warning signs:**
- ADVERSARIAL-REVIEW-[phase].md files exist but their gap lists never shrank
- Regression tests recommended in adversarial review were never added to the baseline
- The next phase started before all adversarial review gaps were closed or deferred with rationale

**Prevention:**
- Adversarial review produces a gap list with severity (blocking / non-blocking). Blocking gaps must be closed before the phase is considered complete.
- Non-blocking gaps are tracked in a backlog and reviewed at each milestone.
- Each gap must either: (a) have a regression test added, (b) have a decision log entry explaining why it's acceptable risk, or (c) be promoted to a future phase as a requirement.
- The GSD phase completion gate checks for open blocking adversarial review gaps.

**Phase to address this:** Phase 6 (adversarial review) — gap resolution must be a gate, not a suggestion.

---

## Pitfall 10: AI Model Changes Break Workflow Assumptions

**What it is:** Terrace's governance workflows are written assuming a specific level of LLM capability (instruction-following, structured output, multi-step reasoning). When the underlying model changes (new Claude version, switching to a different model), workflows behave differently.

**Warning signs:**
- Governance agents produce outputs that don't match template formats
- Interrogation loops terminate early because the model "decides" ambiguity is low
- Adversarial review agent fails to find real gaps because it's too agreeable

**Prevention:**
- Workflow files use explicit XML-tagged steps with concrete output format requirements — not open-ended instructions. This makes the workflow more robust to model variation.
- Output format requirements in agent definitions include quality gates with checkboxes. The model is asked to self-verify against these before writing output.
- When testing Terrace on a new model, run the governance workflow against a known PRD and compare outputs to expected format. Treat model changes as breaking changes.
- Keep agent system prompts focused and under 200 lines. Longer prompts drift more across model versions.

**Phase to address this:** Phase 2 (governance workflow definitions) — build quality gates into agent definitions from the start.

---

## Pitfall 11: Automatic Routing Becomes an Opaque Policy Layer

**What it is:** Terrace routes effort automatically, but users cannot see why a command was kept cheap or escalated. The system feels arbitrary instead of intelligent.

**Warning signs:**
- `/terrace-why` explains the current effort level without naming the signals that triggered it
- `/terrace-usage` shows totals but not repeated expensive workflows or token sinks
- local signals are not logged, so route decisions cannot be reconstructed from repo artifacts

**Prevention:**
- `/terrace-why` always reports the triggering signals and the deeper steps that were skipped
- `/terrace-usage` always surfaces repeated expensive workflows and concrete optimization opportunities
- deterministic preprocessing writes compact route records so route decisions stay explainable and auditable
