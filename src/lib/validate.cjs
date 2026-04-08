'use strict';

const fs = require('fs');
const path = require('path');
const { parseFrontmatter } = require('./core.cjs');

const REQUIRED_SECTIONS = {
  'PRD.md': ['problem', 'actors', 'desired_outcomes', 'non_goals', 'constraints', 'success_criteria', 'open_questions'],
  'COMPILED-SPEC.md': ['spec_version', 'project', 'phase', 'requirements', 'protected', 'last_updated', 'source_refs']
};

const DEFAULT_MAPPING = {
  'PRD.md': 'docs/prd/PRD.md',
  'COMPILED-SPEC.md': 'docs/spec/COMPILED-SPEC.md',
  'DECISION-LOG.md': 'docs/spec/DECISION-LOG.md'
};

function checkRequiredSections(result, filePath, sections) {
  const content = fs.readFileSync(filePath, 'utf8');
  for (const section of sections) {
    if (!content.includes(section)) {
      result.blocking.push({
        code: 'MISSING_REQUIRED_SECTION',
        message: 'Missing required section: ' + section,
        file: filePath
      });
    }
  }
}

function validateArtifacts(cwd, config) {
  const result = {
    blocking: [],
    warnings: []
  };

  const cfg = config || {};
  const mapping = { ...DEFAULT_MAPPING, ...(cfg.file_mapping || {}) };

  try {
    const prdPath = path.resolve(cwd, mapping['PRD.md']);
    if (fs.existsSync(prdPath)) {
      checkRequiredSections(result, prdPath, REQUIRED_SECTIONS['PRD.md']);
    }
  } catch (error) {
    result.blocking.push({ code: 'READ_ERROR', message: String(error) });
  }

  try {
    const specPath = path.resolve(cwd, mapping['COMPILED-SPEC.md']);
    if (fs.existsSync(specPath)) {
      checkRequiredSections(result, specPath, REQUIRED_SECTIONS['COMPILED-SPEC.md']);
    }
  } catch (error) {
    result.blocking.push({ code: 'READ_ERROR', message: String(error) });
  }

  try {
    let decisionPath = path.resolve(cwd, mapping['DECISION-LOG.md']);
    if (!fs.existsSync(decisionPath)) {
      const alt = path.resolve(cwd, 'docs/DECISION-LOG.md');
      if (fs.existsSync(alt)) {
        decisionPath = alt;
      }
    }

    if (fs.existsSync(decisionPath)) {
      const content = fs.readFileSync(decisionPath, 'utf8');
      const { frontmatter } = parseFrontmatter(content);
      if (!frontmatter.spec_ref && !content.includes('spec_ref:')) {
        result.blocking.push({
          code: 'MISSING_SPEC_REF',
          message: 'Decision log entry missing spec_ref',
          file: decisionPath
        });
      }
    }
  } catch (error) {
    result.blocking.push({ code: 'READ_ERROR', message: String(error) });
  }

  try {
    const statePath = path.resolve(cwd, '.terrace', 'project-state.json');
    if (fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      if (state.last_session) {
        const last = new Date(state.last_session);
        if (!Number.isNaN(last.getTime())) {
          const days = (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24);
          if (days > 30) {
            result.warnings.push({
              code: 'STALE_SESSION',
              message: 'last_session is older than 30 days',
              file: statePath
            });
          }
        }
      }
    }
  } catch (error) {
    result.blocking.push({ code: 'READ_ERROR', message: String(error) });
  }

  return result;
}

module.exports = {
  validateArtifacts
};
