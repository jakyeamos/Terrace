---
description: Record a failed worker plan while preserving its branch for recovery or review.
argument-hint: <phase-id|run-id> <plan-id> --reason <text>
---

# Terrace Parallel Fail

Run `terrace parallel fail $ARGUMENTS`.

Inspect Terrace blockers, warnings, generated files, and next-command output before continuing. Do not bypass Terrace gates or claim success when the command reports blockers.
