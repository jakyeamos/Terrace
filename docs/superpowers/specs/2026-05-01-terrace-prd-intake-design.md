# Terrace PRD Intake Design

## Purpose

Terrace should have a first-class intake path for users who already have a PRD and want Terrace to turn it into durable project artifacts. Today, users can run the individual Senior Cycle commands, but there is no single command that clearly means "start this project from this PRD" or "start this feature from this PRD."

This design adds two related command surfaces:

- `terrace new-project <name>` starts a Terrace-managed project from a PRD.
- `terrace prd import <feature>` imports a later feature PRD into an existing Terrace project.

The mental model is simple: `new-project` starts the repo, `prd import` starts a feature.

## Product Principles

- PRD source text must be preserved before Terrace derives artifacts from it.
- File input and paste input are both first-class workflows.
- Project initialization should be safe to run in a fresh repo and should not overwrite existing user-authored artifacts without an explicit force flag.
- Feature intake should require an existing Terrace project so feature artifacts are tied to known state.
- The first version should compile structured artifacts deterministically from the PRD text without pretending to answer product questions the PRD does not cover.
- Generated artifacts should name missing evidence and suggest the next Terrace command instead of hiding ambiguity.

## Command Surface

### Project Initialization

Commands:

```sh
terrace new-project <name> --prd path/to/PRD.md
terrace new-project <name> --paste-prd
```

If neither `--prd` nor `--paste-prd` is provided, the command should fail with a clear usage message in the first implementation. Interactive paste can become the default later, but explicit input mode keeps the CLI predictable for tests and automation.

Responsibilities:

- Run existing `terrace init` behavior if `.terrace/state.json` is missing.
- Refuse to overwrite an existing initialized PRD intake unless `--force` is provided.
- Store the source PRD at `docs/prd/PRD.md`.
- Write derived project artifacts:
  - `docs/spec/COMPILED-SPEC.md`
  - `docs/spec/ACCEPTANCE-CRITERIA.md`
  - `docs/testing/TEST-PLAN.md`
  - `docs/terrace/project/INITIALIZATION.md`
- Update Terrace state with the project name, intake timestamp, source mode, and next recommended command.

### Feature PRD Import

Commands:

```sh
terrace prd import <feature> --file path/to/feature-prd.md
terrace prd import <feature> --paste
```

Responsibilities:

- Require an existing `.terrace/state.json`.
- Refuse to overwrite an existing feature PRD unless `--force` is provided.
- Store the source PRD at `docs/terrace/features/<feature>/PRD.md`.
- Write feature artifacts:
  - `docs/terrace/features/<feature>/ALIGNMENT.md`
  - `docs/terrace/features/<feature>/ACCEPTANCE-CRITERIA.md`
  - `docs/terrace/features/<feature>/TEST-PLAN.md`
  - `docs/terrace/features/<feature>/PRD-IMPORT.md`
- Set the next recommended command based on PRD completeness:
  - `terrace interrogate <feature>` when risks, assumptions, or edge cases are thin.
  - `terrace design <feature>` when the PRD already contains clear scope, actors, flows, constraints, and success criteria.

## Input Handling

File mode should read UTF-8 text from the provided path and include the original relative path in the import summary. Missing files, empty files, directories, and unreadable files should fail before any writes.

Paste mode should read from stdin until EOF. For terminal users, documentation should show heredoc usage:

```sh
terrace new-project hoopscout --paste-prd <<'PRD'
...paste PRD here...
PRD
```

This avoids fragile interactive sentinel parsing in the first version while still supporting pasted content. The first release should read stdin only for paste mode; a later version can add a friendlier prompt loop when `stdin` is a TTY.

## Artifact Semantics

`docs/prd/PRD.md` and feature `PRD.md` files are source artifacts. Terrace should write a short generated header with import metadata, followed by the original PRD body unchanged.

`COMPILED-SPEC.md` should extract and organize:

- problem statement
- target users
- goals and non-goals
- requirements
- constraints
- success metrics
- known risks
- open questions

`ACCEPTANCE-CRITERIA.md` should convert clear PRD requirements into behavior-oriented Given/When/Then criteria where possible. Requirements without enough detail should appear under "Needs Clarification" instead of being invented.

Project-level `docs/testing/TEST-PLAN.md` and feature-level `docs/terrace/features/<feature>/TEST-PLAN.md` should identify test layers, critical paths, likely fixtures, and missing test evidence. They should stay behavior-first and avoid framework-specific commands unless discovered project commands already exist.

`INITIALIZATION.md` and `PRD-IMPORT.md` should summarize what was created, which source was used, what confidence Terrace has in the generated artifacts, and the next command.

## State And Events

Project intake should append a `.terrace/events.jsonl` event with:

- command
- project or feature id
- source mode
- files written
- next command

State should record enough information for `terrace next`, `terrace report`, and future phase commands to identify that project intent has been captured from a PRD. The state schema should avoid storing the full PRD body; file paths and hashes are enough.

## Error Handling

The commands should fail before writing when:

- the PRD input is missing or empty
- the target artifact already exists and `--force` is absent
- `prd import` runs before `terrace init`
- the feature or project name cannot be slugified safely

Partial writes should be avoided by computing all target paths and generated content before writing. If a write fails mid-command, the command should report the files already written and exit nonzero.

## Testing

Core tests should cover:

- `terrace new-project <name> --prd <file>` in a fresh temp repo.
- `terrace new-project <name> --paste-prd` with stdin input.
- refusal to overwrite existing PRD artifacts without `--force`.
- `terrace prd import <feature> --file <file>` in an initialized repo.
- `prd import` failure before initialization.
- generated artifacts include source preservation, acceptance criteria, open questions, and next command.
- `terrace --help` and README command references include both commands.

## Implementation Notes

The implementation should reuse existing core helpers where possible:

- `initCore` for project initialization.
- existing artifact path helpers and safe slug handling from lifecycle/workflow modules.
- existing event writing conventions.
- existing README and command contract documentation patterns.

The first implementation should not call AI services or attempt semantic summarization beyond deterministic extraction and structured templating. If the PRD is vague, Terrace should preserve that vagueness as open questions and route the user to `terrace interrogate`.

## Non-Goals For First Release

- `terrace new-project <name>` should not create an initial roadmap phase. Phase creation remains separate until Terrace has a dedicated roadmap command.
- `--paste-prd` and `--paste` should read stdin only. Guided TTY paste prompts can be added later.
- The commands should not overwrite existing artifacts unless `--force` is provided.
