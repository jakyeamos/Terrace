# Integrations

## Current Product Integrations

- Codex via `AGENTS.md` and generated `.agents/skills/terrace-*`
- Claude Code via `CLAUDE.md`, `.claude/skills/`, and `.claude/commands/`
- local git repository state
- local project scripts discovered through `terrace commands discover`

## Release and Packaging Inputs

- npm package publishing
- local quality scripts: typecheck, lint, test, coverage, package dry-run

## Legacy Compatibility Surface

- `.planning/` import path through `terrace port gsd`
- GSD-compatible command aliases such as `plan-phase`, `execute-phase`, and related phase commands

## Missing Integration Classes Relative To GSD

- no broad runtime/provider orchestration layer
- no deep MCP/provider policy routing surface
- no richer worktree lifecycle automation surface
- no operator console/TUI integration layer

## Key Observation

Terrace’s current integrations are mostly repo-local and artifact-driven. That supports determinism, but it leaves a capability gap where GSD provides more live operational tooling.
