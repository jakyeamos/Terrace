import { describe, it, expect } from 'vitest';

const {
  buildPhaseExecutionQueue,
  seniorCycleGateStatus
} = require('../packages/terrace-core/src/index.cjs');

describe('workflow pure helper extraction', () => {
  it('builds a phase execution queue from migrated plans and discovered validation commands', () => {
    const queue = buildPhaseExecutionQueue(
      {
        id: 'phase-11-notifications',
        title: 'Phase 11: Notifications',
        source_ref: '.planning/ROADMAP.md'
      },
      {
        plans: [
          { id: '11-01', title: 'Notification Plan', source_ref: '.planning/phases/11/11-01-PLAN.md' },
          { title: 'Fallback Copy' }
        ],
        likely_files: ['src/app/notifications/page.tsx', 'src/lib/notifications.ts']
      },
      {
        checks: [
          { category: 'lint', exists: true, command: 'pnpm run lint' },
          { category: 'test', exists: false, command: null },
          { category: 'typecheck', exists: true, command: 'pnpm run typecheck' }
        ]
      }
    );

    expect(queue).toEqual([
      {
        id: '11-01',
        title: 'Notification Plan',
        source_ref: '.planning/phases/11/11-01-PLAN.md',
        status: 'ready',
        wave: 1,
        likely_files: ['src/app/notifications/page.tsx', 'src/lib/notifications.ts'],
        validation_commands: ['pnpm run lint', 'pnpm run typecheck'],
        agent_prompt: 'Implement Notification Plan for phase-11-notifications, then run the listed validation commands and update Terrace state.'
      },
      {
        id: 'phase-11-notifications-task-2',
        title: 'Fallback Copy',
        source_ref: null,
        status: 'ready',
        wave: 2,
        likely_files: ['src/app/notifications/page.tsx', 'src/lib/notifications.ts'],
        validation_commands: ['pnpm run lint', 'pnpm run typecheck'],
        agent_prompt: 'Implement Fallback Copy for phase-11-notifications, then run the listed validation commands and update Terrace state.'
      }
    ]);
  });

  it('creates a fallback phase task when no migrated plan exists', () => {
    const queue = buildPhaseExecutionQueue(
      {
        id: 'phase-12-release',
        title: 'Phase 12: Release',
        source_ref: '.planning/ROADMAP.md'
      },
      { plans: [], likely_files: [] },
      { checks: [] }
    );

    expect(queue).toEqual([
      expect.objectContaining({
        id: 'phase-12-release-plan',
        title: 'Phase 12: Release',
        source_ref: '.planning/ROADMAP.md',
        status: 'ready',
        wave: 1,
        likely_files: [],
        validation_commands: []
      })
    ]);
  });

  it('gates medium senior-cycle work by execute, ship, and completion artifacts', () => {
    const status = seniorCycleGateStatus({
      feature: 'Billing Refresh',
      tier: 'medium',
      existingArtifacts: [
        'docs/terrace/features/billing-refresh/ALIGNMENT.md',
        'docs/testing/TEST-PLAN.md'
      ]
    });

    expect(status).toMatchObject({
      feature_id: 'billing-refresh',
      tier: 'medium',
      allowed: {
        execute: true,
        implement: true,
        ship: false,
        complete: false
      },
      missing_artifacts: [
        'docs/terrace/features/billing-refresh/OBSERVABILITY.md',
        'docs/terrace/features/billing-refresh/VALIDATION.md',
        'docs/terrace/features/billing-refresh/CLEANUP.md'
      ],
      next_command: 'terrace observe billing-refresh'
    });
    expect(status.blockers.map((blocker: { code: string }) => blocker.code)).toEqual([
      'OBSERVABILITY_REQUIRED',
      'VALIDATION_REQUIRED',
      'CLEANUP_REQUIRED'
    ]);
  });

  it('requires large-work codebase and design artifacts before execution', () => {
    const status = seniorCycleGateStatus({
      feature: 'billing-refresh',
      tier: 'large',
      existingArtifacts: [
        'docs/terrace/features/billing-refresh/ALIGNMENT.md',
        'docs/terrace/features/billing-refresh/INTERROGATION.md',
        'docs/testing/TEST-PLAN.md'
      ]
    });

    expect(status.allowed.execute).toBe(false);
    expect(status.allowed.implement).toBe(true);
    expect(status.next_command).toBe('terrace map-codebase');
    expect(status.blockers).toContainEqual(expect.objectContaining({
      code: 'CODEBASE_MAPPING_REQUIRED',
      artifact: 'docs/terrace/codebase/MAP.md'
    }));
    expect(status.blockers).toContainEqual(expect.objectContaining({
      code: 'DESIGN_REQUIRED',
      artifact: 'docs/terrace/features/billing-refresh/DESIGN.md'
    }));
  });
});
