---
name: terrace-blocker-resolve
description: Record an evidence-bearing correction for one blocking action.
argument-hint: <id> --owner <owner> --evidence <ref>
---

# Terrace Blocker Resolve

Run `terrace blocker list --json` and identify the exact blocker ID.

Only after the named owner has completed the safe correction, run `terrace blocker resolve $ARGUMENTS --json` with both `--owner` and a durable `--evidence` reference. This command records the correction; it does not perform external work or waive the blocked gate.

Then follow the returned `next_command`. Never resolve a blocker speculatively, edit Terrace state by hand, or use this command as a bypass.
