# Architecture Patterns

**Project:** Terrace
**Researched:** 2026-04-05
**Confidence:** HIGH (primary source: live GSD codebase + official Claude Code docs)

---

## How GSD Is Actually Structured (Ground Truth)

This document derives from reading the live GSD source — not from inference. The architecture described below is what GSD does, which Terrace must extend with an automatic effort router, delta-based context loading, and usage intelligence.

### GSD Layer Map

```
~/.claude/get-shit-done/
├── workflows/          — Orchestrator instructions (markdown, XML-tagged steps)
├── references/         — Shared knowledge snippets loaded on-demand
├── templates/          — Scaffolding files for new artifacts
├── bin/
│   ├── gsd-tools.cjs   — CLI: all structured operations (state, phase, roadmap, commit)
│   └── lib/            — CLI internals: state.cjs, phase.cjs, roadmap.cjs, core.cjs ...

~/.claude/agents/       — Subagent definitions (markdown with YAML frontmatter)
  gsd-executor.md
  gsd-planner.md
  gsd-verifier.md
  gsd-phase-researcher.md
  gsd-project-researcher.md
  gsd-roadmapper.md
  ...

.planning/              — Per-project runtime state (lives in user repo)
  config.json
  STATE.md
  ROADMAP.md
  PROJECT.md
  REQUIREMENTS.md
  phases/
    01-name/
      01-01-PLAN.md
      01-01-SUMMARY.md
      01-VERIFICATION.md
      01-HUMAN-UAT.md
  todos/
  debug/
```

### Information Flow (GSD Baseline)

```
User invokes /gsd:execute-phase N
         │
         ▼
Workflow file (execute-phase.md) — orchestrator instructions
  Reads STATE.md and config.json via gsd-tools.cjs
  Discovers plans via phase-plan-index
  Groups plans into dependency waves
         │
         ▼  (per wave, parallel)
gsd-executor subagent(s)
  Fresh context window per agent
  Reads PLAN.md, PROJECT.md, STATE.md, CLAUDE.md
  Executes tasks, commits atomically
  Writes SUMMARY.md
  Updates STATE.md, ROADMAP.md via gsd-tools.cjs
         │
         ▼
gsd-verifier subagent
  Reads PLAN.md goals, actual codebase state
  Writes VERIFICATION.md
  Returns: passed / human_needed / gaps_found
         │
         ▼
Orchestrator marks phase complete via gsd-tools.cjs
Updates PROJECT.md, ROADMAP.md, STATE.md
```

**Key property:** Agents communicate only through files. No inter-agent RPC. The filesystem is the message bus. STATE.md is the session-spanning memory store. gsd-tools.cjs is the only write path for structured fields.

---

## Recommended Architecture for Terrace

### Automatic Effort Routing

Terrace should route before it reasons deeply.

- Local classifier first: command type, changed-file count, artifact categories, protected tests, spec artifacts, active slice, ambiguity, and safety-critical domain determine the default effort band.
- Deterministic preprocessors first: diffing, registry checks, requirement mapping, freshness checks, session reconstruction, and protected-artifact impact detection should happen locally before model escalation.
- Delta-context packet second: load only the steering file, route summary, spec hash, and impacted artifacts unless a trigger justifies more.
- AI escalator second: model-heavy work is reserved for ambiguity, tradeoffs, spec changes, and adversarial reasoning.
- Usage intelligence: `terrace-usage` reports overfiring workflows and `terrace-why` explains why a route was selected and what deeper steps were skipped.
- Trigger-based governance: full spec compilation, full test architecture regeneration, and adversarial review fire only when signals say they are worth the tokens.

### The Six Layers

