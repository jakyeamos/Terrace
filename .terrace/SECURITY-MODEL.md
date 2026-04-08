---
version: "1.0"
artifact: SECURITY-MODEL
last_updated: "2026-04-07"
status: active
---

# Security Model

allowed_writes:
- .terrace/**
- docs/**

allowed_reads:
- repo files needed for validation and routing
- .terrace state and registry files

forbidden_modifications:
- paths outside repo root
- silent modification of GSD-owned state
- destructive rewrites without explicit command intent

hook_conflict_rules:
- detect incompatible hook owners
- report conflict with remediation
- do not auto-delete unknown hooks

policy_mode_transparency:
- expose active mode in project-state.json
- keep mode transitions explicit and auditable

trust_model:
- local filesystem is source of truth
- network access is out-of-band for core governance paths
- deterministic checks run before any escalation
