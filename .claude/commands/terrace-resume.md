---
description: Reconstruct paused Terrace workflow context.
---

# Terrace Resume

Run `terrace resume`.

Inspect Terrace blockers, warnings, generated files, next-command output, the durable `stage_run` ledger, and its `stop_packet` before continuing. Terrace rebuilds that ledger and stop packet from `.terrace/events.jsonl` when the snapshot is stale. Follow the safe next step and never perform the packet's forbidden bypass or claim success when the command reports blocked, failed, or active stages.