```
Layer 6: Effort Router & Usage Intelligence (NEW — Terrace-specific)
  .terrace/routing-log.json   — Route decisions and skipped-step summaries
  .terrace/usage-log.json     — Compact usage telemetry
  Diagnostics: terrace usage, terrace why
  Responsibilities: classify, cap effort, explain route, detect waste

Layer 5: Governance Layer (NEW — Terrace-specific)
  docs/prd/         — PRD artifacts
  docs/spec/        — Compiled specs
  docs/testing/     — Test architecture docs
  docs/decisions/   — Decision log entries
  Governance workflows: intake, interrogation, spec-compile, test-arch,
                        protected-baseline, adversarial-review
  Governance subagents: terrace-spec-interrogator, terrace-spec-compiler,
                        terrace-test-architect, terrace-adversary

Layer 4: Agent Layer (GSD-inherited, Terrace-extended)
  ~/.claude/agents/  — Subagent definitions
  GSD agents: gsd-executor, gsd-planner, gsd-verifier, ...
  Terrace agents: terrace-spec-interrogator, terrace-spec-compiler,
                  terrace-test-architect, terrace-baseline-builder,
                  terrace-verifier-adversary

Layer 3: CLI Tooling Layer (GSD baseline + Terrace extensions)
  bin/gsd-tools.cjs           — GSD operations (unchanged where possible)
  bin/terrace-tools.cjs       — Governance operations:
    spec validate              — Check spec completeness
    spec link <req-id>         — Link spec to requirement
    decision log               — Write decision log entry
    baseline status            — Report protected test coverage
    baseline protect <file>    — Mark test file as protected
    session start / session end — Write session protocol artifacts
    decision require <commit>  — Enforce decision log before behavioral change

Layer 2: Skill/Workflow Layer (markdown definitions)
  workflows/ — Orchestrator instructions (GSD + Terrace governance workflows)
  references/ — Shared knowledge (GSD + Terrace governance references)

Layer 1: Template Layer (scaffold files)
  templates/ — PROJECT.md, REQUIREMENTS.md, ROADMAP.md, SPEC.md, PRD.md,
               DECISION-LOG.md, SESSION.md, TEST-ARCH.md
```

### Component Boundaries

| Component | Owns | Reads | Writes | Calls |
|-----------|------|-------|--------|-------|
| Effort router | Effort class selection | command class signals, diff summary, freshness signals | routing log, route summary | terrace-tools.cjs, local preprocessors |
| Usage reporter | Waste detection and explanation | routing log, usage log, session artifacts | usage summary, route explanation | terrace-tools.cjs |
| Delta packet builder | Compact context selection | steering.md, spec hash, impacted artifacts | delta-context packet | local preprocessors |
| Governance workflow | Session protocol | docs/prd/, docs/spec/, .planning/ | docs/decisions/, docs/testing/ | terrace-tools.cjs, spec subagents |
| Spec Interrogator agent | Ambiguity surface | PRD input, docs/spec/ | docs/spec/INTERROGATION.md | nothing |
| Spec Compiler agent | Spec truth | INTERROGATION.md, PRD | docs/spec/COMPILED-SPEC.md | nothing |
| Test Architect agent | Test structure | COMPILED-SPEC.md | docs/testing/TEST-ARCH.md | nothing |
| Baseline Builder agent | Protected tests | TEST-ARCH.md, codebase | test files (protected) | terrace-tools.cjs (baseline protect) |
| Adversary agent | Regression detection | COMPILED-SPEC.md, VERIFICATION.md | docs/decisions/ (gaps) | nothing |
| terrace-tools.cjs | Governance operations | docs/spec/, docs/decisions/, .planning/ | decision log, baseline registry | filesystem only |
| GSD execution layer | Plan execution | PLAN.md, STATE.md, CLAUDE.md | SUMMARY.md, STATE.md, ROADMAP.md | gsd-tools.cjs |
| GSD CLI (gsd-tools.cjs) | State + phase ops | .planning/ | .planning/ | git, filesystem |

**Strict rule:** Governance layer writes to `docs/` prefix. Execution layer writes to `.planning/` prefix. No cross-writes. The boundary is enforced by directory convention, not code.

### Data Flow — Full Terrace Lifecycle

