# Terrace Core Standalone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone strict Terrace kernel that owns deterministic state, RED/GREEN gates, low-effort roadmap execution, first-class rule domains, and a dry-run GSD port classifier.

**Architecture:** Add `packages/terrace-core` as the deterministic engine and keep the existing root CLI as the compatibility shell until delegation is proven. The core reads/writes `.terrace/state.json`, `.terrace/config.json`, `.terrace/events.jsonl`, and rule files; CLI commands become thin wrappers around pure core functions.

**Tech Stack:** Node.js CommonJS, Vitest, no production dependencies, repo-local filesystem fixtures.

---

## File Structure

- Create `packages/terrace-core/src/state.cjs`: state schema, default state, load/save, legal transition validation.
- Create `packages/terrace-core/src/events.cjs`: append-only event writer and event reader for tests.
- Create `packages/terrace-core/src/config.cjs`: stack command detection and config read/write.
- Create `packages/terrace-core/src/init.cjs`: strict-core init that writes `.terrace/state.json`, config, events, rules, and docs directories.
- Create `packages/terrace-core/src/rules.cjs`: shared rule schema, default domain rules, rule loading, rule checks.
- Create `packages/terrace-core/src/gates.cjs`: RED/GREEN evidence verification.
- Create `packages/terrace-core/src/roadmap.cjs`: roadmap item checks, effort classification, low-effort slice creation.
- Create `packages/terrace-core/src/port-gsd.cjs`: dry-run artifact inventory and GSD command classification.
- Create `packages/terrace-core/src/index.cjs`: public exports.
- Create `tests/core-state.test.ts`, `tests/core-init.test.ts`, `tests/core-gates.test.ts`, `tests/core-roadmap.test.ts`, `tests/core-rules.test.ts`, `tests/core-port-gsd.test.ts`, and `tests/core-cli.test.ts`.
- Modify `src/terrace-tools.cjs`: add strict-core command wrappers after core tests pass.
- Modify `package.json`: add no new dependencies; keep existing test script.
- Modify `.planning/PROJECT.md` and `.planning/STATE.md` after implementation milestones.

## Task 1: Core State Machine

**Files:**
- Create: `packages/terrace-core/src/state.cjs`
- Create: `packages/terrace-core/src/index.cjs`
- Test: `tests/core-state.test.ts`

- [ ] **Step 1: Write the failing state tests**

Create `tests/core-state.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  createDefaultState,
  assertLegalTransition,
  transitionState,
  loadState,
  saveState
} = require('../packages/terrace-core/src/index.cjs');

describe('terrace-core state machine', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-core-state-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a JSON-led default state with required top-level fields', () => {
    const state = createDefaultState({ projectName: 'demo' });
    expect(state.schema_version).toBe('1.0');
    expect(state.project.name).toBe('demo');
    expect(state.workflow.status).toBe('initialized');
    expect(state).toHaveProperty('roadmap');
    expect(state).toHaveProperty('active_slice');
    expect(state).toHaveProperty('red_gate');
    expect(state).toHaveProperty('green_gate');
    expect(state).toHaveProperty('protected_tests');
    expect(state).toHaveProperty('decisions');
    expect(state).toHaveProperty('sessions');
  });

  it('allows initialized -> intake_recorded', () => {
    expect(() => assertLegalTransition('initialized', 'intake_recorded')).not.toThrow();
  });

  it('rejects initialized -> implementation_allowed', () => {
    expect(() => assertLegalTransition('initialized', 'implementation_allowed')).toThrow('Illegal transition');
  });

  it('transitionState preserves state and changes workflow status', () => {
    const state = createDefaultState({ projectName: 'demo' });
    const next = transitionState(state, 'intake_recorded');
    expect(next.workflow.status).toBe('intake_recorded');
    expect(next.project.name).toBe('demo');
  });

  it('saves and loads .terrace/state.json', () => {
    const state = createDefaultState({ projectName: 'demo' });
    saveState(tmpDir, state);
    const loaded = loadState(tmpDir);
    expect(loaded.project.name).toBe('demo');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/core-state.test.ts`

Expected: FAIL with `Cannot find module '../packages/terrace-core/src/index.cjs'`.

- [ ] **Step 3: Implement state module and exports**

Create `packages/terrace-core/src/state.cjs`:

