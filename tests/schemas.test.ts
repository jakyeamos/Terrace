import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const SCHEMAS_DIR = path.resolve(process.cwd(), 'packages/terrace-core/schemas');

describe('JSON Schema: state.schema.json', () => {
  let schema: Record<string, unknown>;
  let ajv: Ajv;

  beforeAll(() => {
    ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    schema = JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, 'state.schema.json'), 'utf-8'));
  });

  it('schema file exists at packages/terrace-core/schemas/state.schema.json', () => {
    expect(fs.existsSync(path.join(SCHEMAS_DIR, 'state.schema.json'))).toBe(true);
  });

  it('schema requires strict-core top-level state fields', () => {
    const required = (schema as { required?: string[] }).required ?? [];
    expect(required).toEqual(expect.arrayContaining(['workflow', 'roadmap', 'active_slice', 'red_gate', 'green_gate', 'protected_tests']));
  });

  it('validates a correct strict-core state object', () => {
    const validate = ajv.compile(schema);
    const valid = validate({
      schema_version: '1.0',
      project: { name: 'test', created_at: '2026-04-28T00:00:00.000Z' },
      workflow: { status: 'initialized', mode: 'strict', active_feature: null },
      roadmap: { phases: [] },
      active_slice: null,
      red_gate: {},
      green_gate: {},
      protected_tests: [],
      decisions: [],
      sessions: []
    });
    expect(valid).toBe(true);
  });

  it('rejects invalid workflow mode value', () => {
    const validate = ajv.compile(schema);
    const valid = validate({
      schema_version: '1.0',
      project: { name: 'test', created_at: '2026-04-28T00:00:00.000Z' },
      workflow: { status: 'initialized', mode: 'invalid-mode', active_feature: null },
      roadmap: { phases: [] },
      active_slice: null,
      red_gate: {},
      green_gate: {},
      protected_tests: [],
      decisions: [],
      sessions: []
    });
    expect(valid).toBe(false);
  });

  it('rejects unknown workflow status value', () => {
    const validate = ajv.compile(schema);
    const valid = validate({
      schema_version: '1.0',
      project: { name: 'test', created_at: '2026-04-28T00:00:00.000Z' },
      workflow: { status: 'nonexistent-status', mode: 'strict', active_feature: null },
      roadmap: { phases: [] },
      active_slice: null,
      red_gate: {},
      green_gate: {},
      protected_tests: [],
      decisions: [],
      sessions: []
    });
    expect(valid).toBe(false);
  });

  it('accepts null for active_slice and active_feature', () => {
    const validate = ajv.compile(schema);
    const valid = validate({
      schema_version: '1.0',
      project: { name: 'test', created_at: '2026-04-28T00:00:00.000Z' },
      workflow: { status: 'initialized', mode: 'strict', active_feature: null },
      roadmap: { phases: [] },
      active_slice: null,
      red_gate: {},
      green_gate: {},
      protected_tests: [],
      decisions: [],
      sessions: []
    });
    expect(valid).toBe(true);
  });

  it('allows additional properties (future extensibility for Phase 2+)', () => {
    const validate = ajv.compile(schema);
    const valid = validate({
      schema_version: '1.0',
      project: { name: 'test', created_at: '2026-04-28T00:00:00.000Z' },
      workflow: { status: 'initialized', mode: 'strict', active_feature: null },
      roadmap: { phases: [] },
      active_slice: null,
      red_gate: {},
      green_gate: {},
      protected_tests: [],
      decisions: [],
      sessions: [],
      extra_field: 'value'
    });
    expect(valid).toBe(true);
  });
});

describe('JSON Schema: preset-registry.schema.json (PRST-01)', () => {
  it('schema file exists at packages/terrace-core/schemas/preset-registry.schema.json', () => {
    expect(fs.existsSync(path.join(SCHEMAS_DIR, 'preset-registry.schema.json'))).toBe(true);
  });

  it('schema requires version and presets fields', () => {
    const schema = JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, 'preset-registry.schema.json'), 'utf-8')) as { required?: string[] };
    expect(schema.required ?? []).toEqual(expect.arrayContaining(['version', 'presets']));
  });
});
