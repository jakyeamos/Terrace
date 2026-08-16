# Conventions

- Preserve the CommonJS package boundary and use the existing module style in the file being changed.
- Keep TypeScript strict: `strict`, `noImplicitAny`, and `strictNullChecks` remain enabled.
- Prefer small pure core functions and explicit schemas over hidden global state.
- Add behavior-first tests for user-visible changes, migration transforms, security decisions, and compatibility surfaces.
- Keep generated state, local agent settings, credentials, raw prompts, and planning archives out of package contents.
- Keep documentation factual and update the smallest routed packet or canonical document when behavior changes.
- Use feature branches, scoped commits, and reviewable diffs. Preserve unrelated dirty work.
