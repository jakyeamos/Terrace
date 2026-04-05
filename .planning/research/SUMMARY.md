# Research Summary

**Project:** Terrace
**Domain:** AI-assisted development framework (governance layer on GSD fork)
**Researched:** 2026-04-05
**Confidence:** HIGH

---

## Key Findings

### Stack

Terrace inherits GSD's full execution stack without modification: markdown + XML-tagged workflows as orchestrators, `~/.claude/agents/*.md` subagent definitions, `.planning/` file-as-message-bus state management, and `gsd-tools.cjs` as the only structured write path. These are constraints, not choices.

New stack decisions are deliberate and minimal: `terrace-tools.cjs` (Node.js CommonJS, no external deps), a POSIX shell pre-commit hook, markdown + YAML frontmatter for all governance artifacts, and `.terrace/baseline-registry.json` (plain JSON). Distribution mirrors GSD's git-clone + `terrace init` pattern. Multi-platform adapters are explicitly deferred to v2.

**Core technologies:**
- Markdown + XML-tagged steps: workflow orchestration — inherited from GSD, non-negotiable
- `~/.claude/agents/*.md`: subagent definitions — extended, not replaced
- `terrace-tools.cjs` (Node.js CJS, stdlib only): governance CLI — new, same pattern as gsd-tools.cjs
- POSIX shell pre-commit hook: baseline enforcement — new, maximally portable
- `.terrace/baseline-registry.json`: protected test registry — new, plain JSON

### Table Stakes

Must-have for v1 (absence causes abandonment or the framework has no purpose):

- Spec governance pipeline: PRD → interrogation → compiled spec → test architecture → protected baseline
- Session continuity via repo artifacts (STATE.md + spec hash), not conversational memory
- Protected test policy with actual enforcement (pre-commit hook, not convention)
- Decision log enforcement tied to behavioral changes touching protected files
- Single-command install that registers agents and optionally installs the hook
- Context reconstruction from files — cold-start agent can pick up work without chat history
- Seven distinct named agent roles, each isolated to its own `.md` definition

Differentiators (what separates Terrace from adequate alternatives):
- Interrogation loop that surfaces edge cases, permissions, state transitions, failure modes before implementation
- Acceptance criteria as durable artifacts, not implied from a prompt
- Behavioral coverage over line coverage — spec IDs link specs to tests to decision log entries
- Session start/end protocol writing SESSION.md artifacts that capture spec hash and open risks
- Adversarial review as a hard gate (blocking gaps must close before phase completes)

Defer to v2+:
- Multi-platform adapter layer (Codex, Cursor, Ollama)
- npm distribution
- Visual dashboard or web UI for governance artifacts

### Watch Out For

1. **Governance overhead kills adoption** — interrogation loops that take 30+ minutes or session starts that read 10 files will be skipped. Prevention: `.terrace/policy.json` makes gates configurable per project; session start reads at most 2-3 files; interrogation has a concrete exit condition ("ambiguity low enough another engineer could build it"). Address in Phase 1 (policy schema) and Phase 3 (fast-path exemption in protected test policy).

2. **Spec drift — spec becomes stale and ignored** — implementation evolves faster than the spec, developers stop trusting it. Prevention: spec has a version + hash; session start compares stored hash to current spec and alerts on mismatch; decision log entries must include `spec_ref` or they're incomplete. Address in Phase 4 (decision log enforcement) and Phase 5 (session hash check).

3. **Decision log as documentation theater** — the log is maintained but the hook was never installed, so nothing enforces it. Prevention: pre-commit hook installation is mandatory in `terrace init`, not optional; `terrace-tools.cjs decision log` is a one-liner with the relevant `spec_ref` pre-filled; blank entries don't pass the hook. Address in Phase 4.

4. **GSD fork divergence** — modifying GSD core files to accommodate Terrace governance means upstream improvements can't be applied. Prevention: Terrace adds new files only; no changes to existing GSD files in v1; GSD is treated as a read-only reference layer. Establish this constraint in Phase 1 before any GSD files are touched.

---

## Architecture Decisions

1. **File-as-message-bus, no inter-agent RPC.** Every agent hand-off is a file write followed by a file read by the next consumer. Governance layer writes to `docs/` prefix; execution layer writes to `.planning/` prefix. This boundary is enforced by directory convention — there are no cross-writes. Breaking this is the most common way multi-agent frameworks become unmaintainable.

2. **Separate agent per role, no monolithic governance agent.** Seven named roles (Spec Interrogator, Spec Compiler, Test Architect, Baseline Builder, Builder, Verifier/Adversary, Maintainer) each have their own `~/.claude/agents/*.md` file with a focused system prompt under 200 lines. Role switching is handled by workflow files, not by a single agent managing its own mode. Monolithic agents accumulate confused context across long sessions.