```js
'use strict';

const fs = require('fs');
const path = require('path');

const LEGAL_TRANSITIONS = {
  uninitialized: ['initialized'],
  initialized: ['intake_recorded'],
  intake_recorded: ['interrogated'],
  interrogated: ['spec_compiled'],
  spec_compiled: ['roadmap_ready'],
  roadmap_ready: ['slice_planned'],
  slice_planned: ['red_required'],
  red_required: ['implementation_allowed'],
  implementation_allowed: ['green_required'],
  green_required: ['protected'],
  protected: ['handoff_ready'],
  handoff_ready: ['roadmap_ready']
};

function createDefaultState(options) {
  const opts = options || {};
  return {
    schema_version: '1.0',
    project: {
      name: opts.projectName || 'untitled',
      created_at: new Date().toISOString()
    },
    workflow: {
      status: 'initialized',
      mode: 'strict',
      active_feature: null
    },
    roadmap: {
      phases: []
    },
    active_slice: null,
    red_gate: {
      status: 'not_started',
      evidence: []
    },
    green_gate: {
      status: 'not_started',
      evidence: []
    },
    protected_tests: [],
    decisions: [],
    sessions: []
  };
}

function statePathFor(cwd) {
  return path.resolve(cwd, '.terrace', 'state.json');
}

function assertLegalTransition(fromStatus, toStatus) {
  const allowed = LEGAL_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    throw new Error('Illegal transition: ' + fromStatus + ' -> ' + toStatus);
  }
}

function transitionState(state, toStatus) {
  assertLegalTransition(state.workflow.status, toStatus);
  return {
    ...state,
    workflow: {
      ...state.workflow,
      status: toStatus
    }
  };
}

function saveState(cwd, state) {
  const filePath = statePathFor(cwd);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
  return filePath;
}

function loadState(cwd) {
  const filePath = statePathFor(cwd);
  if (!fs.existsSync(filePath)) {
    throw new Error('Missing .terrace/state.json. Run `terrace init` first.');
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

module.exports = {
  LEGAL_TRANSITIONS,
  createDefaultState,
  assertLegalTransition,
  transitionState,
  saveState,
  loadState
};
```

Create `packages/terrace-core/src/index.cjs`:

```js
'use strict';

module.exports = {
  ...require('./state.cjs')
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/core-state.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/terrace-core/src/state.cjs packages/terrace-core/src/index.cjs tests/core-state.test.ts
git commit -m "feat(core): add strict state machine"
```

## Task 2: Event Log And Init

**Files:**
- Create: `packages/terrace-core/src/events.cjs`
- Create: `packages/terrace-core/src/config.cjs`
- Create: `packages/terrace-core/src/init.cjs`
- Modify: `packages/terrace-core/src/index.cjs`
- Test: `tests/core-init.test.ts`

- [ ] **Step 1: Write the failing init tests**

Create `tests/core-init.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { initCore, readEvents, detectCommands } = require('../packages/terrace-core/src/index.cjs');

describe('terrace-core init and events', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-core-init-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects Node test commands from package.json once at init', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      scripts: {
        test: 'vitest run',
        typecheck: 'tsc --noEmit',
        lint: 'eslint .'
      }
    }), 'utf-8');
    const commands = detectCommands(tmpDir);
    expect(commands.test_command).toBe('npm test');
    expect(commands.typecheck_command).toBe('npm run typecheck');
    expect(commands.lint_command).toBe('npm run lint');
  });

  it('initCore writes state, config, events, rules, and docs directories', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ scripts: { test: 'vitest run' } }), 'utf-8');
    const result = initCore(tmpDir, { projectName: 'demo' });
    expect(result.created).toContain('.terrace/state.json');
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'state.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'config.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'events.jsonl'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'rules', 'testing-trust.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'spec'))).toBe(true);
  });

  it('initCore records an init event with from_state and to_state', () => {
    initCore(tmpDir, { projectName: 'demo' });
    const events = readEvents(tmpDir);
    expect(events).toHaveLength(1);
    expect(events[0].command).toBe('terrace init');
    expect(events[0].from_state).toBe('uninitialized');
    expect(events[0].to_state).toBe('initialized');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/core-init.test.ts`

Expected: FAIL because `initCore`, `readEvents`, and `detectCommands` are not exported.

- [ ] **Step 3: Implement events, config, and init**

Create `packages/terrace-core/src/events.cjs`:

```js
'use strict';

const fs = require('fs');
const path = require('path');

function eventsPathFor(cwd) {
  return path.resolve(cwd, '.terrace', 'events.jsonl');
}

function appendEvent(cwd, event) {
  const filePath = eventsPathFor(cwd);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const payload = {
    event_id: event.event_id || 'evt_' + Date.now() + '_' + Math.random().toString(16).slice(2),
    timestamp: event.timestamp || new Date().toISOString(),
    command: event.command,
    from_state: event.from_state,
    to_state: event.to_state,
    result: event.result || 'ok',
    evidence_refs: event.evidence_refs || []
  };
  fs.appendFileSync(filePath, JSON.stringify(payload) + '\n', 'utf8');
  return payload;
}

function readEvents(cwd) {
  const filePath = eventsPathFor(cwd);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

module.exports = {
  appendEvent,
  readEvents
};
```

Create `packages/terrace-core/src/config.cjs`:

```js
'use strict';

const fs = require('fs');
const path = require('path');

function detectCommands(cwd) {
  const packagePath = path.resolve(cwd, 'package.json');
  if (fs.existsSync(packagePath)) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const scripts = pkg.scripts || {};
    return {
      test_command: scripts.test ? 'npm test' : null,
      typecheck_command: scripts.typecheck ? 'npm run typecheck' : null,
      lint_command: scripts.lint ? 'npm run lint' : null
    };
  }
  if (fs.existsSync(path.resolve(cwd, 'pyproject.toml'))) {
    return { test_command: 'pytest', typecheck_command: null, lint_command: null };
  }
  if (fs.existsSync(path.resolve(cwd, 'Cargo.toml'))) {
    return { test_command: 'cargo test', typecheck_command: 'cargo check', lint_command: null };
  }
  return { test_command: null, typecheck_command: null, lint_command: null };
}

function configPathFor(cwd) {
  return path.resolve(cwd, '.terrace', 'config.json');
}

function writeConfig(cwd, config) {
  const filePath = configPathFor(cwd);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  return filePath;
}

function readConfig(cwd) {
  const filePath = configPathFor(cwd);
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

module.exports = {
  detectCommands,
  writeConfig,
  readConfig
};
```

Create `packages/terrace-core/src/init.cjs`:

```js
'use strict';

const fs = require('fs');
const path = require('path');
const { createDefaultState, saveState } = require('./state.cjs');
const { detectCommands, writeConfig } = require('./config.cjs');
const { appendEvent } = require('./events.cjs');
const { defaultRuleFiles, writeDefaultRules } = require('./rules.cjs');

function ensureDir(cwd, relPath, created) {
  const fullPath = path.resolve(cwd, relPath);
  fs.mkdirSync(fullPath, { recursive: true });
  created.push(relPath);
}

function initCore(cwd, options) {
  const opts = options || {};
  const created = [];
  const state = createDefaultState({ projectName: opts.projectName || path.basename(cwd) });
  saveState(cwd, state);
  created.push('.terrace/state.json');

  writeConfig(cwd, {
    schema_version: '1.0',
    commands: detectCommands(cwd),
    pentest_authorized: false,
    execution_policy: {
      default_mode: 'strict',
      allow_low_effort: true
    }
  });
  created.push('.terrace/config.json');

  ensureDir(cwd, 'docs/prd', created);
  ensureDir(cwd, 'docs/spec', created);
  ensureDir(cwd, 'docs/testing', created);

  writeDefaultRules(cwd);
  for (const relPath of defaultRuleFiles()) {
    created.push(relPath);
  }

  appendEvent(cwd, {
    command: 'terrace init',
    from_state: 'uninitialized',
    to_state: 'initialized',
    evidence_refs: ['.terrace/state.json', '.terrace/config.json']
  });
  created.push('.terrace/events.jsonl');

  return { created };
}

module.exports = {
  initCore
};
```

Create `packages/terrace-core/src/rules.cjs` now with default rule files needed by init:

```js
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
```

Modify `packages/terrace-core/src/index.cjs`:

```js
'use strict';

module.exports = {
  ...require('./state.cjs'),
  ...require('./events.cjs'),
  ...require('./config.cjs'),
  ...require('./rules.cjs'),
  ...require('./init.cjs')
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/core-init.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/terrace-core/src/events.cjs packages/terrace-core/src/config.cjs packages/terrace-core/src/init.cjs packages/terrace-core/src/rules.cjs packages/terrace-core/src/index.cjs tests/core-init.test.ts
git commit -m "feat(core): initialize strict project files"
```

## Task 3: Rule Domains

**Files:**
- Modify: `packages/terrace-core/src/rules.cjs`
- Test: `tests/core-rules.test.ts`

- [ ] **Step 1: Write failing rule-domain tests**