```
ROUTING PRE-PASS
──────────────────────────────────────────────────────

[User provides command or PRD]
         │
         ▼
Effort router
  → local classifier
  → deterministic preprocessors
  → delta-context packet
  → route decision
         │
         ▼
Intake workflow
  → Creates docs/prd/PRD.md
  → Creates .planning/PROJECT.md (via template)
         │
         ▼
Interrogation workflow
  → Spawns terrace-spec-interrogator
  → Writes docs/spec/INTERROGATION.md
  → [Human approves interrogation output]
         │
         ▼
Spec Compilation workflow
  → Spawns terrace-spec-compiler
  → Reads PRD.md + INTERROGATION.md
  → Writes docs/spec/COMPILED-SPEC.md
  → [Human approves spec]
         │
         ▼
Test Architecture workflow
  → Spawns terrace-test-architect
  → Reads COMPILED-SPEC.md
  → Writes docs/testing/TEST-ARCH.md
  → [Human approves test arch]
         │
         ▼
Protected Baseline workflow
  → Spawns terrace-baseline-builder
  → Reads TEST-ARCH.md, codebase
  → Creates test files
  → Calls terrace-tools.cjs baseline protect <files>
  → Writes .terrace/baseline-registry.json
  → [Baseline locked — protected tests cannot be weakened]

GSD EXECUTION PHASES (mid-build, inherited)
──────────────────────────────────────────────────────

  → /gsd:plan-phase N
  → /gsd:execute-phase N  (planners, executors, verifiers)
  → [Regression gate runs — baseline tests must not regress]

TRIGGERED PHASES (Terrace-specific)
──────────────────────────────────────────────────────

  → Adversarial Review workflow (triggered by drift / ambiguity / safety signals)
  → Spawns terrace-verifier-adversary
  → Reads COMPILED-SPEC.md + VERIFICATION.md + actual codebase
  → Writes docs/decisions/ADVERSARIAL-REVIEW-[phase].md
  → Any discovered gaps → decision log entry required before closure

  → Regression Capture workflow (targeted additions preferred)
  → New test patterns from adversarial review added to TEST-ARCH.md
  → terrace-tools.cjs baseline protect <new files>
  → Baseline registry updated
```

### Protected Test Policy — Architecture Implications

The baseline registry (`/.terrace/baseline-registry.json`) is the enforcement point. Its architecture:

```json
{
  "version": 1,
  "protected": [
    {
      "file": "src/__tests__/auth.spec.ts",
      "spec_ref": "SPEC-03",
      "locked_at": "2026-04-05T12:00:00Z",
      "decision_required": true
    }
  ],
  "policy": {
    "require_decision_log": true,
    "require_spec_delta": true,
    "allow_additions": true,
    "allow_weakening": false
  }
}
```

**Enforcement mechanism:** Pre-commit hook reads the registry. Any staged changes to a protected test file trigger a check: is there a matching decision log entry in `docs/decisions/` dated today? If not, commit is blocked. This is the only place where Terrace imposes a hard runtime gate — everything else is workflow convention.

The pre-commit hook is a thin shell script; it does not require any Terrace CLI beyond reading two files. This makes it portable.

### Session Protocol — Architecture Implications

Session start/end are lightweight file operations, not daemon processes:

```
Session start:
  → terrace-tools.cjs session start
  → Reads STATE.md, docs/spec/COMPILED-SPEC.md
  → Writes .planning/sessions/SESSION-[timestamp].md
     Content: current spec hash, phase, last decision log entry

Session end:
  → terrace-tools.cjs session end
  → Appends to SESSION-[timestamp].md:
     Decisions made, files changed, spec alignment status
```

Sessions are repo artifacts (committed). The AIOS hooks the user already has can trigger these automatically if wired to Claude Code's stop hook.

---

## Patterns from the Broader Ecosystem

### What GSD Establishes (Confirmed HIGH confidence)

**1. File-as-message-bus pattern.** Agents never call each other directly. Every hand-off is a file write followed by a file read by the next consumer. This is the dominant pattern in all real multi-agent Claude Code frameworks examined.

**2. Workflow-as-orchestrator pattern.** Markdown files with XML-tagged steps ARE the orchestrators. They are not wrappers around code — they ARE the control flow, read by the LLM at runtime. Code only handles deterministic operations (state read/write, git, filesystem).

**3. Subagent isolation.** Each spawned agent gets a fresh context window. The parent passes file paths (not content) wherever possible to keep orchestrator context lean. This is the correct pattern for parallelism: no shared mutable state in-context, only shared mutable state on disk.

**4. CLI as structured write path.** gsd-tools.cjs is the only component that writes to STATE.md fields in a structured way. All agents call the CLI rather than manipulating markdown directly. This prevents agents from corrupting frontmatter.

