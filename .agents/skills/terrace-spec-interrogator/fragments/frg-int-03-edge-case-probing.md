# Edge Case Probing Patterns

## Boundary Conditions
Probe numeric, time, list-size, pagination, and text-length boundaries. Ask about empty input, one item, maximum items, duplicate identifiers, stale references, missing optional data, and records created before the current schema existed. For permissions, test the edges between owner, collaborator, admin, unauthenticated user, and suspended user.

## Compound Failures
Look for two state changes happening at the same time: cancellation during approval, deletion during export, retry after partial persistence, or role removal while a request is pending. Ask what invariant must win when two valid actions conflict.

## Adversarial Inputs
Check max-length strings, blank strings, unexpected markdown or HTML, path-like input, repeated submissions, permission escalation attempts, and data from another tenant or workspace. Capture any unanswered decision as an assumption instead of inventing behavior.

## Operational Edges
Ask how the system behaves during deploys, migrations, backfills, clock skew, webhook replay, deleted dependencies, and stale client sessions. For integrations, capture retry windows, idempotency keys, rate limits, and observability signals before implementation begins.
