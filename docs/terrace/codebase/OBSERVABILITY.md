# Codebase Observability

## Current State

- Terrace persists reports, security evidence, events, and generated artifacts, but those are not yet a trustworthy freshness or side-effect model.
- No server/API telemetry is appropriate for this local CLI product.

## Target Debugging Surface

- `terrace status --json` exposes state revision, evidence freshness/scope, planned side effects, and a safe next action.
- Every mutation records prior/new revision, command plan, apply outcome, and backup/recovery details.
- Explicit project-script execution captures the command, timeout, exit code, and bounded output.
- Package and security evidence records selected inputs so generated corpus files cannot hide runtime coverage.
