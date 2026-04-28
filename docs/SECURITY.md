# Security Model

Terrace treats security-critical findings as non-bypassable by low-effort workflow modes. Pentest workflows require explicit authorized scope before findings can be processed as normal governance evidence.

The CLI does not run external scanners by default. Security scanner integrations should be added as explicit presets or CI jobs so users can review scope and permissions.
