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
  security: [
    {
      id: 'SEC-CRITICAL',
      title: 'Security-critical findings cannot be bypassed by low-effort mode',
      domain: 'security',
      scope: 'finding',
      blocking: true,
      evaluation_method: 'deterministic',
      policy_modes: ['strict', 'standard', 'low_effort'],
      required_evidence: ['resolution_or_decision_log_override'],
      warnings: [],
      override: { requires_decision_log: true, requires_expiry: true }
    }
  ],
  architecture: [
    {
      id: 'ARCH-PUBLIC-CONTRACT',
      title: 'Public contracts require compatibility notes',
      domain: 'architecture',
      scope: 'public-interface',
      blocking: false,
      evaluation_method: 'heuristic',
      policy_modes: ['strict', 'standard'],
      required_evidence: ['compatibility_notes', 'migration_notes'],
      warnings: ['public CLI/API change without docs or migration note'],
      override: { requires_decision_log: true }
    }
  ],
  pentest: [
    {
      id: 'PENTEST-AUTHORIZED-SCOPE',
      title: 'Pentest activity requires explicit authorized scope',
      domain: 'pentest',
      scope: 'security-test',
      blocking: true,
      evaluation_method: 'deterministic',
      policy_modes: ['strict', 'standard', 'low_effort'],
      required_evidence: ['authorized_target', 'scope_boundary'],
      warnings: [],
      override: { requires_decision_log: true, requires_expiry: true }
    }
  ],
  maintainability: [
    {
      id: 'MAINT-QUALITY-LADDER',
      title: 'Quality ladder must stay executable',
      domain: 'maintainability',
      scope: 'repository',
      blocking: false,
      evaluation_method: 'heuristic',
      policy_modes: ['strict', 'standard'],
      required_evidence: ['lint', 'typecheck', 'tests'],
      warnings: ['missing canonical quality command'],
      override: { requires_decision_log: false }
    }
  ]
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

function loadRules(cwd) {
  const rulesDir = path.resolve(cwd, '.terrace', 'rules');
  const result = {};
  for (const domain of Object.keys(DEFAULT_RULES)) {
    const filePath = path.join(rulesDir, domain + '.json');
    result[domain] = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')).rules : [];
  }
  return result;
}

function explainRule(cwd, ruleId) {
  const rules = loadRules(cwd);
  for (const domainRules of Object.values(rules)) {
    const found = domainRules.find((rule) => rule.id === ruleId);
    if (found) {
      return found;
    }
  }
  throw new Error('Unknown rule: ' + ruleId);
}

function checkRules(cwd, input) {
  const mode = input.mode || 'strict';
  const findings = input.findings || [];
  const blocking = [];
  const warnings = [];

  for (const finding of findings) {
    if (finding.domain === 'security' && finding.severity === 'critical') {
      blocking.push({
        code: 'SECURITY_CRITICAL_LOW_EFFORT_BLOCK',
        domain: finding.domain,
        rule_id: finding.rule_id,
        message: finding.message,
        mode
      });
      continue;
    }
    if (finding.domain === 'pentest' && !finding.authorized_scope) {
      blocking.push({
        code: 'PENTEST_WITHOUT_AUTHORIZED_SCOPE',
        domain: finding.domain,
        rule_id: finding.rule_id || 'PENTEST-AUTHORIZED-SCOPE',
        message: finding.message || 'Pentest finding requires authorized_scope evidence',
        mode
      });
      continue;
    }
    warnings.push(finding);
  }

  return { blocking, warnings, passed: blocking.length === 0 };
}

module.exports = {
  DEFAULT_RULES,
  defaultRuleFiles,
  writeDefaultRules,
  loadRules,
  explainRule,
  checkRules
};