Create `tests/core-rules.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { initCore, loadRules, explainRule, checkRules } = require('../packages/terrace-core/src/index.cjs');

describe('first-class rule domains', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-core-rules-'));
    initCore(tmpDir, { projectName: 'demo' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads security, architecture, pentest, maintainability, and testing-trust domains', () => {
    const rules = loadRules(tmpDir);
    expect(Object.keys(rules).sort()).toEqual(['architecture', 'maintainability', 'pentest', 'security', 'testing-trust']);
  });

  it('explains the testing-trust rule by id', () => {
    const explanation = explainRule(tmpDir, 'testing-trust');
    expect(explanation.title).toBe('Do Not Treat Test Volume as Trust');
  });

  it('blocks security-critical findings in low-effort mode', () => {
    const result = checkRules(tmpDir, {
      mode: 'low_effort',
      findings: [{ domain: 'security', severity: 'critical', rule_id: 'SEC-CRITICAL', message: 'secret exposed' }]
    });
    expect(result.blocking).toHaveLength(1);
    expect(result.blocking[0].domain).toBe('security');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/core-rules.test.ts`

Expected: FAIL because `loadRules`, `explainRule`, and `checkRules` are not implemented.

- [ ] **Step 3: Implement rule loading and checks**

Replace `packages/terrace-core/src/rules.cjs` with:

```js
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/core-rules.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/terrace-core/src/rules.cjs tests/core-rules.test.ts
git commit -m "feat(core): add first-class rule domains"
```

## Task 4: RED And GREEN Gates

**Files:**
- Create: `packages/terrace-core/src/gates.cjs`
- Modify: `packages/terrace-core/src/index.cjs`
- Test: `tests/core-gates.test.ts`

- [ ] **Step 1: Write failing gate tests**

Create `tests/core-gates.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { initCore, saveState, loadState, verifyRedEvidence, verifyGreenEvidence } = require('../packages/terrace-core/src/index.cjs');

describe('RED and GREEN gates', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-core-gates-'));
    initCore(tmpDir, { projectName: 'demo' });
    const state = loadState(tmpDir);
    state.workflow.status = 'red_required';
    state.active_slice = {
      id: 'auth-login-01',
      spec_refs: ['AUTH-REQ-01'],
      test_intent: [{ protects: 'Invalid credentials never create a session', failure_mode: 'session created for invalid password' }]
    };
    saveState(tmpDir, state);
    fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'tests', 'auth.test.ts'), 'test("invalid login", () => {})\n', 'utf-8');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('accepts RED evidence mapped to active slice, spec, contract, and failing command', () => {
    const result = verifyRedEvidence(tmpDir, {
      slice_id: 'auth-login-01',
      test_file: 'tests/auth.test.ts',
      command: 'npm test -- auth',
      exit_code: 1,
      spec_ref: 'AUTH-REQ-01',
      protects: 'Invalid credentials never create a session',
      failure_mode: 'session created for invalid password'
    });
    expect(result.passed).toBe(true);
    expect(loadState(tmpDir).workflow.status).toBe('implementation_allowed');
  });

  it('rejects RED evidence when the test file is missing', () => {
    const result = verifyRedEvidence(tmpDir, {
      slice_id: 'auth-login-01',
      test_file: 'tests/missing.test.ts',
      command: 'npm test -- auth',
      exit_code: 1,
      spec_ref: 'AUTH-REQ-01',
      protects: 'Invalid credentials never create a session',
      failure_mode: 'session created for invalid password'
    });
    expect(result.passed).toBe(false);
    expect(result.blocking[0].code).toBe('MISSING_TEST_FILE');
  });

  it('accepts GREEN evidence only when configured command exits 0', () => {
    const state = loadState(tmpDir);
    state.workflow.status = 'green_required';
    saveState(tmpDir, state);
    const result = verifyGreenEvidence(tmpDir, { command: 'npm test', exit_code: 0, summary: 'all tests passed' });
    expect(result.passed).toBe(true);
    expect(loadState(tmpDir).workflow.status).toBe('protected');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/core-gates.test.ts`

Expected: FAIL because gate functions are missing.

- [ ] **Step 3: Implement gate verification**

Create `packages/terrace-core/src/gates.cjs`:

