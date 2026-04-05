# Stack Research

**Project:** Terrace
**Researched:** 2026-04-05
**Confidence:** HIGH (derived from live GSD source + Claude Code ecosystem)

---

## The Inherited Stack (GSD Baseline)

Terrace forks GSD. These are not choices — they are constraints.

| Layer | Technology | Why Inherited |
|-------|------------|---------------|
| Orchestration | Claude Code markdown workflows + XML-tagged steps | GSD's entire execution model depends on this |
| CLI tooling | Node.js 18+ / CommonJS (`.cjs`) | gsd-tools.cjs is CommonJS; agent spawning uses it |
| State management | Markdown files (STATE.md, ROADMAP.md, PROJECT.md) | GSD's filesystem-as-message-bus pattern |
| Subagents | Claude Code `~/.claude/agents/*.md` (YAML frontmatter + markdown body) | GSD's agent definitions follow this convention |
| Templates | Markdown with YAML frontmatter | GSD's template layer |
| Git integration | Native `git` via shell commands in gsd-tools.cjs | GSD commits planning docs; Terrace inherits this |

**Confidence:** HIGH — read directly from `~/.claude/get-shit-done/bin/gsd-tools.cjs` and workflow files.

---

## New Stack Decisions (Terrace-Specific)

### Governance CLI: `terrace-tools.cjs`

**Decision:** New Node.js CommonJS module, same pattern as gsd-tools.cjs.

**Rationale:**
- Stays consistent with the inherited CLI pattern — developers already know how to use it
- CommonJS avoids ESM/CJS interop friction in the Claude Code shell environment
- Node.js is already present (GSD depends on it)
- Thin CLI layer — not a framework, just file operations + JSON reads/writes

**What NOT to use:**
- TypeScript for the CLI itself — adds a build step that complicates the install experience. The CLI is 300-500 lines of Node; types add cost without benefit here.
- Deno / Bun — no evidence they work in Claude Code's shell environment
- Python — inconsistent availability; GSD chose Node, Terrace should stay consistent

**Libraries needed (minimal):**
- `fs` / `path` — stdlib, no dependency
- `child_process` (exec/execSync) — stdlib, for git operations
- `crypto` (createHash) — stdlib, for spec hashing in session protocol

**No external dependencies for the core CLI.** If JSON schema validation is needed for `.terrace/baseline-registry.json`, use a tiny inline validator rather than `ajv`.

**Confidence:** HIGH

---

### Pre-Commit Hook: Shell Script

**Decision:** Plain POSIX shell (`#!/bin/sh`), not a Node script, not a Python script.

**Rationale:**
- Runs without any runtime being available (git hooks run before PATH is fully initialized in some environments)
- The hook reads two files and exits 0 or 1 — there is no logic that requires a full runtime
- Maximum portability across Codex, Cursor, and other environments that also use git
- Single file, installable via `terrace init` (copies to `.git/hooks/pre-commit`)

**The hook does two things only:**
1. Check if any staged file matches a path in `.terrace/baseline-registry.json`
2. If yes, check that `docs/decisions/` has an entry dated today referencing that file's `spec_ref`

If Node.js is available, the hook can delegate to `terrace-tools.cjs baseline check-staged`. If not, it falls back to grep + jq.

**Confidence:** HIGH

---

### Governance Artifact Format: Markdown + YAML Frontmatter

**Decision:** All governance artifacts (COMPILED-SPEC.md, TEST-ARCH.md, DECISION-LOG.md, SESSION.md) use markdown with YAML frontmatter for machine-readable fields, prose body for human-readable content.

**Rationale:**
- Consistent with every other file in the GSD/Terrace ecosystem
- YAML frontmatter is parseable by the CLI without a markdown parser (just split on `---`)
- LLMs read and write markdown naturally — governance agents don't need special output formats
- Diffs are human-readable in git

**Key frontmatter fields per artifact type:**

```yaml
# COMPILED-SPEC.md
---
id: SPEC-2026-04-05
version: 1
requirements:
  - id: SPEC-01
    description: "..."
    protected: true
---
```

```yaml
# DECISION-LOG entry
---
date: 2026-04-05
spec_ref: SPEC-01
decision: "Changed behavior X"
rationale: "..."
author: session
---
```

**Confidence:** HIGH

---

### Baseline Registry: JSON

**Decision:** `.terrace/baseline-registry.json` — plain JSON, no schema validator runtime dependency.

**Rationale:**
- JSON is machine-readable without a parser library in Node.js (just `JSON.parse`)
- The pre-commit hook can use `node -e` to parse it if jq is unavailable
- Schema is small and stable (protected file list + policy flags)

**Confidence:** HIGH

---

### Distribution: Git-Based Install (npm Optional Later)

**Decision for v1:** Users clone or copy the Terrace repo into `~/.claude/terrace/` and run `terrace init` once. Same install model as GSD.

```sh
git clone https://github.com/user/terrace ~/.claude/terrace
node ~/.claude/terrace/bin/terrace-tools.cjs init
```

**`terrace init` does:**
1. Copies agent definitions to `~/.claude/agents/` (or `.claude/agents/` for project-scoped)
2. Adds skill entries to `~/.claude/settings.json`
3. Optionally installs the pre-commit hook in the current repo

**Why not npm for v1:**
- GSD itself does not use npm for distribution — consistent approach is better
- npm publishing adds release overhead; git clone is sufficient for personal use
- When open-sourcing, add npm/npx as an additional install path without changing the core

**Confidence:** MEDIUM (npm distribution deferred, not excluded)

---

### Multi-Platform: Not Decided (v2)

**What is known:**
- GSD targets Claude Code tool primitives (Skill tool, AskUserQuestion, Agent spawning)
- Codex uses different tool names (see GSD's references/copilot-tools.md)
- Cursor uses `.cursorrules` / system prompt injection, no tool primitives
- Ollama has no standardized tool calling framework for workflows

**Options for v2 (not choosing yet):**
1. **Platform adapter files** — separate workflow variants per platform, same underlying logic
2. **Markdown-first workflows** — write workflows as pure markdown that any LLM can follow; add tool-specific sections as optional enhancements
3. **Abstraction layer in terrace-tools.cjs** — CLI normalizes platform differences, workflows stay platform-agnostic

**Why not decide now:** All three options are valid. The right answer depends on how the governance workflows are actually structured in v1. Choosing an adapter architecture before the workflows exist means adapting the wrong thing.

**Confidence:** HIGH (on the deferral decision)

---

## Stack Summary

| Component | Technology | Status |
|-----------|------------|--------|
| Workflow orchestration | Markdown + XML tags (Claude Code) | Inherited from GSD |
| Execution subagents | `~/.claude/agents/*.md` | Inherited + extended |
| CLI tooling | Node.js CommonJS (`terrace-tools.cjs`) | New |
| Pre-commit hook | POSIX shell | New |
| Governance artifacts | Markdown + YAML frontmatter | New |
| Baseline registry | JSON (`.terrace/baseline-registry.json`) | New |
| Distribution | Git clone + `terrace init` | Same as GSD |
| Multi-platform adapters | TBD | v2 |
| TypeScript (framework code) | N/A — framework is markdown + Node scripts | N/A |
| TypeScript (user projects) | Strict mode enforced by spec | User project concern |
