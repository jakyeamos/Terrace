---
name: terrace-execute-phase-complete
description: Run a complete Terrace phase lifecycle from planning through completion.
---

# Terrace Execute Phase Complete

Run `terrace execute-phase-complete $ARGUMENTS`.

Inspect Terrace blockers, warnings, generated files, next-command output, the returned `stage_run` ledger, and any `stop_packet` before continuing. The plan, execute, validate, review, and complete stages are durably recorded as pending, active, passed, failed, or blocked and can resume after interruption. Follow the stop packet's owner and safe next step; never perform its forbidden bypass or claim success when the command reports blockers.
