---
id: terrace.done
title: Terrace Definition of Done
tier: project
status: active
last_reviewed: 2026-08-11
---

# Definition of Done

A source change is complete when its acceptance behavior is covered, `pnpm run
ci` passes, changed command and agent surfaces are documented, and generated
artifacts are inspected rather than inferred from a zero exit code.

A release candidate additionally requires the audit, package dry run, Terrace
ship check, and release preflight named in `commands.md`. A passing local source
gate does not prove npm publication or an installed global agent surface. Record
those as separately verified, blocked, or unknown.

When a gate reports a blocker, stop with the blocker and exact next command.
Do not weaken or bypass Terrace's protected-baseline, RED/GREEN, review, or
publication boundaries to declare completion.
