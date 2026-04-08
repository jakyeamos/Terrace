import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { installPreset, listPresets } = require('../src/lib/preset.cjs');

type PresetManifest = {
  id: string;
  name: string;
  version: string;
  category: string;
  effect: 'Read-only' | 'Read+Write';
  agents: string[];
  workflows: string[];
  fragments: string[];
  flags: Array<{ key: string; type: string; default: unknown }>;
};

type InstallResult = { conflict: boolean; message: string };

describe('Preset registry (PRST-01 through PRST-07, PRST-12 through PRST-14, CLI-13 through CLI-14)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-preset-test-'));
    fs.mkdirSync(path.join(tmpDir, '.terrace', 'presets'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.terrace', 'presets', 'registry.json'),
      JSON.stringify({ version: '1.0', presets: [] }),
      'utf-8'
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const baseManifest: PresetManifest = { id: 'terrace-tea', name: 'TEA', version: '1.0', category: 'testing', effect: 'Read+Write', agents: [], workflows: [], fragments: [], flags: [] };

  it('installPreset adds a new preset entry with id, name, version, installed_at, conflicts (PRST-02, D-13)', () => {
    installPreset(tmpDir, baseManifest, { force: false });
    const reg = JSON.parse(fs.readFileSync(path.join(tmpDir, '.terrace', 'presets', 'registry.json'), 'utf-8')) as { presets: Array<Record<string, unknown>> };
    expect(reg.presets).toHaveLength(1);
    expect(reg.presets[0].id).toBe('terrace-tea');
    expect(reg.presets[0]).toHaveProperty('installed_at');
    expect(Array.isArray(reg.presets[0].conflicts)).toBe(true);
  });

  it('installPreset is idempotent: re-running same id does not add duplicate entry (PRST-04, D-14)', () => {
    installPreset(tmpDir, baseManifest, { force: false });
    installPreset(tmpDir, baseManifest, { force: false });
    const reg = JSON.parse(fs.readFileSync(path.join(tmpDir, '.terrace', 'presets', 'registry.json'), 'utf-8')) as { presets: unknown[] };
    expect(reg.presets).toHaveLength(1);
  });

  it('installPreset surfaces conflict when same id is re-installed with a different version (PRST-07)', () => {
    installPreset(tmpDir, baseManifest, { force: false });
    const result = installPreset(tmpDir, { ...baseManifest, version: '2.0' }, { force: false }) as InstallResult;
    expect(result.conflict).toBe(true);
    expect(result.message).toContain('terrace-tea');
  });

  it('installPreset accepts all valid PRST-03 category values without error', () => {
    for (const category of ['governance', 'testing', 'frontend', 'security', 'integration']) {
      const id = `preset-${category}`;
      const result = installPreset(tmpDir, { id, name: id, version: '1.0', category, effect: 'Read-only', agents: [], workflows: [], fragments: [], flags: [] }, { force: false }) as InstallResult;
      expect(result.conflict).toBe(false);
    }
  });

  it('listPresets returns all installed presets as an array (CLI-14)', () => {
    installPreset(tmpDir, baseManifest, { force: false });
    const list = listPresets(tmpDir) as Array<{ id: string }>;
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('terrace-tea');
  });

  it('listPresets returns empty array when no presets installed', () => {
    const list = listPresets(tmpDir) as unknown[];
    expect(list).toHaveLength(0);
  });

  it('flag values written to .terrace/policy.json under namespaced key matching preset id (PRST-13)', () => {
    const flags = [{ key: 'tea_use_playwright_utils', type: 'boolean', default: true }];
    installPreset(tmpDir, { ...baseManifest, flags }, { force: false });
    const policy = JSON.parse(fs.readFileSync(path.join(tmpDir, '.terrace', 'policy.json'), 'utf-8')) as Record<string, Record<string, unknown>>;
    expect(policy['terrace-tea']).toHaveProperty('tea_use_playwright_utils');
  });
});