```js
'use strict';

const fs = require('fs');
const path = require('path');
const { loadState, saveState } = require('./state.cjs');
const { appendEvent } = require('./events.cjs');

function verifyRedEvidence(cwd, evidence) {
  const state = loadState(cwd);
  const blocking = [];

  if (state.workflow.status !== 'red_required') {
    blocking.push({ code: 'INVALID_STATE', message: 'RED evidence requires red_required state' });
  }
  if (!state.active_slice || evidence.slice_id !== state.active_slice.id) {
    blocking.push({ code: 'SLICE_MISMATCH', message: 'RED evidence must match active slice' });
  }
  if (!fs.existsSync(path.resolve(cwd, evidence.test_file || ''))) {
    blocking.push({ code: 'MISSING_TEST_FILE', message: 'RED test file does not exist' });
  }
  if (!evidence.spec_ref || !state.active_slice || !state.active_slice.spec_refs.includes(evidence.spec_ref)) {
    blocking.push({ code: 'SPEC_REF_MISMATCH', message: 'RED evidence must reference active spec_ref' });
  }
  if (evidence.exit_code === 0) {
    blocking.push({ code: 'RED_DID_NOT_FAIL', message: 'RED command must fail before implementation' });
  }
  if (!evidence.protects || !evidence.failure_mode) {
    blocking.push({ code: 'WEAK_TESTING_TRUST_EVIDENCE', message: 'RED evidence must name protected behavior and failure mode' });
  }

  if (blocking.length > 0) {
    return { passed: false, blocking };
  }

  state.red_gate = { status: 'passed', evidence: [evidence] };
  state.workflow.status = 'implementation_allowed';
  saveState(cwd, state);
  appendEvent(cwd, {
    command: 'terrace red verify',
    from_state: 'red_required',
    to_state: 'implementation_allowed',
    evidence_refs: [evidence.test_file]
  });
  return { passed: true, blocking: [] };
}

function verifyGreenEvidence(cwd, evidence) {
  const state = loadState(cwd);
  const blocking = [];

  if (state.workflow.status !== 'green_required') {
    blocking.push({ code: 'INVALID_STATE', message: 'GREEN evidence requires green_required state' });
  }
  if (evidence.exit_code !== 0) {
    blocking.push({ code: 'GREEN_COMMAND_FAILED', message: 'GREEN command must pass' });
  }

  if (blocking.length > 0) {
    return { passed: false, blocking };
  }

  state.green_gate = { status: 'passed', evidence: [evidence] };
  state.workflow.status = 'protected';
  saveState(cwd, state);
  appendEvent(cwd, {
    command: 'terrace green verify',
    from_state: 'green_required',
    to_state: 'protected',
    evidence_refs: []
  });
  return { passed: true, blocking: [] };
}

module.exports = {
  verifyRedEvidence,
  verifyGreenEvidence
};
```

Modify `packages/terrace-core/src/index.cjs`:

```js
'use strict';

module.exports = {
  ...require('./state.cjs'),
  ...require('./events.cjs'),
  ...require('./config.cjs'),
  ...require('./rules.cjs'),
  ...require('./init.cjs'),
  ...require('./gates.cjs')
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/core-gates.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/terrace-core/src/gates.cjs packages/terrace-core/src/index.cjs tests/core-gates.test.ts
git commit -m "feat(core): enforce red and green gates"
```

## Task 5: Low-Effort Roadmap Execution

**Files:**
- Create: `packages/terrace-core/src/roadmap.cjs`
- Modify: `packages/terrace-core/src/index.cjs`
- Test: `tests/core-roadmap.test.ts`

- [ ] **Step 1: Write failing roadmap tests**

Create `tests/core-roadmap.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { initCore, loadState, saveState, classifyRoadmapItem, executeRoadmapItem } = require('../packages/terrace-core/src/index.cjs');

describe('low-effort roadmap execution', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-core-roadmap-'));
    initCore(tmpDir, { projectName: 'demo' });
    const state = loadState(tmpDir);
    state.workflow.status = 'roadmap_ready';
    state.roadmap.phases = [
      {
        id: 'docs-typo',
        goal: 'Fix typo in README',
        success_criteria: ['README spelling corrected'],
        risk_tags: ['low'],
        dependencies: []
      },
      {
        id: 'auth-session',
        goal: 'Change auth session behavior',
        success_criteria: ['sessions expire correctly'],
        risk_tags: ['security', 'protected_behavior'],
        dependencies: []
      }
    ];
    saveState(tmpDir, state);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('classifies bounded low-risk roadmap items as low effort', () => {
    const state = loadState(tmpDir);
    const result = classifyRoadmapItem(state.roadmap.phases[0]);
    expect(result.effort).toBe('low');
  });

  it('classifies security-sensitive items as strict', () => {
    const state = loadState(tmpDir);
    const result = classifyRoadmapItem(state.roadmap.phases[1]);
    expect(result.effort).toBe('strict');
  });

  it('executes a low-risk roadmap item without a full plan document', () => {
    const result = executeRoadmapItem(tmpDir, 'docs-typo');
    expect(result.effort).toBe('low');
    const state = loadState(tmpDir);
    expect(state.workflow.status).toBe('red_required');
    expect(state.active_slice.id).toBe('docs-typo');
    expect(state.active_slice.skipped_gates).toContain('full_plan_document');
  });

  it('refuses direct execution for security-sensitive roadmap items', () => {
    const result = executeRoadmapItem(tmpDir, 'auth-session');
    expect(result.allowed).toBe(false);
    expect(result.required_command).toBe('terrace plan next');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/core-roadmap.test.ts`

