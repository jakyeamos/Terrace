#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PACKETS = [
  'architecture.md',
  'commands.md',
  'conventions.md',
  'security.md',
  'failure-modes.md',
  'examples.md',
  'done.md',
  'deployment.md'
];

const QUALITY_COMMANDS = [
  'pnpm run lint',
  'pnpm run typecheck',
  'pnpm run test',
  'pnpm run build',
  'pnpm run package:dry-run',
  'pnpm run secret:scan',
  'node scripts/check_environment_contract.mjs'
];

const REQUIRED_FILES = [
  'AGENTS.md',
  'README.md',
  'docs/SECURITY.md',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.json',
  '.pre-cr.json',
  '.gitignore',
  '.quality-runner.toml',
  '.github/workflows/ci.yml',
  '.agents/context/README.md',
  ...PACKETS.map((packet) => `.agents/context/${packet}`)
];

function parseArgs(argv) {
  const args = { root: process.cwd(), asOf: new Date().toISOString() };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--root') args.root = path.resolve(argv[++index]);
    if (argument === '--as-of') args.asOf = argv[++index];
  }
  return args;
}

function readJson(root, relativePath, errors) {
  const absolutePath = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    errors.push(`${relativePath}: unable to parse JSON (${error.message})`);
    return {};
  }
}

function withinRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function checkContext(root, asOf, errors) {
  const contextRoot = path.join(root, '.agents', 'context');
  const indexPath = path.join(contextRoot, 'README.md');
  const indexText = fs.readFileSync(indexPath, 'utf8');
  const reviewed = indexText.match(/^last_reviewed:\s*(\d{4}-\d{2}-\d{2})\s*$/m)?.[1];
  const reviewedAt = reviewed ? Date.parse(`${reviewed}T00:00:00Z`) : Number.NaN;
  const ageDays = Number.isFinite(reviewedAt) ? Math.floor((asOf.getTime() - reviewedAt) / 86400000) : Number.NaN;
  if (!Number.isFinite(reviewedAt) || ageDays < 0 || ageDays > 35) {
    errors.push(`.agents/context/README.md: stale or invalid last_reviewed date`);
  }

  const links = [...indexText.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1].split('#')[0].trim());
  for (const link of links) {
    if (!link || link.startsWith('http://') || link.startsWith('https://') || link.startsWith('mailto:')) continue;
    const target = path.resolve(contextRoot, link);
    if (!withinRoot(root, target) || !fs.existsSync(target)) {
      errors.push(`.agents/context/README.md: invalid context link ${link}`);
    }
  }

  return { packets: PACKETS.filter((packet) => fs.existsSync(path.join(contextRoot, packet))).length, age_days: ageDays };
}

