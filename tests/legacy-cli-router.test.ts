import { describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const { createLegacyCliRouter } = require('../src/legacy-cli-router.cjs');
const { listCommandCatalog } = require('../packages/terrace-core/src/command-catalog.cjs') as {
  listCommandCatalog: () => Array<{
    id: string;
    dispatch: {
      owner: string;
      forms: Array<{ kind: string; family_id: string | null; literals: string[] }>;
    } | null;
  }>;
};

describe('legacy CLI router', () => {
  it('loads without initializing the CLI dispatcher', () => {
    const routerPath = path.resolve(process.cwd(), 'src/legacy-cli-router.cjs');
    const cliPath = path.resolve(process.cwd(), 'src/terrace-tools.cjs');
    const script = [
      'require(' + JSON.stringify(routerPath) + ');',
      'const cliPath = require.resolve(' + JSON.stringify(cliPath) + ');',
      'process.stdout.write(JSON.stringify({ cli_loaded: Boolean(require.cache[cliPath]) }));'
    ].join('\n');
    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: process.cwd(),
      encoding: 'utf-8'
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ cli_loaded: false });
  });

  it('has one legacy handler case for every catalog-owned concrete legacy command', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/legacy-cli-router.cjs'), 'utf8');
    const handlerIds = new Set([...source.matchAll(/case '([^']+)'/g)].map((match) => match[1]));
    const catalogIds = listCommandCatalog()
      .filter((entry) => entry.dispatch?.owner === 'legacy' && entry.dispatch.forms.some((form) => form.kind === 'command'))
      .map((entry) => entry.id)
      .sort();

    expect([...handlerIds].sort()).toEqual(catalogIds);
  });

  it('keeps catalog-owned malformed legacy families in their existing error paths', () => {
    const router = createLegacyCliRouter();
    const familyForms = listCommandCatalog()
      .filter((entry) => entry.dispatch?.owner === 'legacy')
      .flatMap((entry) => entry.dispatch?.forms || [])
      .filter((form) => form.kind === 'family');

    for (const form of familyForms) {
      expect(router.route({
        family_id: form.family_id,
        args: [...form.literals, 'unknown'],
        raw_args: [...form.literals, 'unknown'],
        cwd: '/fixture',
        json: false
      })).toMatchObject({ handled: true, kind: 'error' });
    }
  });
});
