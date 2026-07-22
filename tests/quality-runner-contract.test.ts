import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  createDefaultState,
  saveState,
  phasePlan,
  phaseExecute,
  phaseValidate,
  phaseReview,
  phaseComplete,
  alignFeature,
  testPlanFeature,
  observeFeature,
  validateProdFeature,
  cleanupFeature,
  qualityRunnerConfig
} = require('../packages/terrace-core/src/index.cjs');

describe('Quality Runner delivery contract adapter', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('keeps the adapter opt-in and gates one phase reconciliation path', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-quality-runner-'));
    const fakeRunner = path.join(tmpDir, 'fake-quality-runner.cjs');
    fs.writeFileSync(fakeRunner, `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const operation = args.includes('prepare') ? 'prepare' : args.includes('refresh') ? 'refresh' : args.includes('preflight') ? 'preflight' : 'reconcile';
const root = process.cwd();
const calls = path.join(root, '.quality-runner', 'qr-calls.log');
fs.mkdirSync(path.dirname(calls), { recursive: true });
fs.appendFileSync(calls, operation + '\\n');
if (operation === 'prepare' || operation === 'refresh') {
  const contractPath = path.join(root, '.quality-runner', 'runs', 'fake', 'delivery-contract.json');
  fs.mkdirSync(path.dirname(contractPath), { recursive: true });
  fs.writeFileSync(contractPath, JSON.stringify({ schema: 'quality-runner-delivery-contract-v0.1' }));
  console.log(JSON.stringify({
    schema: 'quality-runner-delivery-contract-v0.1',
    contract_id: 'qrdc-fake',
    contract_path: contractPath,
    qr_run_refs: [{ run_id: 'fake-run' }],
    analysis_mode: 'balanced',
    cache_mode: 'external',
    performance: { status: 'complete', phase_timings: {} },
    obligations: [{ id: 'hard:tests', kind: 'hard', title: 'Run tests', verification_commands: ['pnpm test'] }]
  }));
} else if (operation === 'preflight') {
  console.log(JSON.stringify({ status: 'ready', contract_id: 'qrdc-fake', blockers: [], coverage: [] }));
} else {
  console.log(JSON.stringify({ status: 'reconciled', contract_id: 'qrdc-fake', blockers: [], obligation_results: [] }));
}
`, 'utf8');
    fs.chmodSync(fakeRunner, 0o755);
    fs.mkdirSync(path.join(tmpDir, '.terrace'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.terrace', 'config.json'), JSON.stringify({
      quality_runner: {
        enabled: true,
        analysis_mode: 'balanced',
        cache_mode: 'external',
        command: fakeRunner,
        block_on: ['hard', 'stale', 'missing_evidence', 'plan_coverage']
      }
    }, null, 2) + '\n', 'utf8');
    const state = createDefaultState({ projectName: 'qr-fixture' });
    state.roadmap.phases = [{
      id: 'phase-qr-contract',
      title: 'Phase QR Contract',
      status: 'planned',
      source_ref: '.planning/ROADMAP.md',
      plans: [{ id: 'qr-01', title: 'Contract Plan', status: 'planned', source_ref: '.planning/PLAN.md' }]
    }];
    saveState(tmpDir, state);
    const planned = phasePlan(tmpDir, 'phase-qr-contract');
    expect(planned.quality_runner).toMatchObject({
      enabled: true,
      status: 'ready',
      contract_id: 'qrdc-fake',
      cache_mode: 'external'
    });
    const plan = fs.readFileSync(path.join(tmpDir, planned.plan_ref), 'utf8');
    expect(plan).toContain('Quality Runner Delivery Contract');
    expect(plan).toContain('pnpm test');
    expect(plan).toContain('npm while Quality Runner uses its pnpm-managed');

    alignFeature(tmpDir, 'phase-qr-contract', { tier: 'medium' });
    testPlanFeature(tmpDir, 'phase-qr-contract', { tier: 'medium' });
    observeFeature(tmpDir, 'phase-qr-contract', { tier: 'medium' });
    validateProdFeature(tmpDir, 'phase-qr-contract', { tier: 'medium' });
    cleanupFeature(tmpDir, 'phase-qr-contract', { tier: 'medium' });

    expect(phaseExecute(tmpDir, 'phase-qr-contract')).toMatchObject({
      allowed: true,
      quality_runner: { preflight: { status: 'ready' } }
    });
    const blocked = phaseValidate(tmpDir, 'phase-qr-contract');
    expect(blocked).toMatchObject({ allowed: false, blockers: [expect.objectContaining({ code: 'QR_DELIVERY_RESULT_MISSING' })] });

    const resultFile = path.join(tmpDir, planned.quality_runner.result_file);
    fs.mkdirSync(path.dirname(resultFile), { recursive: true });
    fs.writeFileSync(resultFile, JSON.stringify({ schema: 'quality-runner-delivery-result-v0.1' }), 'utf8');
    expect(phaseValidate(tmpDir, 'phase-qr-contract')).toMatchObject({
      status: 'validation_ready',
      quality_runner: { status: 'reconciled' }
    });
    expect(phaseReview(tmpDir, 'phase-qr-contract')).toMatchObject({ status: 'review_ready' });
    expect(phaseComplete(tmpDir, 'phase-qr-contract')).toMatchObject({ status: 'completed' });

    expect(fs.readFileSync(path.join(tmpDir, '.quality-runner', 'qr-calls.log'), 'utf8').trim().split('\n')).toEqual([
      'prepare',
      'preflight',
      'reconcile'
    ]);
    expect(qualityRunnerConfig(tmpDir).enabled).toBe(true);
  });
});
