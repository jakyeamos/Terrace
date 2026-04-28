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