function checkTrackedSecrets(root, errors) {
  let tracked;
  try {
    tracked = execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  } catch (error) {
    errors.push(`git ls-files failed: ${error.message}`);
    return { count: null, paths: [] };
  }

  const secretPattern = /(^|\/)(\.env(?:\..*)?|credentials?(?:\.|\/)|id_rsa(?:\.|$)|.*\.(?:pem|key|p12|pfx))$/i;
  const secretPaths = tracked.filter((filePath) => secretPattern.test(filePath) && !/(^|\/)\.env\.(?:example|template)$/i.test(filePath));
  for (const filePath of secretPaths) errors.push(`tracked secret-like path: ${filePath}`);
  return { count: secretPaths.length, paths: secretPaths };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = args.root;
  const asOf = new Date(args.asOf);
  const errors = [];
  const files = {};

  if (!Number.isFinite(asOf.getTime())) errors.push(`invalid --as-of value: ${args.asOf}`);
  if (!fs.existsSync(root)) errors.push(`root does not exist: ${root}`);
  for (const relativePath of REQUIRED_FILES) {
    const present = fs.existsSync(path.join(root, relativePath));
    files[relativePath] = present;
    if (!present) errors.push(`missing required file: ${relativePath}`);
  }

  const packageJson = readJson(root, 'package.json', errors);
  const preCr = readJson(root, '.pre-cr.json', errors);
  const tsconfig = readJson(root, 'tsconfig.json', errors);
  const context = files['.agents/context/README.md'] && Number.isFinite(asOf.getTime())
    ? checkContext(root, asOf, errors)
    : { packets: 0, age_days: null };

  const scripts = packageJson.scripts ?? {};
  const missingCommands = QUALITY_COMMANDS.filter((command) => {
    const scriptName = command.startsWith('pnpm run ') ? command.slice('pnpm run '.length) : null;
    if (!scriptName) return false;
    return typeof scripts[scriptName] !== 'string';
  });
  if (missingCommands.length > 0) errors.push(`missing quality commands: ${missingCommands.join(', ')}`);
  if (JSON.stringify(preCr.qualityCommands ?? []) !== JSON.stringify(QUALITY_COMMANDS)) {
    errors.push('.pre-cr.json: qualityCommands do not match the canonical command set');
  }

  const adapter = (preCr.qualityAdapters ?? []).find((item) => item?.name === 'environment-contract');
  if (!adapter || adapter.command !== 'node scripts/check_environment_contract.mjs' || adapter.required !== true) {
    errors.push('.pre-cr.json: required environment-contract adapter is missing or incomplete');
  }

  const ciText = files['.github/workflows/ci.yml'] ? fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8') : '';
  if (!ciText.includes('pnpm run environment:contract')) errors.push('.github/workflows/ci.yml: environment contract is not required');

  const qualityRunnerText = files['.quality-runner.toml'] ? fs.readFileSync(path.join(root, '.quality-runner.toml'), 'utf8') : '';
  const qualityRunnerGate = qualityRunnerText.includes('id = "environment_contract"')
    && qualityRunnerText.includes('command = "node scripts/check_environment_contract.mjs"')
    && qualityRunnerText.includes('required = true')
    && qualityRunnerText.includes('severity = "blocker"');
  if (!qualityRunnerGate) errors.push('.quality-runner.toml: blocking environment_contract gate is missing or incomplete');

  const tsOptions = tsconfig.compilerOptions ?? {};
  const strictTypeChecking = tsOptions.strict === true && tsOptions.noImplicitAny === true && tsOptions.strictNullChecks === true;
  if (!strictTypeChecking) errors.push('tsconfig.json: strict, noImplicitAny, and strictNullChecks must all be true');

  const gitignore = files['.gitignore'] ? fs.readFileSync(path.join(root, '.gitignore'), 'utf8').split(/\r?\n/).map((line) => line.trim()) : [];
  const requiredIgnoreEntries = ['.env', '.env.*', 'dist/', '!.agents/', '!.agents/context/', '!.agents/context/**'];
  const missingIgnoreEntries = requiredIgnoreEntries.filter((entry) => !gitignore.includes(entry));
  if (missingIgnoreEntries.length > 0) errors.push(`.gitignore: missing protections ${missingIgnoreEntries.join(', ')}`);

  const secretPaths = checkTrackedSecrets(root, errors);
  const result = {
    schema_version: 'environment-contract/v1',
    root,
    as_of: asOf.toISOString(),
    status: errors.length === 0 ? 'pass' : 'fail',
    errors,
    checks: {
      context_packets: context.packets,
      context_packets_required: PACKETS.length,
      context_age_days: context.age_days,
      quality_commands: QUALITY_COMMANDS.length - missingCommands.length,
      quality_commands_required: QUALITY_COMMANDS.length,
      strict_type_checking: strictTypeChecking,
      tracked_secret_paths: secretPaths.count,
      required_pre_cr_adapter: Boolean(adapter && adapter.command === 'node scripts/check_environment_contract.mjs' && adapter.required === true),
      ci_environment_contract: ciText.includes('pnpm run environment:contract'),
      required_quality_runner_gate: qualityRunnerGate
    }
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = errors.length === 0 ? 0 : 1;
}

main();
