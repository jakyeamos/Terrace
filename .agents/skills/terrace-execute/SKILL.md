---
name: terrace-execute
description: Execute Terrace-governed work within recorded gates.
---

# Terrace Execute

Use `terrace do "$ARGUMENTS"` when arguments are provided. If no arguments are provided, run `terrace next` and follow the reported execution command.

Respect RED, GREEN, validation, and review gates. Stop at blockers instead of bypassing Terrace governance.
