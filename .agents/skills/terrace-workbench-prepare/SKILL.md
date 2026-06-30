---
name: terrace-workbench-prepare
description: Prepare production workbench evidence and optional handoff artifacts.
argument-hint: <feature> [--tier small|medium|large] [--for codex|claude|generic]
---

# Terrace Workbench Prepare

Run `terrace workbench prepare $ARGUMENTS`.

Inspect Terrace blockers, warnings, generated files, and next-command output before continuing. Do not bypass Terrace gates or claim success when the command reports blockers.
