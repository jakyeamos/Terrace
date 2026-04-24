# Fast-Mode Path

Use fast-mode when the user declines interrogation, asks to proceed with assumptions, or cannot answer enough questions to remove high-risk ambiguity. Fast-mode is allowed only if the uncertainty is written down immediately.

Write `docs/prd/CLARIFICATIONS.md` before proceeding. Use this exact format for each unresolved item:

```markdown
## Assumption: <short title>

- assumption: <description>
- status: unresolved
- resolution: deferred
```

Treat a round as insufficient when goals lack observable success criteria, permissions omit actor boundaries, lifecycle states do not name terminal or retry states, edge cases omit boundary conditions, or failure handling does not describe recovery. Do not invent answers; log the assumption and continue with the smallest safe interpretation.
