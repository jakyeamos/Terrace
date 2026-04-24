# Assumption Logging Patterns

Use `docs/prd/CLARIFICATIONS.md` for every unanswered question, declined answer, or provisional section that affects behavior. Do not hide uncertainty in prose. Each open item gets its own entry so later Edit mode can resolve it without replaying the whole interview.

```markdown
## Assumption: <short title>

- assumption: <description of the assumption being made>
- status: unresolved
- resolution: deferred
```

Create an entry when an actor role is unclear, a permission boundary is missing, a state transition is guessed, a success criterion is provisional, or the user chooses fast-mode. Use `status: unresolved` only while the answer is still unknown. When the user gives an answer, change the status to resolved and replace `resolution: deferred` with the decision and short rationale.
