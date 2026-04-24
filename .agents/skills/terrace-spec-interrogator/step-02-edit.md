---
step: 2
mode: edit
next_step: step-03-validate.md
requires: "docs/prd/CLARIFICATIONS.md exists"
---

## Step 2: Edit — Targeted Interrogation Refinement

### Fragment Loading
Read `fragments/fragment-index.json`. Load all core-tier fragments before editing. Load extended edge-case fragments only when unresolved assumptions mention boundaries, state conflicts, or adversarial inputs.

### Existing Artifact Review
Read `docs/prd/CLARIFICATIONS.md` before asking anything. Identify entries marked `[PROVISIONAL]`, `status: unresolved`, or entries with missing resolution rationale.

### Targeted Revision
Revise only unresolved or provisional sections. Do not restart the five question rounds from scratch. Ask narrow follow-up questions tied to the specific open assumption and update the matching entry in place.

### Assumption Handling
For each resolved assumption, keep the original assumption text, change the status to resolved, and replace `resolution: deferred` with a short rationale. For assumptions that remain unanswered, preserve:

```markdown
- assumption: <description>
- status: unresolved
- resolution: deferred
```

### Output
Update `docs/prd/CLARIFICATIONS.md` in place. If new edge cases are discovered, append them to `docs/prd/EDGE-CASES.md` without rewriting unrelated content.
