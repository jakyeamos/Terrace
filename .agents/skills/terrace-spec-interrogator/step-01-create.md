---
step: 1
mode: create
next_step: step-02-edit.md
requires: "docs/prd/PRD.md exists OR user request provided"
---

## Step 1: Create — Structured Interrogation

### Fragment Loading
Read `fragments/fragment-index.json`. Load all fragments with tier: core before proceeding. Use extended fragments when the PRD has many unresolved lifecycle or permission questions, and use specialized fragments only for fast-mode or unusually constrained sessions.

### Question Rounds
Run these rounds in order, unless the early-stop rule applies:

1. Goals and success criteria: ask what outcome must be true, what failure looks like, and how success will be observed.
2. Actor permissions and roles: identify every actor, what each actor can do, what each actor cannot do, and which permissions are sensitive.
3. State transitions and lifecycle events: map initial, intermediate, terminal, retry, cancellation, and rollback states.
4. Edge cases and boundary conditions: probe empty inputs, maximum values, missing dependencies, conflicting actions, and limits.
5. Failure modes and recovery paths: ask how the system should behave on partial failure, unavailable services, invalid state, and user correction.

After each round, write resolved answers directly into the working interrogation notes and track open assumptions separately.

### Multiple-Choice Response Style
When a question has a small set of plausible answers, present 2-4 labeled choices before asking the user to respond. Use choices for scope, risk posture, rollout style, actor permissions, state handling, validation depth, and other bounded decisions where examples reduce friction.

Always include `Type your own answer` as a final option so the user can provide free-form context instead of selecting one of the proposed choices. Treat typed answers as first-class responses, and preserve any nuance from the typed answer in the interrogation notes.

Do not force multiple-choice format for questions that need narrative detail, domain facts, or source material. In those cases, ask the open question directly and make it clear that typing is expected.

### Early-Stop Rule
After each round, assess remaining open assumptions. If no high-priority ambiguities remain, skip subsequent rounds and proceed to output. Stop asking when no open assumptions remain below the threshold or when the user indicates complete.

### Intake Offer
When invoked immediately after intake, surface this exact prompt after the provisional PRD exists:

> PRD scaffolded at docs/prd/PRD.md. Run the Interrogation workflow to refine ambiguities? (y/N)

If the user answers yes, continue the structured rounds. If the user answers no, declines, or gives no usable response, activate the fast-mode path.

### Fast-Mode Path
If the user declines to answer questions: write `docs/prd/CLARIFICATIONS.md`. For each unresolved assumption, add an entry with fields: `assumption:`, `status: unresolved`, `resolution: deferred`. Do not invent answers.

Use this exact entry shape:

```markdown
## Assumption: <short title>

- assumption: <description of the assumption being made>
- status: unresolved
- resolution: deferred
```

Create one entry for every unanswered actor, permission, state transition, edge case, failure mode, non-goal, constraint, and success criterion that remains provisional.

### Output
Mandatory output: `docs/prd/CLARIFICATIONS.md`.

Optional output: `docs/prd/EDGE-CASES.md` when edge cases or failure modes need a dedicated artifact.
