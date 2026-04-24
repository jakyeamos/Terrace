# Terrace Intake Workflow

**Trigger**: User provides a plain-English feature request or product intent.
**Spawns**: terrace-spec-interrogator (optional, on user confirmation)
**Produces**: docs/prd/PRD.md (always), docs/prd/CLARIFICATIONS.md (on fast-mode path)

## Stage 1: Provisional PRD Scaffold

### Idempotency Check
Before writing anything: check if `docs/prd/PRD.md` already exists.
- If PRD.md exists -> do not overwrite. Offer: "A PRD already exists at docs/prd/PRD.md. Edit it instead? (y/N)". If y, proceed to Edit mode and revise existing PRD. If N, abort and surface current PRD path.
- If PRD.md does not exist -> proceed to scaffold.

### Read Steering Context
Read `.terrace/steering.md`. Extract:
- `intent` -> informs problem framing
- `non_negotiables` -> maps to PRD non_negotiables section
- `scope_boundaries` -> maps to PRD scope_boundaries section

### Scaffold docs/prd/PRD.md
Create `docs/prd/` directory if absent. Write docs/prd/PRD.md with the following section population:

| Section | Source |
|---------|--------|
| problem | User request text |
| desired_outcomes | User request text |
| non_negotiables | steering.md non_negotiables field |
| scope_boundaries | steering.md scope_boundaries field |
| actors | [PROVISIONAL - run interrogation to refine] |
| non_goals | [PROVISIONAL - run interrogation to refine] |
| constraints | [PROVISIONAL - run interrogation to refine] |
| success_criteria | [PROVISIONAL - run interrogation to refine] |
| open_questions | [PROVISIONAL - run interrogation to refine] |

## Stage 2: Interrogation Offer

Immediately after writing docs/prd/PRD.md, output exactly:

> PRD scaffolded at docs/prd/PRD.md. Run the Interrogation workflow to refine ambiguities? (y/N)

If user responds **y**: instruct the user to invoke the terrace-spec-interrogator agent at `.agents/skills/terrace-spec-interrogator/SKILL.md`. The interrogator will read `step-01-create.md` and begin structured question rounds.

If user responds **N** or does not respond: activate the fast-mode path below.

## Fast-Mode Path (OPS-02)

When user declines interrogation: MUST write `docs/prd/CLARIFICATIONS.md` before proceeding. Do not skip this step. For each assumption that was not answered during intake, add an entry:

```markdown
## Assumption: <short title>

- assumption: <description>
- status: unresolved
- resolution: deferred
```

Assumptions to log on fast-mode path include actor roles, non-goals scope, key constraints, and success criteria that remain at [PROVISIONAL].
