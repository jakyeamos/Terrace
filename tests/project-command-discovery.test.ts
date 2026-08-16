import { describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  discoverProjectCommands: discoverFromWorkflow
} = require('../packages/terrace-core/src/workflow.cjs');
const {
  discoverProjectCommands
} = require('../packages/terrace-core/src/project-command-discovery.cjs');

describe('project command discovery boundary', () => {
  it('keeps the workflow compatibility export on the lower-level discovery owner', () => {
    expect(discoverFromWorkflow).toBe(discoverProjectCommands);
  });

  it('loads adoption without initializing workflow orchestration', () => {
    const adoptionPath = path.resolve(process.cwd(), 'packages/terrace-core/src/adoption.cjs');
    const workflowPath = path.resolve(process.cwd(), 'packages/terrace-core/src/workflow.cjs');
    const script = [
      'require(' + JSON.stringify(adoptionPath) + ');',
      'const workflowPath = require.resolve(' + JSON.stringify(workflowPath) + ');',
      'process.stdout.write(JSON.stringify({ workflow_loaded: Boolean(require.cache[workflowPath]) }));'
    ].join('\n');
    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: process.cwd(),
      encoding: 'utf-8'
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ workflow_loaded: false });
  });

  it('keeps malformed package JSON strict instead of falling back to an empty command surface', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-command-discovery-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{ malformed', 'utf-8');

      expect(() => discoverProjectCommands(tmpDir)).toThrow(SyntaxError);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
