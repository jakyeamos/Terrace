# Permissions Matrix Format

Represent permissions as actor by capability rows. Each row should name the actor, allowed actions, denied actions, ownership constraints, role requirements, and sensitive data exposure. Call out tenant or workspace boundaries explicitly. If a permission is unknown, preserve it as an unresolved assumption instead of granting broad access.

Use this compact shape in `docs/spec/PERMISSIONS-MATRIX.md`:

| actor | can | cannot | scope | rationale |
|-------|-----|--------|-------|-----------|

Auth, permissions, money flow, data loss, and schema changes require a conservative interpretation and should be visible to the test architect as P0 candidates.