**5. Templates as contracts.** Every document type has a canonical template. Templates define what fields exist, not just layout. Agents read templates to know what to produce; CLI tools parse known fields.

### What Terrace Adds (Architecture Decisions)

**6. Governance-before-execution ordering.** Governance phases (Intake through Protected Baseline) produce artifacts that constrain the execution layer. The spec is written before the planner runs. The test architecture is approved before any code exists. This is not a GSD pattern — it must be added.

**7. Spec as ground truth reference.** COMPILED-SPEC.md must be readable by every downstream agent (planner, executor, adversary). Its format must be stable enough that a regex or structured parse can verify alignment. Use YAML frontmatter with requirement IDs + prose body. Requirement IDs (SPEC-01, SPEC-02) are the foreign keys that link specs to tests to decision log entries.

**8. Decision log as change gate.** The decision log is not just a document — it is a predicate checked before commits to protected files. Architecture requirement: decision log entries must include a `spec_ref` field so the pre-commit hook can verify the entry is relevant.

**9. Agent role system as workflow switching.** The seven named agent roles (Spec Interrogator, Spec Compiler, etc.) are separate subagent definitions, not modes of a single agent. Each has its own `.md` file in `~/.claude/agents/` with a role-appropriate system prompt. Workflow files switch between them by `subagent_type` field.

---

## Suggested Build Order

Dependencies drive this ordering. Nothing can be built that depends on something not yet stable.

### Phase 1 — Foundation (Templates + CLI skeleton)
**Must exist before anything else.** Templates define file contracts. CLI skeleton establishes the write-path boundary, and the router scaffolds the cheap-default path.

- Template layer: PRD.md, SPEC.md, TEST-ARCH.md, DECISION-LOG.md, SESSION.md
- terrace-tools.cjs scaffold: commands exist but may return stubs
- .terrace/ directory structure and baseline-registry.json schema
- routing and usage-log scaffolds

Why first: Every subsequent phase writes files whose format is defined here. If formats change later, all agents break.

### Phase 2 — Governance Workflow Definitions
**Depends on:** Template layer (Phase 1)

- Intake workflow
- Interrogation workflow + terrace-spec-interrogator agent
- Spec Compilation workflow + terrace-spec-compiler agent
- Test Architecture workflow + terrace-test-architect agent
- route-trigger wiring for escalation

Why before baseline: You cannot write the Protected Baseline workflow until you know what COMPILED-SPEC.md and TEST-ARCH.md look like in practice.

### Phase 3 — Baseline Protection Mechanism
**Depends on:** Governance workflows (Phase 2), templates (Phase 1)

- terrace-baseline-builder agent
- terrace-tools.cjs `baseline protect` and `baseline status` commands
- Pre-commit hook (shell script, reads baseline-registry.json)
- Protected Baseline workflow

Why after governance: The baseline builder consumes TEST-ARCH.md output. The pre-commit hook format depends on what the baseline builder writes.

### Phase 4 — Decision Log Enforcement
**Depends on:** Baseline mechanism (Phase 3)

- terrace-tools.cjs `decision log` command and DECISION-LOG.md format
- Pre-commit hook extension: checks decision log when protected file changes
- Decision log enforcement workflow reference
- usage-report aggregation and waste visibility

Why after baseline: The decision log is only valuable once there is something worth protecting. Building the enforcement mechanism before the protected artifacts exist produces a gate with nothing to guard.

### Phase 5 — Session Protocol
**Depends on:** Templates (Phase 1), CLI (Phase 3)

- terrace-tools.cjs `session start` and `session end`
- SESSION.md template (already in Phase 1, now exercised)
- Integration with AIOS stop hook (optional, personal infra)
- delta-based reload before full reload

Why fifth: Sessions need to know what to capture (spec hash, phase, decision log). Those artifacts must exist before sessions can reference them meaningfully.

### Phase 6 — Post-Build Governance (Adversarial Review + Regression Capture)
**Depends on:** GSD execution layer (inherited), baseline mechanism (Phase 3), decision log (Phase 4)

- terrace-verifier-adversary agent
- Adversarial Review workflow
- Regression Capture workflow
- Integration point: after GSD's verify-phase-goal step
- trigger-based escalation only

