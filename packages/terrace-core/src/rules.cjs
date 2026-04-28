'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_RULES = {
  'testing-trust': [
    {
      id: 'testing-trust',
      title: 'Do Not Treat Test Volume as Trust',
      domain: 'testing-trust',
      scope: 'task-type',
      blocking: false,
      evaluation_method: 'heuristic',
      policy_modes: ['strict', 'standard', 'low_effort'],
      required_evidence: ['protected_invariants', 'failure_modes'],
      warnings: ['coverage percentage without invariant reasoning'],
      override: { requires_decision_log: false }
    }
  ],
  security: [],
  architecture: [],
  pentest: [],
  maintainability: []
};

function defaultRuleFiles() {
  return Object.keys(DEFAULT_RULES).map((domain) => '.terrace/rules/' + domain + '.json');
}

function writeDefaultRules(cwd) {
  const rulesDir = path.resolve(cwd, '.terrace', 'rules');
  fs.mkdirSync(rulesDir, { recursive: true });
  for (const [domain, rules] of Object.entries(DEFAULT_RULES)) {
    fs.writeFileSync(path.join(rulesDir, domain + '.json'), JSON.stringify({ schema_version: '1.0', domain, rules }, null, 2) + '\n', 'utf8');
  }
}

module.exports = {
  DEFAULT_RULES,
  defaultRuleFiles,
  writeDefaultRules
};