Expected: FAIL because roadmap functions are missing.

- [ ] **Step 3: Implement roadmap classification and execution**

Create `packages/terrace-core/src/roadmap.cjs`:

```js
'use strict';

const { loadState, saveState } = require('./state.cjs');
const { appendEvent } = require('./events.cjs');

function classifyRoadmapItem(item) {
  const tags = item.risk_tags || [];
  const missingShape = !item.goal || !Array.isArray(item.success_criteria) || item.success_criteria.length === 0;
  if (missingShape) {
    return { effort: 'strict', reasons: ['missing_goal_or_success_criteria'] };
  }
  if (tags.includes('security') || tags.includes('architecture') || tags.includes('protected_behavior')) {
    return { effort: 'strict', reasons: tags };
  }
  if (tags.includes('low')) {
    return { effort: 'low', reasons: ['bounded_low_risk'] };
  }
  return { effort: 'standard', reasons: ['default_standard'] };
}

function executeRoadmapItem(cwd, itemId) {
  const state = loadState(cwd);
  const item = state.roadmap.phases.find((phase) => phase.id === itemId);
  if (!item) {
    throw new Error('Unknown roadmap item: ' + itemId);
  }

  const classification = classifyRoadmapItem(item);
  if (classification.effort !== 'low') {
    return {
      allowed: false,
      effort: classification.effort,
      reasons: classification.reasons,
      required_command: 'terrace plan next'
    };
  }

  const nextState = {
    ...state,
    workflow: {
      ...state.workflow,
      status: 'red_required',
      mode: 'low_effort'
    },
    active_slice: {
      id: item.id,
      goal: item.goal,
      spec_refs: item.spec_refs || [],
      success_criteria: item.success_criteria,
      test_intent: [],
      skipped_gates: ['full_plan_document']
    }
  };
  saveState(cwd, nextState);
  appendEvent(cwd, {
    command: 'terrace roadmap execute ' + itemId,
    from_state: state.workflow.status,
    to_state: 'red_required',
    evidence_refs: ['.terrace/state.json']
  });

  return {
    allowed: true,
    effort: 'low',
    next_action: 'Agent writes RED tests or evidence for active slice.'
  };
}

module.exports = {
  classifyRoadmapItem,
  executeRoadmapItem
};
```

Modify `packages/terrace-core/src/index.cjs` to export roadmap:

```js
'use strict';

module.exports = {
  ...require('./state.cjs'),
  ...require('./events.cjs'),
  ...require('./config.cjs'),
  ...require('./rules.cjs'),
  ...require('./init.cjs'),
  ...require('./gates.cjs'),
  ...require('./roadmap.cjs')
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/core-roadmap.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/terrace-core/src/roadmap.cjs packages/terrace-core/src/index.cjs tests/core-roadmap.test.ts
git commit -m "feat(core): add low-effort roadmap execution"
```

## Task 6: GSD Port Dry-Run Classifier

**Files:**
- Create: `packages/terrace-core/src/port-gsd.cjs`
- Modify: `packages/terrace-core/src/index.cjs`
- Test: `tests/core-port-gsd.test.ts`

- [ ] **Step 1: Write failing port tests**