Why last: Adversarial review compares implementation against spec. Both the spec and the implementation must exist. The regression capture pattern requires the baseline protection mechanism to be operational so new tests can be added to the registry.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Merging Governance State into .planning/STATE.md
**What goes wrong:** STATE.md is a 100-line sprint memory file. Adding spec alignment status, decision log pointers, and baseline registry references blooms it past readability.
**Instead:** Governance state lives in `docs/` prefix files. STATE.md holds a one-line pointer: `Spec: docs/spec/COMPILED-SPEC.md (hash: abc123)`.

### Anti-Pattern 2: Governance-as-Configuration (putting spec rules in config.json)
**What goes wrong:** config.json is for workflow behavior toggles (parallelization, branching, commit_docs). Putting spec rules there couples governance policy to GSD's config schema, which Terrace does not control.
**Instead:** Governance policy lives in `.terrace/policy.json` (a separate file with its own schema). terrace-tools.cjs reads it independently.

### Anti-Pattern 3: Single Monolithic Governance Agent
**What goes wrong:** One "terrace-governance" agent that can do Interrogation, Compilation, Test Architecture, and Adversarial Review has a bloated system prompt. Each role gets confused about its current context in a long session.
**Instead:** Separate agents per role. Each system prompt is under 200 lines. Role switching is handled by the workflow layer (spawning different subagent_type values), not by the agent itself.

### Anti-Pattern 4: Protecting Tests by File Path Only
**What goes wrong:** Test files get renamed, moved into subdirectories, or refactored. Path-based protection breaks silently.
**Instead:** Protected tests are identified by spec_ref (SPEC-01) in addition to path. The pre-commit hook looks for the spec_ref in the baseline registry; if the file moves, the registry entry requires manual update via terrace-tools.cjs (which makes the move visible and intentional).

### Anti-Pattern 5: Governance Phases That Block Each Other Unnecessarily
**What goes wrong:** Requiring full human sign-off at every governance transition slows the framework to a crawl for small projects, and treating every command like a deep governance pass burns tokens.
**Instead:** Human gates are configurable in `.terrace/policy.json`, but the router defaults to the cheapest safe path. Large projects set `require_approval: true` for each phase. Personal use can set `require_approval: false` for Interrogation/Compilation while keeping it for Protected Baseline. The workflow checks policy before pausing, and low-effort commands stay low-effort even under strict governance.

### Anti-Pattern 6: Manual Effort Selection as the Primary UX
**What goes wrong:** Users must choose lite / standard / deep for ordinary commands, so the framework spends more time asking for effort than doing work.
**Instead:** The router infers effort from signals, exposes the route on demand, and reserves explicit escalation for the rare cases where the local classifier cannot settle the question.

---

## Scalability Considerations

| Concern | Personal use (1 project) | Small team (3-5) | Larger adoption |
|---------|--------------------------|------------------|-----------------|
| Spec storage | `docs/spec/` in project repo | Same | Same — specs are per-project |
| Decision log | Per-project file | Same | Same |
| Baseline registry | `.terrace/` in project repo | Same | Same |
| Agent definitions | `~/.claude/agents/` (personal) | Project-level agents (`/.claude/agents/`) | Plugin distribution |
| terrace-tools.cjs | Global install | Global or npx | npm package |
| Pre-commit hook | Manual install | `terrace init` command | `terrace init` |

The filesystem-based architecture scales by convention not infrastructure. The only thing that requires active coordination at team scale is ensuring everyone has the same agent definitions — which is solved by moving them from `~/.claude/agents/` to `/.claude/agents/` (project-scoped) and committing that directory.

---

## Sources

- Live GSD source: `~/.claude/get-shit-done/` (read directly — HIGH confidence)
- Live agent definitions: `~/.claude/agents/gsd-*.md` (read directly — HIGH confidence)
- Claude Code subagent architecture: https://code.claude.com/docs/en/sub-agents (official docs — HIGH confidence)
- Claude Agent SDK skills: https://platform.claude.com/docs/en/agent-sdk/skills (official docs — HIGH confidence)
- GSD execute-phase.md workflow (runtime_compatibility section confirms file-as-bus pattern — HIGH confidence)
- Terrace PROJECT.md (project constraints — authoritative — HIGH confidence)
