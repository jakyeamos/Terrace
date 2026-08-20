---
description: Enter RED-gate execution for a phase after blockers are clear; use --parallel only for explicit non-overlapping plan ownership.
argument-hint: <phase-id> [--parallel]
---

# Terrace Phase Execute

Run `terrace phase execute $ARGUMENTS`.

Inspect Terrace blockers, warnings, generated files, and next-command output before continuing. Do not bypass Terrace gates or claim success when the command reports blockers.