Create `tests/core-port-gsd.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { classifyGsdCommand, portGsdDryRun } = require('../packages/terrace-core/src/index.cjs');

describe('terrace port gsd dry-run classifier', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-core-port-gsd-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-demo'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n', 'utf-8');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('classifies core planning loop commands as improved ports', () => {
    expect(classifyGsdCommand('gsd-plan-phase').strategy).toBe('improved');
    expect(classifyGsdCommand('gsd-execute-phase').strategy).toBe('improved');
  });

  it('classifies governance-specific commands as replaced', () => {
    expect(classifyGsdCommand('gsd-validate-phase').strategy).toBe('replaced');
  });

  it('classifies low-risk utilities as as-is ports', () => {
    expect(classifyGsdCommand('gsd-note').strategy).toBe('as-is');
  });

  it('dry-run inventories planning artifacts without writing state', () => {
    const result = portGsdDryRun(tmpDir);
    expect(result.artifacts).toContain('.planning/ROADMAP.md');
    expect(result.artifacts).toContain('.planning/STATE.md');
    expect(result.writes).toHaveLength(0);
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'state.json'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/core-port-gsd.test.ts`

Expected: FAIL because port functions are missing.

- [ ] **Step 3: Implement GSD classifier and dry-run inventory**

Create `packages/terrace-core/src/port-gsd.cjs`:

```js
'use strict';

const fs = require('fs');
const path = require('path');

const COMMAND_STRATEGIES = {
  improved: ['gsd-new-project', 'gsd-discuss-phase', 'gsd-plan-phase', 'gsd-execute-phase', 'gsd-quick'],
  replaced: ['gsd-validate-phase', 'gsd-verify-work', 'gsd-ship'],
  'as-is': ['gsd-note', 'gsd-add-todo', 'gsd-check-todos', 'gsd-health', 'gsd-stats', 'gsd-forensics', 'gsd-map-codebase']
};

function classifyGsdCommand(command) {
  for (const [strategy, commands] of Object.entries(COMMAND_STRATEGIES)) {
    if (commands.includes(command)) {
      return { command, strategy };
    }
  }
  return { command, strategy: 'unknown' };
}

function listIfExists(cwd, relPath, artifacts) {
  if (fs.existsSync(path.resolve(cwd, relPath))) {
    artifacts.push(relPath);
  }
}

function portGsdDryRun(cwd) {
  const artifacts = [];
  listIfExists(cwd, '.planning/ROADMAP.md', artifacts);
  listIfExists(cwd, '.planning/STATE.md', artifacts);
  listIfExists(cwd, '.planning/PROJECT.md', artifacts);
  listIfExists(cwd, '.planning/REQUIREMENTS.md', artifacts);

  return {
    mode: 'dry-run',
    artifacts,
    command_strategies: COMMAND_STRATEGIES,
    writes: []
  };
}

module.exports = {
  classifyGsdCommand,
  portGsdDryRun
};
```

Modify `packages/terrace-core/src/index.cjs`:

```js
'use strict';

module.exports = {
  ...require('./state.cjs'),
  ...require('./events.cjs'),
  ...require('./config.cjs'),
  ...require('./rules.cjs'),
  ...require('./init.cjs'),
  ...require('./gates.cjs'),
  ...require('./roadmap.cjs'),
  ...require('./port-gsd.cjs')
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/core-port-gsd.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/terrace-core/src/port-gsd.cjs packages/terrace-core/src/index.cjs tests/core-port-gsd.test.ts
git commit -m "feat(core): classify gsd port dry runs"
```

## Task 7: CLI Delegation

**Files:**
- Modify: `src/terrace-tools.cjs`
- Test: `tests/core-cli.test.ts`

- [ ] **Step 1: Write failing CLI delegation tests**

Create `tests/core-cli.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

const NODE_BIN = process.execPath;
const TERRACE_CLI = path.resolve(process.cwd(), 'src/terrace-tools.cjs');

describe('terrace CLI strict core delegation', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-core-cli-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('terrace core init --json writes strict state', () => {
    const stdout = execFileSync(NODE_BIN, [TERRACE_CLI, 'core', 'init', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
    const parsed = JSON.parse(stdout);
    expect(parsed.created).toContain('.terrace/state.json');
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'state.json'))).toBe(true);
  });

  it('terrace rule explain testing-trust --json returns the rule', () => {
    execFileSync(NODE_BIN, [TERRACE_CLI, 'core', 'init', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
    const stdout = execFileSync(NODE_BIN, [TERRACE_CLI, 'rule', 'explain', 'testing-trust', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
    const parsed = JSON.parse(stdout);
    expect(parsed.id).toBe('testing-trust');
  });

  it('terrace port gsd --dry-run --json reports artifacts without writing', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n', 'utf-8');
    const stdout = execFileSync(NODE_BIN, [TERRACE_CLI, 'port', 'gsd', '--dry-run', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
    const parsed = JSON.parse(stdout);
    expect(parsed.artifacts).toContain('.planning/ROADMAP.md');
    expect(parsed.writes).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/core-cli.test.ts`

