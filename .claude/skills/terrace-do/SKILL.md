---
name: terrace-do
description: Preview natural-language intent; apply only the state-bound plan token returned for a reviewed write.
argument-hint: <intent> | --apply <plan-token>
---

# Terrace Do

Run `terrace do "$ARGUMENTS"` to resolve the intent. If it returns `requires_apply: true`, inspect the planned command, writes, and execution scope, then run the returned `apply.argv` exactly when that mutation is authorized.

Inspect Terrace blockers, warnings, generated files, and next-command output before continuing. Do not bypass Terrace gates or claim success when the command reports blockers.
