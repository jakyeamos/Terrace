---
description: Run autonomous Terrace phase advancement until blockers, gates, or agent handoff require stopping.
---

<objective>
Advance Terrace roadmap work autonomously using Terrace as the workflow authority. Run the next Terrace action, inspect the JSON result, execute the requested implementation work when gates allow it, verify the result, and continue until Terrace reports a blocker, a handoff, or release-readiness work.

Creates or updates Terrace-owned artifacts such as `docs/terrace/phases/<id>/PLAN.md`, validation/review/summary files, `.terrace/state.json`, and the report card when invoked by Terrace commands.
</objective>

<context>
Start with `terrace autonomous --json`. That command performs the durable Terrace planning/readiness pass for the next phase and returns a structured `status`, `planned`, `execution`, blockers, and `next_command`.

Terrace does not bypass human decisions, RED gates, missing verification evidence, blocked migrated actions, or release gates. Treat any `blocked`, `blockers`, `required_action`, or non-null handoff action as authoritative.
</context>

<process>
1. Run `terrace autonomous --json`.
2. Inspect `status`, `next_command`, `planned`, `execution`, `blockers`, and generated artifact paths before editing code.
3. If Terrace reports blockers or required user input, stop and report the concrete blocker and next command.
4. If execution is allowed, read the generated phase plan and implement only that phase scope.
5. Run the smallest relevant verification from discovered project commands or the phase plan.
6. Add validation evidence, then run the Terrace next command such as `terrace phase validate <id>`, `terrace phase review <id>`, or `terrace phase complete <id>` when its gate is satisfied.
7. Repeat from `terrace next --json` or `terrace autonomous --json` only while Terrace continues to point at phase work and no blocker is present.
</process>

<stop_conditions>
- Terrace returns blockers, `allowed: false`, or a `required_action`.
- The next command requires user judgment, waiver approval, external credentials, or production access.
- The next command is release readiness (`terrace ship check` or `terrace ship prepare`). Run checks only when the user asked to ship; otherwise report the handoff.
- Verification cannot be run or fails.
</stop_conditions>

Do not claim the autonomous run completed unless Terrace gates and verification agree. Do not rewrite unrelated files or clear blockers manually.
