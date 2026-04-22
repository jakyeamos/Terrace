# Phase 2: Governance Workflows - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-22
**Phase:** 02-governance-workflows
**Mode:** discuss
**Areas discussed:** Agent file format & location, Step-file chaining mechanism, Fragment storage layout, Provisional PRD creation path

---

## Gray Areas Presented

### Agent file format & location
| Option | Description |
|--------|-------------|
| GSD-style .agents/skills/ | Each agent gets a subdirectory with SKILL.md; AGNT-07/08 fields inside the file |
| .terrace/agents/ — Terrace-owned | Agents under .terrace/; not directly invokable as skills; needs wrapper |
| Thin skill wrapper + .terrace agent definition | Separate invocation from definition; more files |

### Step-file chaining mechanism
| Option | Description |
|--------|-------------|
| Per-step .md files with next_step frontmatter | Each step is a file; YAML names the next; resume = re-read named file |
| Workflow JSON state file + numbered step directory | Persistent state file tracks position; more moving parts |
| Single workflow file with embedded step-jump table | One file, step table; harder to resume/test individual steps |

### Fragment storage layout
| Option | Description |
|--------|-------------|
| Agent-local fragments/ alongside SKILL.md | Self-contained; clean; Phase 6 presets add to the directory |
| Shared .terrace/fragments/ with agent namespacing | Centralized; better for cross-agent sharing but adds path complexity |
| Hybrid: core shared, specialized agent-local | Matches tier structure; most complex now |

### Provisional PRD creation path
| Option | Description |
|--------|-------------|
| Silent scaffold from request + steering.md | Fast path; user edits manually |
| Brief Q&A before scaffolding (3-5 questions) | More complete draft; slower; conflicts with EFF-02 |
| Two-stage: scaffold first, then auto-offer interrogation | Immediate artifact + optional refinement; clean intake/interrogation boundary |

---

## Decisions Made

### Agent file format & location
- **Chosen:** GSD-style `.agents/skills/` directories with SKILL.md
- **Rationale:** Phase 1 already scaffolded stubs this way; consistent with established GSD pattern; AGNT-07/08 fields live inside SKILL.md; no extra files or CLI bridges needed

### Step-file chaining mechanism
- **Chosen:** Per-step .md files with `next_step:` in YAML frontmatter
- **Rationale:** Simple, diffable, independently testable; resume = re-read the named file; no separate state file to maintain; clean alignment with WKFL-02 resume requirement

### Fragment storage layout
- **Chosen:** Agent-local — `fragments/` directory alongside each SKILL.md
- **Rationale:** Self-contained per agent; Phase 6 presets can add to the directory; matches FRAG-01 structure directly; no premature shared infrastructure

### Provisional PRD creation path
- **Chosen:** Two-stage — scaffold immediately, then auto-offer interrogation
- **Rationale:** User gets a concrete artifact at Stage 1 (low cost, fast); interrogation is optional and explicitly offered; clean separation between intake and interrogation workflows; OPS-02 fast-mode path activates if interrogation is declined

---

## Corrections Made

No corrections — all recommended options were accepted.

---

## Context loaded

- Phase 0 CONTEXT.md: D-04 (minimal intake = scaffold only, no CLI command in Phase 0); D-05/D-06 (CLI output conventions)
- Phase 1 CONTEXT.md: D-22/D-23 (skill stub format; Phase 1 created SKIL-01–27 stubs); D-06/D-07 (steering.md format and 500-token budget)
- REQUIREMENTS.md: WKFL-01–06, AGNT-07/08, FRAG-01–09, OPS-01–04 reviewed in full
- ROADMAP.md Phase 2: 6 success criteria, 6 plan definitions
