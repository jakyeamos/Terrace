---
name: terrace-execute-phase-complete
description: Run a complete Terrace phase lifecycle from planning through completion.
---

# Terrace Execute Phase Complete

Run `terrace execute-phase-complete $ARGUMENTS` when a phase is provided. If no phase is provided, run `terrace next` first and use the reported phase id.

Inspect each returned step. Stop at blockers and do not bypass senior-cycle, security, validation, review, or cleanup gates.
