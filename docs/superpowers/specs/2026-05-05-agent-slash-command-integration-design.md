# Terrace Agent Init Integration Design

## Purpose

Terrace should become easy to use from Codex and Claude Code immediately after a project runs `terrace init`. Today Terrace has a strong CLI workflow and a natural-language router through `terrace do`, but new repositories do not receive repo-local agent entrypoints or slash-invokable Claude workflows.

The product outcome is a non-invasive agent bootstrap layer: `terrace init` installs a small repo-local agent starter kit by default, preserves user-owned files, and makes the Terrace workflow discoverable to both agents.

## Users And Success Criteria

Primary users are developers who install Terrace in an existing repository and then use Codex or Claude Code to plan, execute, validate, review, and ship work.

Success criteria:

- A fresh `terrace init` creates useful Codex and Claude Code integration files without extra flags.
- Existing `AGENTS.md`, `CLAUDE.md`, and `.claude` content is never overwritten.
- Claude Code users get repo-local slash-invokable Terrace workflows.
- Codex users get durable project instructions and repo-scoped Terrace skills that appear in Codex skill/slash discovery.
- Re-running `terrace init` is idempotent and reports written, skipped, and preserved agent assets.
- The npm package includes the templates and tests prove fresh, existing-file, and repeated-init behavior.

## Approach

`terrace init` will install agent files by default as part of the normal repo bootstrap. This is preferable to a flag-only or separate command because the user’s first run should produce an agent-ready repository. A separate `terrace agents install` command can be added later for repair, upgrades, or explicit template refreshes, but first-run integration should not depend on users discovering another command.

The bootstrap must be conservative. Terrace may create missing files and directories, but it must not edit or replace files that already exist. When a target exists, Terrace records it as skipped and returns a manual merge hint.

## Generated Assets

Terrace should manage a small manifest at `.terrace/agents/manifest.json`. The manifest records the agent integration schema version, the generated asset list, and the latest init result for each asset: written, skipped because the file already existed, or unchanged because the existing file already matches the current template.

For Codex, Terrace writes `AGENTS.md` when absent. The file should tell Codex to:

- Use Terrace as the workflow authority for spec-driven and test-governed work.
- Prefer `terrace next`, `terrace do "<intent>"`, phase commands, quick-task commands, and `terrace ship check`.
- Preserve spec and test evidence before protected implementation changes.
- Avoid bypassing repository gates.
- Keep changes scoped and recoverable.

Terrace also writes Codex repo skills under `.agents/skills/` when each skill is absent. The generated skill set mirrors the README command reference, with one `terrace-*` skill per stable command such as `terrace-next`, `terrace-align`, `terrace-phase-plan`, `terrace-quick-plan`, and `terrace-ship-check`.

Each skill must include `name` and `description` frontmatter so Codex can discover it.

For Claude Code, Terrace writes `CLAUDE.md` when absent with the same workflow contract in Claude-oriented language.

Terrace also writes Claude project skills under `.claude/skills/` and Claude project command files under `.claude/commands/terrace-*.md` for command-picker compatibility. The Claude assets mirror the same README command-reference set.

These skills and commands give Claude slash-invokable workflows such as `/terrace-next`, `/terrace-phase-plan`, and `/terrace-ship-check`. Each skill should be concise, include clear `name` and `description` frontmatter, and instruct Claude to run the relevant Terrace command, inspect the result, and continue only within the command’s reported gates.

## Platform Behavior

Claude Code has repo-local skills and project commands that are slash-invokable from `.claude/skills/<name>/SKILL.md` and `.claude/commands/<name>.md`, so Terrace should use both surfaces.

Codex support should use `AGENTS.md` plus repo skills under `.agents/skills/<name>/SKILL.md`. Codex skills require `name` and `description` frontmatter and are discovered from the current working directory up to the repo root.

## CLI Output

`terrace init` should report agent asset outcomes in human-readable output and JSON output. The JSON shape should include an `agents` object with `enabled: true`, the manifest path, and an array of asset results containing `path`, `type`, and `status`.

Statuses:

- `written`: Terrace created the file.
- `unchanged`: The file already matched the current Terrace template.
- `skipped`: The file existed and did not match the template, so Terrace preserved it.

Human output should call out skipped files with a short manual merge hint.

## Error Handling

Agent bootstrap failures should be surfaced as init warnings when core Terrace state was initialized successfully. A failure to write `AGENTS.md`, `CLAUDE.md`, `.claude/skills/*`, or the manifest should not leave partially reported success. Init should list the failed asset path and continue only when the repository remains in a recoverable state.

Path handling must stay repo-local and use the same safe path rules as existing Terrace artifact generation.

## Testing

Tests should cover:

- Fresh `terrace init` writes `AGENTS.md`, `CLAUDE.md`, `.agents/skills/terrace-*`, `.claude/skills/terrace-*`, `.claude/commands/terrace-*`, and `.terrace/agents/manifest.json`.
- Existing user files are preserved and reported as skipped.
- Re-running init after a fresh init reports unchanged assets.
- JSON mode includes agent asset results.
- Package dry-run includes templates or generated template code.
- README documents the new default behavior and the generated files.

No browser or visual validation is required for this feature.

## Rollout

This should ship as a minor feature in the next Terrace package version. Because it writes new files during `terrace init`, the README and troubleshooting docs should make the non-overwrite behavior explicit.

The generated command set should stay aligned with the stable README command reference and pass the same idempotence and preservation tests.
