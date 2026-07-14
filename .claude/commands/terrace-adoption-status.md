---
description: Answer whether Terrace can replace GSD yet, with readiness evidence and next commands.
---

# Terrace Adoption Status

Run `terrace adoption status`.

Use the answer to the `Can Terrace replace GSD for me yet?` question as the adoption verdict. Inspect `recommended_mode`, `readiness_summary`, `evidence`, `blockers`, `next_steps`, and `next_commands` before recommending GSD retirement.

If `recommended_mode` is `replace_gsd`, Terrace can be treated as the default workflow entrypoint. If it is `pilot_with_gsd_fallback`, use Terrace for active work but keep GSD fallback paths until the listed blockers are resolved. If it is `keep_gsd`, do not claim Terrace is ready to replace GSD.

Run or report the concrete commands from `next_commands` rather than giving generic adoption advice. Do not bypass Terrace gates or claim success when the command reports blockers.
