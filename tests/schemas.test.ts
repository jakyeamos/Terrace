import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const SCHEMAS_DIR = path.resolve(process.cwd(), 'src/schemas');

describe('JSON Schema: project-state.schema.json (TMPL-12, LIFE-01 through LIFE-06)', () => {
  let schema: Record<string, unknown>;
  let ajv: Ajv;

  beforeAll(() => {
    ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    schema = JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, 'project-state.schema.json'), 'utf-8'));
  });

  it('schema file exists at src/schemas/project-state.schema.json', () => {
    expect(fs.existsSync(path.join(SCHEMAS_DIR, 'project-state.schema.json'))).toBe(true);
  });

  it('schema requires all 5 Phase 1 fields: phase, spec_hash, active_slice, last_session, policy_mode', () => {
    const required = (schema as { required?: string[] }).required ?? [];
    expect(required).toEqual(expect.arrayContaining(['phase', 'spec_hash', 'active_slice', 'last_session', 'policy_mode']));
  });

  it('validates a correct project-state object', () => {
    const validate = ajv.compile(schema);
    const valid = validate({ phase: 'intake', spec_hash: null, active_slice: null, last_session: null, policy_mode: 'standard' });
    expect(valid).toBe(true);
  });

  it('rejects invalid policy_mode value', () => {
    const validate = ajv.compile(schema);
    const valid = validate({ phase: 'intake', spec_hash: null, active_slice: null, last_session: null, policy_mode: 'invalid-mode' });
    expect(valid).toBe(false);
  });

  it('rejects unknown phase value', () => {
    const validate = ajv.compile(schema);
    const valid = validate({ phase: 'nonexistent-phase', spec_hash: null, active_slice: null, last_session: null, policy_mode: 'standard' });
    expect(valid).toBe(false);
  });

  it('accepts null for spec_hash, active_slice, last_session', () => {
    const validate = ajv.compile(schema);
    const valid = validate({ phase: 'intake', spec_hash: null, active_slice: null, last_session: null, policy_mode: 'standard' });
    expect(valid).toBe(true);
  });

  it('allows additional properties (future extensibility for Phase 2+)', () => {
    const validate = ajv.compile(schema);
    const valid = validate({ phase: 'intake', spec_hash: null, active_slice: null, last_session: null, policy_mode: 'standard', extra_field: 'value' });
    expect(valid).toBe(true);
  });
});

describe('JSON Schema: preset-registry.schema.json (PRST-01)', () => {
  it('schema file exists at src/schemas/preset-registry.schema.json', () => {
    expect(fs.existsSync(path.join(SCHEMAS_DIR, 'preset-registry.schema.json'))).toBe(true);
  });

  it('schema requires version and presets fields', () => {
    const schema = JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, 'preset-registry.schema.json'), 'utf-8')) as { required?: string[] };
    expect(schema.required ?? []).toEqual(expect.arrayContaining(['version', 'presets']));
  });
});
