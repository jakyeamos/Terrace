# Concerns

## Product Concerns

- Terrace is currently more compelling as a governance and migration layer than as a full daily driver replacing GSD.
- The roadmap lifecycle is stronger on execution than on authoring.
- Product intent is fragmented across README, design docs, and tests.

## Workflow Concerns

- No first-class `.planning/ROADMAP.md` for this repo means parity work is not yet managed as a normal project.
- Codebase mapping exists conceptually but is not yet established as a durable planning input for this repo.
- Session recovery is present, but not yet the obvious operational center of the product.

## Adoption Concerns

- A GSD user evaluating Terrace can see migration support, but not yet a complete replacement workflow.
- The largest visible gap is operator confidence: what is active, what is blocked, and what is safe to run next.

## Technical Concerns

- Adding too much runtime machinery would erode Terrace’s simplicity advantage.
- Avoid building a shallow copy of GSD’s engine internals when a smaller Terrace-native surface would satisfy the same user job.