3. **Spec IDs as foreign keys across the system.** `SPEC-01`, `SPEC-02`, etc. are the linking mechanism between COMPILED-SPEC.md, TEST-ARCH.md, baseline-registry.json, and DECISION-LOG.md entries. The pre-commit hook checks `spec_ref` fields, not file names. This makes test file renames visible and intentional rather than silently breaking protection.

4. **Pre-commit hook is the only hard runtime gate.** Everything else in Terrace is workflow convention. The hook is the single enforcement point where "convention" becomes "blocked commit." It is a thin POSIX shell script that reads two files; it delegates to `terrace-tools.cjs` when Node is available and falls back to grep + jq otherwise.

5. **Governance-before-execution ordering is non-negotiable.** Governance phases (Intake through Protected Baseline) produce artifacts that constrain the GSD execution layer. The spec is written before the planner runs. The test architecture is approved before any code exists. This is the core of what Terrace adds over raw GSD — it cannot be reordered without destroying the value proposition.

---

## Build Order

Dependencies drive this sequence. Each phase produces artifacts consumed by the next.

**Phase 1 — Foundation (Templates + CLI skeleton)**
Templates define the file contracts that every subsequent phase writes to. If formats change after agents are built against them, all agents break. Build this first, stabilize it, don't touch it.
Delivers: PRD.md, SPEC.md, TEST-ARCH.md, DECISION-LOG.md, SESSION.md templates; `terrace-tools.cjs` scaffold with stub commands; `.terrace/` directory structure; `policy.json` schema.
Pitfall addressed: GSD fork divergence (establish extension-only pattern before touching anything).

**Phase 2 — Governance Workflow Definitions**
Depends on Phase 1 templates. Cannot write the Protected Baseline workflow until you know what COMPILED-SPEC.md and TEST-ARCH.md look like in practice — build governance workflows first to discover format edge cases.
Delivers: Intake workflow; Interrogation workflow + `terrace-spec-interrogator` agent; Spec Compilation workflow + `terrace-spec-compiler` agent; Test Architecture workflow + `terrace-test-architect` agent.
Pitfall addressed: Multi-platform abstraction too early — document `<!-- Claude Code only: -->` isolation markers from the start.

**Phase 3 — Baseline Protection Mechanism**
Depends on Phase 2 (baseline builder consumes TEST-ARCH.md output). The pre-commit hook format depends on what the baseline builder writes.
Delivers: `terrace-baseline-builder` agent; `terrace-tools.cjs baseline protect` and `baseline status` commands; POSIX shell pre-commit hook; Protected Baseline workflow; `.terrace/baseline-registry.json` enforced schema with quality criteria (only spec-linked, behavior-testing tests can be protected; default 15% ceiling).

**Phase 4 — Decision Log Enforcement**
Depends on Phase 3. The decision log is only valuable once there is something worth protecting — building the gate before the protected artifacts exist is premature.
Delivers: `terrace-tools.cjs decision log` command with pre-filled `spec_ref` template; pre-commit hook extension that checks decision log entries; decision log enforcement workflow reference; hook installation wired into `terrace init` (mandatory, not optional).

**Phase 5 — Session Protocol**
Depends on Phase 1 (templates), Phase 3 (spec hash to capture), Phase 4 (last decision log entry to surface). Sessions reference these artifacts — they must exist before sessions can capture them meaningfully.
Delivers: `terrace-tools.cjs session start` and `session end`; SESSION.md artifacts written to `.planning/sessions/`; spec hash comparison alerting on mismatch; AIOS stop hook integration.

**Phase 6 — Post-Build Governance (Adversarial Review + Regression Capture)**
Depends on GSD execution layer (inherited), Phase 3 (baseline must be operational to register new protected tests), Phase 4 (gaps produce decision log entries).
Delivers: `terrace-verifier-adversary` agent; Adversarial Review workflow with blocking/non-blocking gap severity; Regression Capture workflow; gap resolution as a hard phase completion gate (not a suggestion).

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Read directly from live GSD source; all new decisions use stdlib-only patterns |
| Features | HIGH | Derived from GSD source, Terrace PRD, and AI dev tooling ecosystem survey |
| Architecture | HIGH | Primary source is live GSD codebase + official Claude Code docs |
| Pitfalls | HIGH | Grounded in GSD patterns and direct analysis of Terrace PRD failure modes |

**Overall confidence:** HIGH

### Gaps to Address

- **Multi-platform adapter interface** — deferred to v2, but Phase 2 workflow definitions should use `<!-- Claude Code only: -->` markers from day one to make the future adapter work mechanical rather than exploratory.
- **Policy.json schema completeness** — the exact set of configurable gates (and their defaults for personal vs. team use) will only be fully known after Phase 2 governance workflows are drafted. Phase 1 should create the schema with known fields; expect additive changes through Phase 3.
- **AIOS hook integration specifics** — the session protocol integration with the user's existing AIOS stop hook is personal infrastructure. The session protocol itself should work standalone; AIOS wiring is a Phase 5 enhancement.

---

*Research completed: 2026-04-05*
*Ready for roadmap: yes*
