---
version: "1.0"
project: "{{PROJECT_NAME}}"
phase: "{{CURRENT_PHASE}}"
policy_mode: "{{POLICY_MODE}}"
---

# Steering

intent: Keep governance tight and cost-aware.
non_negotiables: spec-linked changes, protected tests, explicit rationale.
agent_rules: local-first analysis, deterministic checks before escalation.
scope_boundaries: write only approved artifact and config paths.
change_control: behavior changes require spec_ref and decision entry.
