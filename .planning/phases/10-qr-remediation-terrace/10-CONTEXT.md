# Phase 10: QR remediation: terrace - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning
**Source:** PRD Express Path (/Users/jakyeamos/.local/state/quality-runner/fleet/per-repo-summaries-20260704/terrace.md)

<domain>
## Phase Boundary

Plan the remediation work for terrace from Quality Runner run qr-fleet-continue-20260704-terrace.
This phase is planning-only until execute-phase runs. Quality Runner remains advisory-only: it identifies findings, remediation clusters, and verification suggestions, but all source changes happen in /Users/jakyeamos/projects/Terrace.

Findings: 14
Severity: `blocker` 2, `observation` 3, `warning` 9
Categories: `capability` 3, `structural:deduplicate` 1, `structural:harden` 4, `structural:improve-tests` 1, `structural:ponytail` 2, `structural:simplify` 3
Fleet phase candidate: Phase 3 - Mixed Medium Repos
Requirement: QR-TERRACE

</domain>

<decisions>
## Implementation Decisions

### D-01 - QR summary is the planning source
- Use /Users/jakyeamos/.local/state/quality-runner/fleet/per-repo-summaries-20260704/terrace.md and the artifacts under /Users/jakyeamos/projects/Terrace/.quality-runner/runs/qr-fleet-continue-20260704-terrace as the source of truth for this remediation phase.

### D-02 - Cluster-oriented remediation
- Plan and execute coherent remediation batches by QR cluster, not one isolated edit per finding row.

### D-03 - Behavior preservation
- Prefer behavior-preserving refactors, hardening, and simplification. Do not change product behavior unless a QR hardening cluster explicitly requires safer behavior.

### D-04 - Existing project conventions first
- Read the target files and local manifests before editing. Follow existing package-manager, formatter, test, and architecture conventions. Use pnpm for JavaScript package scripts.

### D-05 - Evidence-backed closure
- A cluster is done only when focused repo verification passes and a post-remediation QR run shows the fingerprints cleared or are dispositioned with evidence.

### Claude's Discretion
- Choose exact helper extraction boundaries, naming, and task order when the QR document identifies the finding but not the implementation shape.
- If a cluster turns out to require product, API, or design decisions, stop that cluster and capture the question instead of guessing.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Quality Runner Inputs
- `/Users/jakyeamos/.local/state/quality-runner/fleet/per-repo-summaries-20260704/terrace.md` - Per-repo QR summary used as this phase PRD.
- `/Users/jakyeamos/projects/Terrace/.quality-runner/runs/qr-fleet-continue-20260704-terrace/quality-audit.json` - Quality audit report.
- `/Users/jakyeamos/projects/Terrace/.quality-runner/runs/qr-fleet-continue-20260704-terrace/remediation-plan.json` - QR remediation plan.
- `/Users/jakyeamos/projects/Terrace/.quality-runner/runs/qr-fleet-continue-20260704-terrace/code-quality-scan.json` - Code-quality scan fingerprints.
- `/Users/jakyeamos/projects/Terrace/.quality-runner/runs/qr-fleet-continue-20260704-terrace/resolution-ledger.md` - Resolution ledger for closure evidence.
- `/Users/jakyeamos/projects/Terrace/.quality-runner/runs/qr-fleet-continue-20260704-terrace/agent-handoff.md` - QR agent handoff.

</canonical_refs>

<specifics>
## Top Findings

- `missing-dead-code` blocker capability: Required quality capability is missing: dead_code. Fix: Add a dead-code scan command such as pnpm audit:dead-code. Evidence: Capability map lists dead_code as missing.; Missing command capability evidence: no quality command found for dead_code.
- `missing-formatter` blocker capability: Required quality capability is missing: formatter. Fix: Add a formatter command such as pnpm format. Evidence: Capability map lists formatter as missing.; Missing command capability evidence: no quality command found for formatter.
- `structural-simplify-deep-nesting` warning structural:simplify: 150 deep-nesting structural findings in simplification and shrink pass. Fix: 150 findings, aggregate score 900: Flatten guard clauses, extract decision helpers, or split rendering branches. Evidence: packages/terrace-core/src/artifact-analysis.cjs:65: deep-nesting; packages/terrace-core/src/lifecycle.cjs:490: deep-nesting; packages/terrace-core/src/lifecycle.cjs:1046: deep-nesting
- `structural-simplify-nested-ternary` warning structural:simplify: 17 nested-ternary structural findings in simplification and shrink pass. Fix: 17 findings, aggregate score 153: Replace nested ternaries with named branches or helpers. Evidence: packages/terrace-core/src/adoption.cjs:281: nested-ternary; packages/terrace-core/src/artifact-analysis.cjs:8: nested-ternary; packages/terrace-core/src/lifecycle.cjs:1467: nested-ternary
- `structural-deduplicate-near-duplicate-function` warning structural:deduplicate: 16 near-duplicate-function structural findings in duplicate consolidation and helper extraction. Fix: 16 findings, aggregate score 96: Extract a shared helper only when the call sites share domain semantics. Evidence: packages/terrace-core/src/json.cjs:6: near-duplicate-function; packages/terrace-core/src/json.cjs:17: near-duplicate-function; packages/terrace-core/src/lifecycle.cjs:14: near-duplicate-function
- `structural-simplify-large-source-file` warning structural:simplify: 5 large-source-file structural findings in simplification and shrink pass. Fix: 5 findings, aggregate score 45: Split mixed responsibilities into focused modules. Evidence: packages/terrace-core/src/lifecycle.cjs:1: large-source-file; packages/terrace-core/src/port-gsd.cjs:1: large-source-file; packages/terrace-core/src/workflow.cjs:1: large-source-file
- `structural-harden-user-controlled-file-path` warning structural:harden: 2 user-controlled-file-path structural findings in API hardening and unsafe sink cleanup. Fix: 2 findings, aggregate score 18: Resolve paths through an allowlisted root and reject traversal. Evidence: scripts/terrace-corpus-eval.cjs:370: user-controlled-file-path; scripts/terrace-corpus-eval.cjs:371: user-controlled-file-path
- `structural-harden-user-controlled-shell-command` warning structural:harden: 2 user-controlled-shell-command structural findings in API hardening and unsafe sink cleanup. Fix: 2 findings, aggregate score 18: Map user input to allowlisted command arguments. Evidence: scripts/vitest-run.cjs:22: user-controlled-shell-command; tests/core-cli.test.ts:24: user-controlled-shell-command

## Remediation Clusters

1. remediate-structural-src-terrace-tools-cjs (medium, score 707) - Remediate structural cluster in src/terrace-tools.cjs
2. remediate-structural-packages-terrace-core-src-lifecycle-cjs (medium, score 116) - Remediate structural cluster in packages/terrace-core/src/lifecycle.cjs
3. remediate-structural-packages-terrace-core-src-port-gsd-cjs (medium, score 81) - Remediate structural cluster in packages/terrace-core/src/port-gsd.cjs
4. remediate-structural-scripts-terrace-corpus-eval-cjs (medium, score 71) - Remediate structural cluster in scripts/terrace-corpus-eval.cjs

</specifics>

<deferred>
## Deferred Ideas

- Broad rewrites outside the QR clusters.
- Running Quality Runner as an executor or letting QR mutate source code.
- Remediating repos outside terrace; each repo gets its own GSD phase.

</deferred>

---

*Phase: 10*
*Context gathered: 2026-07-04 via QR per-repo PRD*