Expected: FAIL because CLI commands are unknown.

- [ ] **Step 3: Wire CLI wrappers**

Modify `src/terrace-tools.cjs` imports:

```js
const {
  initCore,
  explainRule,
  loadRules,
  checkRules,
  executeRoadmapItem,
  portGsdDryRun
} = require('../packages/terrace-core/src/index.cjs');
```

Add cases before `case 'baseline'`:

```js
    case 'core': {
      const sub = args[1];
      if (sub === 'init') {
        output(initCore(cwd, { projectName: path.basename(cwd) }), { json });
        return;
      }
      fail('Unknown core subcommand: ' + sub + '. Use: init', { json });
      return;
    }
    case 'rule': {
      const sub = args[1];
      if (sub === 'explain') {
        const ruleId = args[2];
        if (!ruleId) {
          fail('Usage: terrace rule explain <rule-id>', { json });
        }
        output(explainRule(cwd, ruleId), { json });
        return;
      }
      if (sub === 'list') {
        output(loadRules(cwd), { json });
        return;
      }
      fail('Unknown rule subcommand: ' + sub + '. Use: explain, list', { json });
      return;
    }
    case 'quick': {
      const itemId = args[1];
      if (!itemId) {
        fail('Usage: terrace quick <roadmap-item>', { json });
      }
      output(executeRoadmapItem(cwd, itemId), { json });
      return;
    }
    case 'port': {
      const sub = args[1];
      if (sub === 'gsd') {
        output(portGsdDryRun(cwd), { json });
        return;
      }
      fail('Unknown port subcommand: ' + sub + '. Use: gsd', { json });
      return;
    }
```

- [ ] **Step 4: Run CLI tests**

Run: `npm test -- tests/core-cli.test.ts`

Expected: PASS.

- [ ] **Step 5: Run full suite**

Run: `npm test`

Expected: PASS all tests.

- [ ] **Step 6: Commit**

```bash
git add src/terrace-tools.cjs tests/core-cli.test.ts
git commit -m "feat(cli): delegate strict core commands"
```

## Task 8: Truth Files And Verification

**Files:**
- Modify: `.planning/PROJECT.md`
- Modify: `.planning/STATE.md`
- Optionally create: `.planning/phases/07-standalone-core/07-SUMMARY.md`

- [ ] **Step 1: Run full verification**

Run: `npm test`

Expected: PASS all tests.

- [ ] **Step 2: Run command smoke checks**

```bash
tmpdir="$(mktemp -d)"
(cd "$tmpdir" && node /Users/jakyeamos/projects/Terrace/src/terrace-tools.cjs core init --json)
```

Expected: JSON output includes `.terrace/state.json`.

- [ ] **Step 3: Update project truth**

Modify `.planning/PROJECT.md`:

```markdown
| Strict core scaffold implemented | `packages/terrace-core` now owns deterministic state, events, rules, gates, low-effort roadmap execution, and GSD port dry-run classification | — Active |
```

Modify `.planning/STATE.md` recent activity:

```markdown
Last activity: 2026-04-28 -- Standalone strict core scaffold implemented
```

- [ ] **Step 4: Try GitNexus detect/analyze if available**

Run:

```bash
npx gitnexus status
npx gitnexus analyze
```

Expected: If GitNexus fails with the known npm package error, record the failure in the final implementation summary.

- [ ] **Step 5: Commit truth files**

```bash
git add .planning/PROJECT.md .planning/STATE.md
git commit -m "docs: record strict core scaffold status"
```

## Self-Review

Spec coverage:

- JSON-led state: Task 1 and Task 2.
- Event log: Task 2.
- Stack command detection: Task 2.
- First-class rule domains: Task 3.
- RED/GREEN gates and testing-trust evidence: Task 4.
- Low-effort roadmap execution and `terrace quick`: Task 5 and Task 7.
- `terrace port gsd` dry-run classifier: Task 6 and Task 7.
- CLI delegation: Task 7.
- Truth file update and verification: Task 8.

Placeholder scan:

- No placeholder markers or unspecified test steps.

Type consistency:

- Core exports are CommonJS functions from `packages/terrace-core/src/index.cjs`.
- Tests import the same function names that implementation tasks define.
- State names match the spec: `initialized`, `intake_recorded`, `roadmap_ready`, `red_required`, `implementation_allowed`, `green_required`, `protected`.
