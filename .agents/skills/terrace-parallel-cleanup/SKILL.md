---
name: terrace-parallel-cleanup
description: Remove isolated worktrees without deleting unmerged branches unless --force is explicit.
argument-hint: <phase-id|run-id>
---

# Terrace Parallel Cleanup

Run `terrace parallel cleanup $ARGUMENTS`.

Inspect Terrace blockers, warnings, generated files, and next-command output before continuing. Do not bypass Terrace gates or claim success when the command reports blockers.
