import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const TEMPLATES_DIR = path.resolve(process.cwd(), 'src/templates');

const REQUIRED_TEMPLATES = [
  'PRD.md',
  'COMPILED-SPEC.md',
  'TEST-ARCH.md',
  'DECISION-LOG.md',
  'SESSION.md',
  'INVARIANTS.md',
  'ACCEPTANCE-CRITERIA.md',
  'PERMISSIONS-MATRIX.md',
  'EDGE-CASES.md',
  'STATE-MACHINES.md',
  'REGRESSIONS.md',
  'steering.md'
];

describe('Governance artifact templates (TMPL-01 through TMPL-12 and TMPL-13)', () => {
  it.each(REQUIRED_TEMPLATES)('template %s exists on disk', (name) => {
    expect(fs.existsSync(path.join(TEMPLATES_DIR, name))).toBe(true);
  });

  it.each(REQUIRED_TEMPLATES)('template %s has YAML frontmatter opening delimiter', (name) => {
    const content = fs.readFileSync(path.join(TEMPLATES_DIR, name), 'utf-8');
    expect(content.startsWith('---\n')).toBe(true);
    const endIdx = content.indexOf('\n---', 4);
    expect(endIdx).toBeGreaterThan(4);
  });

  it('PRD.md contains all required sections: problem, actors, desired_outcomes, non_goals, constraints, success_criteria, open_questions (TMPL-01)', () => {
    const content = fs.readFileSync(path.join(TEMPLATES_DIR, 'PRD.md'), 'utf-8');
    for (const section of ['problem', 'actors', 'desired_outcomes', 'non_goals', 'constraints', 'success_criteria', 'open_questions']) {
      expect(content, `PRD.md missing section: ${section}`).toContain(section);
    }
  });

  it('COMPILED-SPEC.md frontmatter contains all required fields (TMPL-02): spec_version, project, phase, requirements, protected, last_updated, source_refs', () => {
    const content = fs.readFileSync(path.join(TEMPLATES_DIR, 'COMPILED-SPEC.md'), 'utf-8');
    for (const field of ['spec_version', 'project', 'phase', 'requirements', 'protected', 'last_updated', 'source_refs']) {
      expect(content, `COMPILED-SPEC.md missing field: ${field}`).toContain(field);
    }
  });

  it('TEST-ARCH.md contains required mapping fields (TMPL-03): requirement_to_test_layer, rationale, fixture_needs, mock_policy, ci_tier', () => {
    const content = fs.readFileSync(path.join(TEMPLATES_DIR, 'TEST-ARCH.md'), 'utf-8');
    for (const field of ['requirement_to_test_layer', 'rationale', 'fixture_needs', 'mock_policy', 'ci_tier']) {
      expect(content, `TEST-ARCH.md missing field: ${field}`).toContain(field);
    }
  });

  it('DECISION-LOG.md contains required fields (TMPL-04): decision_id, date, author, spec_ref, change_type, rationale, impact, status', () => {
    const content = fs.readFileSync(path.join(TEMPLATES_DIR, 'DECISION-LOG.md'), 'utf-8');
    for (const field of ['decision_id', 'date', 'author', 'spec_ref', 'change_type', 'rationale', 'impact', 'status']) {
      expect(content, `DECISION-LOG.md missing field: ${field}`).toContain(field);
    }
  });

  it('steering.md has YAML frontmatter with required fields (TMPL-13, D-04): version, project, phase, policy_mode', () => {
    const content = fs.readFileSync(path.join(TEMPLATES_DIR, 'steering.md'), 'utf-8');
    for (const field of ['version', 'project', 'phase', 'policy_mode']) {
      expect(content, `steering.md frontmatter missing: ${field}`).toContain(field);
    }
  });

  it('steering.md has all 5 required directive sections (TMPL-13, D-04): intent, non_negotiables, agent_rules, scope_boundaries, change_control', () => {
    const content = fs.readFileSync(path.join(TEMPLATES_DIR, 'steering.md'), 'utf-8');
    for (const section of ['intent', 'non_negotiables', 'agent_rules', 'scope_boundaries', 'change_control']) {
      expect(content, `steering.md missing section: ${section}`).toContain(section);
    }
  });

  it('steering.md is under 500-token budget: word count must be less than 376 words (TMPL-13, D-05)', () => {
    const content = fs.readFileSync(path.join(TEMPLATES_DIR, 'steering.md'), 'utf-8');
    const wordCount = content.trim().split(/\s+/).length;
    expect(wordCount, `steering.md exceeds 375-word proxy for 500-token budget: ${wordCount} words`).toBeLessThan(376);
  });

  it('INVARIANTS.md contains invariant_id, scope, failure_severity (TMPL-06)', () => {
    const content = fs.readFileSync(path.join(TEMPLATES_DIR, 'INVARIANTS.md'), 'utf-8');
    for (const field of ['invariant_id', 'scope', 'failure_severity']) {
      expect(content, `INVARIANTS.md missing field: ${field}`).toContain(field);
    }
  });

  it('ACCEPTANCE-CRITERIA.md contains req_id and observable criterion (TMPL-07)', () => {
    const content = fs.readFileSync(path.join(TEMPLATES_DIR, 'ACCEPTANCE-CRITERIA.md'), 'utf-8');
    expect(content).toContain('req_id');
  });

  it('EDGE-CASES.md contains failure_mode, expected_behavior, severity, spec_ref (TMPL-09)', () => {
    const content = fs.readFileSync(path.join(TEMPLATES_DIR, 'EDGE-CASES.md'), 'utf-8');
    for (const field of ['failure_mode', 'expected_behavior', 'severity', 'spec_ref']) {
      expect(content, `EDGE-CASES.md missing field: ${field}`).toContain(field);
    }
  });

  it('REGRESSIONS.md contains bug_summary, root_cause, test_added, spec_ref (TMPL-11)', () => {
    const content = fs.readFileSync(path.join(TEMPLATES_DIR, 'REGRESSIONS.md'), 'utf-8');
    for (const field of ['bug_summary', 'root_cause', 'test_added', 'spec_ref']) {
      expect(content, `REGRESSIONS.md missing field: ${field}`).toContain(field);
    }
  });

  it('STATE-MACHINES.md contains entity, transitions, invalid_transitions (TMPL-10)', () => {
    const content = fs.readFileSync(path.join(TEMPLATES_DIR, 'STATE-MACHINES.md'), 'utf-8');
    for (const field of ['entity', 'transitions', 'invalid_transitions']) {
      expect(content, `STATE-MACHINES.md missing field: ${field}`).toContain(field);
    }
  });
});
