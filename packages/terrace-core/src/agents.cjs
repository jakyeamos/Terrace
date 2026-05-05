'use strict';

const fs = require('fs');
const path = require('path');

const AGENT_SCHEMA_VERSION = '1.0';

function lines(items) {
  return items.join('\n') + '\n';
}

const AGENTS_MD = lines([
  '# Terrace Agent Instructions',
  '',
  'Use Terrace as the workflow authority for this repository.',
  '',
  '- Start by running `terrace next` when the next workflow step is unclear.',
  '- Route plain-language workflow requests through `terrace do "<intent>"`.',
  '- Use `terrace quick plan`, `terrace quick execute`, and `terrace quick complete` for small scoped work.',
  '- Use `terrace phase plan`, `terrace phase execute`, `terrace phase validate`, `terrace phase review`, and `terrace phase complete` for roadmap phase work.',
  '- Use `terrace execute-phase-complete <id>` only when the user wants a full phase lifecycle and Terrace gates allow it.',
  '- Set phase depth with `terrace settings effort <fast|standard|thorough>`.',
  '- Run `terrace ship check` before treating protected work as ready to ship.',
  '- Preserve spec and test evidence before changing protected implementation behavior.',
  '- Do not bypass repository quality gates or Terrace governance state.',
  '- Keep changes scoped, recoverable, and tied to the command output Terrace reports.'
]);

const CLAUDE_MD = lines([
  '# Terrace Claude Code Instructions',
  '',
  'Use Terrace as the workflow authority for this repository.',
  '',
  '- Run `terrace next` to identify the next workflow action.',
  '- Route natural-language requests through `terrace do "<intent>"` when a stable Terrace command is not obvious.',
  '- Use `/terrace-next`, `/terrace-plan`, `/terrace-execute`, `/terrace-execute-phase-complete`, `/terrace-quick`, and `/terrace-ship` when available.',
  '- Preserve spec intent, behavior-first tests, validation evidence, and release gates.',
  '- Do not overwrite Terrace state or bypass `terrace ship check` for protected work.',
  '- Keep edits scoped to the active Terrace task and stop at blockers reported by Terrace.'
]);

function skillContent(description, bodyLines) {
  return lines([
    '---',
    'description: ' + description,
    '---',
    '',
    ...bodyLines
  ]);
}

const CLAUDE_SKILLS = [
  {
    path: '.claude/skills/terrace-next/SKILL.md',
    description: 'Find and follow the next Terrace workflow action.',
    body: [
      '# Terrace Next',
      '',
      'Run `terrace next` and inspect the result.',
      '',
      'If Terrace reports a next command, explain it briefly and ask before making protected changes. If it reports blockers, stop and surface the blockers.'
    ]
  },
  {
    path: '.claude/skills/terrace-plan/SKILL.md',
    description: 'Plan Terrace-governed phase or quick-task work.',
    body: [
      '# Terrace Plan',
      '',
      'Use `terrace do "$ARGUMENTS"` when arguments are provided. If no arguments are provided, run `terrace next` first.',
      '',
      'Prefer `terrace phase plan <id>` for phase work and `terrace quick plan <title>` for small scoped work. Do not proceed to implementation until Terrace reports the plan is ready.'
    ]
  },
  {
    path: '.claude/skills/terrace-execute/SKILL.md',
    description: 'Execute Terrace-governed work within recorded gates.',
    body: [
      '# Terrace Execute',
      '',
      'Use `terrace do "$ARGUMENTS"` when arguments are provided. If no arguments are provided, run `terrace next` and follow the reported execution command.',
      '',
      'Respect RED, GREEN, validation, and review gates. Stop at blockers instead of bypassing Terrace governance.'
    ]
  },
  {
    path: '.claude/skills/terrace-execute-phase-complete/SKILL.md',
    description: 'Run a complete Terrace phase lifecycle from planning through completion.',
    body: [
      '# Terrace Execute Phase Complete',
      '',
      'Run `terrace do "/execute-phase-complete $ARGUMENTS"` when arguments are provided. If no phase is provided, run `terrace next` first and use the reported phase id.',
      '',
      'Inspect each returned step. Stop at blockers and do not bypass senior-cycle, security, validation, review, or cleanup gates.'
    ]
  },
  {
    path: '.claude/skills/terrace-quick/SKILL.md',
    description: 'Run Terrace quick-task planning, execution, and completion.',
    body: [
      '# Terrace Quick',
      '',
      'For a new quick task, run `terrace quick plan "$ARGUMENTS"`.',
      '',
      'For an existing quick task, use `terrace quick execute <id>` and `terrace quick complete <id>` only after the required evidence exists. Run `terrace quick list` when the id is unknown.'
    ]
  },
  {
    path: '.claude/skills/terrace-ship/SKILL.md',
    description: 'Run Terrace release readiness and shipping checks.',
    body: [
      '# Terrace Ship',
      '',
      'Run `terrace ship check` and inspect blockers and warnings.',
      '',
      'If release readiness passes and the user wants a written artifact, run `terrace ship prepare`. Do not claim work is ready when Terrace reports blockers.'
    ]
  }
];

function templateAssets() {
  return [
    { path: 'AGENTS.md', type: 'codex-instructions', content: AGENTS_MD },
    { path: 'CLAUDE.md', type: 'claude-instructions', content: CLAUDE_MD },
    ...CLAUDE_SKILLS.map((skill) => ({
      path: skill.path,
      type: 'claude-skill',
      content: skillContent(skill.description, skill.body)
    }))
  ];
}

function writeAsset(cwd, asset) {
  const target = path.resolve(cwd, asset.path);
  if (!target.startsWith(path.resolve(cwd) + path.sep)) {
    throw new Error('Agent asset path escapes repository: ' + asset.path);
  }
  if (fs.existsSync(target)) {
    const existing = fs.readFileSync(target, 'utf8');
    return {
      path: asset.path,
      type: asset.type,
      status: existing === asset.content ? 'unchanged' : 'skipped'
    };
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, asset.content, 'utf8');
  return { path: asset.path, type: asset.type, status: 'written' };
}

function writeManifest(cwd, assetResults) {
  const relPath = '.terrace/agents/manifest.json';
  const target = path.resolve(cwd, relPath);
  const manifest = {
    schema_version: AGENT_SCHEMA_VERSION,
    generated_by: 'terrace init',
    assets: assetResults
  };
  const content = JSON.stringify(manifest, null, 2) + '\n';
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const status = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === content ? 'unchanged' : 'written';
  fs.writeFileSync(target, content, 'utf8');
  return { path: relPath, type: 'manifest', status };
}

function installAgentBootstrap(cwd) {
  const assetResults = templateAssets().map((asset) => writeAsset(cwd, asset));
  const manifestResult = writeManifest(cwd, assetResults);
  return {
    enabled: true,
    manifest_path: manifestResult.path,
    assets: [...assetResults, manifestResult]
  };
}

module.exports = {
  installAgentBootstrap,
  templateAssets
};
