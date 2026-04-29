# Question Round Templates

## Response Style
- Prefer multiple-choice prompts when the decision is bounded and the choices help the user move faster.
- Offer 2-4 concrete choices with short labels and one sentence of consequence or tradeoff for each choice.
- Always include a typed-response option, phrased as "Type your own answer", so the user can override, combine, or add context.
- Use open-ended questions when the answer depends on unknown domain facts, examples, files, stakeholders, or narrative context.

## Goals
- What user or operator outcome must be true after this feature works?
- Which observable signal proves the outcome was achieved?
- What is explicitly out of scope for this slice?
- What would make the implementation unacceptable even if the happy path works?

## Permissions
- Which actors exist, including system actors and unauthenticated users?
- What can each actor read, create, update, delete, approve, or export?
- Which actions require ownership, role membership, or elevated privilege?
- Which permission mistakes would expose data or allow escalation?

## State Transitions
- What is the initial state, and what event moves it forward?
- Which transitions are reversible, retryable, or terminal?
- What happens when two transitions are attempted concurrently?
- Which lifecycle events must be recorded for audit or recovery?

## Edge Cases
- What happens for empty, missing, duplicated, stale, or maximum-size inputs?
- What boundary values need different behavior from normal values?
- How should the workflow behave when related records are absent?
- What must remain true across pagination, filtering, sorting, or partial data?

## Failure Modes
- What should happen when a dependency is unavailable?
- Which failures are safe to retry, and which require manual intervention?
- What data must be preserved when a write partially fails?
- Which error messages need user-facing clarity versus internal diagnostics?
