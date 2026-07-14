'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { blocker, topBlockers, warning } = require('./guidance.cjs');
const { listProjectFiles, readSmallText } = require('./repo-analysis.cjs');

const SHIP_CHECK_MODES = ['fast', 'local', 'full'];

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function packageVersion(cwd) {
  const packageJson = readJsonFile(path.resolve(cwd, 'package.json')) || {};
  return typeof packageJson.version === 'string' ? packageJson.version : null;
}

function releaseArtifactFiles(cwd) {
  return listProjectFiles(cwd, { limit: 10000 }).filter((file) => {
    const normalized = file.replace(/\\/g, '/');
    return normalized === 'README.md' ||
      normalized === 'CHANGELOG.md' ||
      normalized === 'docs/RELEASE.md' ||
      normalized === 'package.json' ||
      normalized === 'scripts/package-dry-run.cjs' ||
      /^\.github\/workflows\/[^/]+\.ya?ml$/.test(normalized);
  });
}

const STALE_NPM_RELEASE_PATTERNS = [
  { code: 'NPM_TOKEN_REFERENCE', pattern: /\bNPM_TOKEN\b/ },
  { code: 'NODE_AUTH_TOKEN_REFERENCE', pattern: /\bNODE_AUTH_TOKEN\b/ },
  { code: 'NPM_LOGIN_INSTRUCTION', pattern: /\bnpm\s+(?:login|adduser|whoami)\b/i },
  { code: 'NPM_PUBLISH_INSTRUCTION', pattern: /\b(?:run|execute|use|call)\s+`?npm\s+publish\b/i },
  { code: 'NPM_AUTH_TOKEN_CONFIG', pattern: /\/\/registry\.npmjs\.org\/:_authToken/i },
  { code: 'PNPM_WHOAMI_INSTRUCTION', pattern: /\bpnpm\s+whoami\b/i }
];

function staleReleaseArtifactFindings(cwd) {
  const findings = [];
  for (const file of releaseArtifactFiles(cwd)) {
    const text = readSmallText(cwd, file, 250000);
    if (!text) {
      continue;
    }
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const item of STALE_NPM_RELEASE_PATTERNS) {
        if (item.pattern.test(line)) {
          findings.push({
            code: item.code,
            file,
            line: index + 1,
            evidence: line.trim().slice(0, 180)
          });
        }
      }
    });
  }
  return findings;
}

function currentReleaseTags(cwd) {
  try {
    const output = execFileSync('git', ['tag', '--points-at', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function gitCommitRef(cwd, ref) {
  try {
    return execFileSync('git', ['rev-parse', '--verify', ref], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    return null;
  }
}

function releaseVersionTagCheck(cwd, targetVersion) {
  const version = packageVersion(cwd);
  const expectedTag = targetVersion ? 'v' + targetVersion : version ? 'v' + version : null;
  const currentTags = currentReleaseTags(cwd);
  const semverTagsAtHead = currentTags.filter((tag) => /^v\d+\.\d+\.\d+(?:[-+].+)?$/.test(tag));
  const headCommit = gitCommitRef(cwd, 'HEAD');
  const expectedTagTarget = expectedTag ? gitCommitRef(cwd, 'refs/tags/' + expectedTag) : null;
  const mismatches = [];
  const warnings = [];
  if (!version) {
    mismatches.push({
      code: 'PACKAGE_VERSION_MISSING',
      message: 'package.json does not declare a release version.'
    });
  }
  if (targetVersion && version && version !== targetVersion) {
    mismatches.push({
      code: 'TARGET_VERSION_MISMATCH',
      message: 'Requested release version ' + targetVersion + ' does not match package.json version ' + version + '.',
      package_version: version,
      target_version: targetVersion
    });
  }
  if (expectedTag && semverTagsAtHead.length > 0 && !semverTagsAtHead.includes(expectedTag)) {
    mismatches.push({
      code: 'HEAD_TAG_VERSION_MISMATCH',
      message: 'HEAD is tagged for ' + semverTagsAtHead.join(', ') + ' instead of ' + expectedTag + '.',
      expected_tag: expectedTag,
      tags_at_head: semverTagsAtHead
    });
  }
  if (expectedTag && expectedTagTarget && headCommit && expectedTagTarget !== headCommit) {
    mismatches.push({
      code: 'RELEASE_TAG_NOT_AT_HEAD',
      message: 'Expected release tag exists but does not point at HEAD: ' + expectedTag + '.',
      expected_tag: expectedTag,
      tag_target: expectedTagTarget,
      head: headCommit
    });
  }
  if (expectedTag && !expectedTagTarget) {
    warnings.push(warning({
      code: 'RELEASE_TAG_NOT_FOUND',
      message: 'Expected release tag does not exist yet: ' + expectedTag + '.',
      why_blocked: 'The release can be preflighted before tagging, but publish should happen from the reviewed version tag.',
      next_command: 'git tag ' + expectedTag,
      remediation: 'Create the reviewed release tag after version and changelog review.'
    }));
  }
  return {
    package_version: version,
    target_version: targetVersion || version,
    expected_tag: expectedTag,
    tags_at_head: currentTags,
    tag_exists: Boolean(expectedTagTarget),
    tag_target: expectedTagTarget,
    passed: mismatches.length === 0,
    mismatches,
    warnings,
    blocking: mismatches.map((item) => blocker({
      code: item.code,
      message: item.message,
      why_blocked: 'Release publishing requires package version and git tag intent to agree.',
      next_command: 'terrace release-preflight --target-version ' + (targetVersion || version || '<version>') + ' --json',
      remediation: 'Align package.json, the reviewed target version, and any release tag at HEAD before publishing.',
      expected_tag: item.expected_tag,
      tags_at_head: item.tags_at_head,
      tag_target: item.tag_target,
      head: item.head
    }))
  };
}

function containsAll(text, values) {
  return values.every((value) => text.includes(value));
}

function trustedPublishingCheck(cwd) {
  const packageJson = readJsonFile(path.resolve(cwd, 'package.json')) || {};
  const workflow = readSmallText(cwd, '.github/workflows/release-publish.yml', 250000) || '';
  const releaseDocs = readSmallText(cwd, 'docs/RELEASE.md', 250000) || '';
  const packageName = typeof packageJson.name === 'string' ? packageJson.name : null;
  const version = typeof packageJson.version === 'string' ? packageJson.version : null;
  const releaseTarget = packageName && version ? packageName + '@' + version : packageName || null;
  const manualPrerequisites = [
    'npm package trusted publishing is configured for @jakyeamos33/terrace and the GitHub repository before publishing v0.2.0.',
    'GitHub environment `npm` has the intended reviewer protection before publish jobs can run.',
    'The GitHub Release is created for the reviewed v0.2.0 tag.'
  ];
  const requirements = [
    {
      code: 'PUBLISH_CONFIG_PUBLIC',
      passed: packageJson.publishConfig && packageJson.publishConfig.access === 'public',
      evidence: 'package.json#publishConfig.access'
    },
    {
      code: 'PUBLISH_CONFIG_PROVENANCE',
      passed: packageJson.publishConfig && packageJson.publishConfig.provenance === true,
      evidence: 'package.json#publishConfig.provenance'
    },
    {
      code: 'RELEASE_WORKFLOW_PRESENT',
      passed: Boolean(workflow),
      evidence: '.github/workflows/release-publish.yml'
    },
    {
      code: 'OIDC_PERMISSION',
      passed: /id-token:\s*write/.test(workflow),
      evidence: 'release-publish.yml permissions'
    },
    {
      code: 'NPM_ENVIRONMENT',
      passed: /environment:\s*npm/.test(workflow),
      evidence: 'release-publish.yml environment'
    },
    {
      code: 'PROVENANCE_PUBLISH_COMMAND',
      passed: workflow.includes('pnpm publish --access public --provenance --no-git-checks --config.node-linker=hoisted'),
      evidence: 'release-publish.yml publish step'
    },
    {
      code: 'TOKENLESS_PUBLISH',
      passed: !/\b(?:NPM_TOKEN|NODE_AUTH_TOKEN)\b/.test(workflow),
      evidence: 'release-publish.yml token scan'
    },
    {
      code: 'TRUSTED_PUBLISHING_DOCS',
      passed: /npm trusted publishing/i.test(releaseDocs) && /OIDC/i.test(releaseDocs),
      evidence: 'docs/RELEASE.md'
    }
  ];
  const missing = requirements.filter((item) => !item.passed);
  return {
    package_name: packageName,
    package_version: version,
    release_target: releaseTarget,
    passed: missing.length === 0,
    requirements,
    manual_prerequisites: manualPrerequisites,
    blocking: missing.map((item) => blocker({
      code: item.code,
      message: 'Trusted-publishing prerequisite is missing: ' + item.code + '.',
      why_blocked: 'Terrace releases must publish through GitHub OIDC trusted publishing without local npm auth tokens.',
      next_command: 'terrace release-preflight --json',
      remediation: 'Update package metadata, release workflow, or release docs so trusted publishing is explicit and tokenless.',
      evidence: item.evidence
    })),
    warnings: [warning({
      code: 'TRUSTED_PUBLISHING_MANUAL_REVIEW',
      message: 'npm trusted-publishing package settings and GitHub environment reviewers cannot be verified from repo files.',
      why_blocked: 'Local preflight can verify repo-owned prerequisites only.',
      next_command: 'terrace release-preflight --json',
      remediation: 'Confirm npm trusted publishing and GitHub environment reviewer settings in their admin UIs before publishing.',
      manual_prerequisites: manualPrerequisites
    })]
  };
}

function terracePackageReleaseTarget(cwd) {
  const packageJson = readJsonFile(path.resolve(cwd, 'package.json')) || {};
  return packageJson.name === '@jakyeamos33/terrace' && packageJson.version === '0.2.0';
}

function trustedPublishingShipCheck(cwd) {
  const result = trustedPublishingCheck(cwd);
  return {
    category: 'trusted_publishing',
    command: 'terrace release-preflight --json',
    passed: result.passed,
    package_name: result.package_name,
    package_version: result.package_version,
    release_target: result.release_target,
    requirements: result.requirements,
    manual_confirmation_required: result.manual_prerequisites.length > 0,
    manual_prerequisites: result.manual_prerequisites,
    blocking: result.blocking,
    warnings: result.warnings
  };
}

function releaseFlowChecks(cwd) {
  const packageJson = readJsonFile(path.resolve(cwd, 'package.json')) || {};
  const scripts = packageJson.scripts && typeof packageJson.scripts === 'object' ? packageJson.scripts : {};
  const ciWorkflow = readSmallText(cwd, '.github/workflows/ci.yml', 250000) || '';
  const dryRunWorkflow = readSmallText(cwd, '.github/workflows/release-dry-run.yml', 250000) || '';
  const publishWorkflow = readSmallText(cwd, '.github/workflows/release-publish.yml', 250000) || '';
  const releaseDocs = readSmallText(cwd, 'docs/RELEASE.md', 250000) || '';
  return [
    {
      name: 'ci',
      command: 'pnpm run ci',
      present: typeof scripts.ci === 'string' && containsAll(ciWorkflow + dryRunWorkflow + publishWorkflow + releaseDocs, ['pnpm run ci'])
    },
    {
      name: 'dependency_audit',
      command: 'pnpm audit --audit-level moderate',
      present: containsAll(ciWorkflow + dryRunWorkflow + publishWorkflow + releaseDocs, ['pnpm audit --audit-level moderate'])
    },
    {
      name: 'package',
      command: 'pnpm package',
      present: typeof scripts.package === 'string' && typeof scripts['package:dry-run'] === 'string' && releaseDocs.includes('pnpm package')
    },
    {
      name: 'release_dry_run',
      command: 'pnpm run release:dry-run',
      present: typeof scripts['release:dry-run'] === 'string' && containsAll(dryRunWorkflow + publishWorkflow + releaseDocs, ['pnpm run release:dry-run'])
    },
    {
      name: 'ship_check',
      command: 'terrace ship check --json',
      present: releaseDocs.includes('ship check --json')
    }
  ];
}

function releaseFlowCommandResult(cwd, item, runCommands) {
  if (!item.present) {
    return {
      ...item,
      ran: false,
      passed: false,
      blocking: [blocker({
        code: 'RELEASE_FLOW_STEP_MISSING',
        message: 'Release flow step is not documented or configured: ' + item.name + '.',
        why_blocked: 'Terrace 0.2.0 release preflight requires CI, audit, package, release dry-run, and ship-check flow coverage.',
        next_command: 'terrace release-preflight --json',
        remediation: 'Restore the package script, workflow step, or release checklist entry for `' + item.command + '`.'
      })]
    };
  }
  if (!runCommands) {
    return { ...item, ran: false, passed: true, blocking: [] };
  }
  if (item.name === 'ship_check') {
    return { ...item, ran: 'in_process', passed: true, blocking: [] };
  }
  const parts = item.command.split(/\s+/);
  try {
    execFileSync(parts[0], parts.slice(1), { cwd, stdio: 'ignore' });
    return { ...item, ran: true, passed: true, blocking: [] };
  } catch (error) {
    return {
      ...item,
      ran: true,
      passed: false,
      blocking: [blocker({
        code: 'RELEASE_FLOW_STEP_FAILED',
        message: item.command + ' failed.',
        why_blocked: 'Terrace cannot mark the release preflight ready while a release flow command fails.',
        next_command: item.command,
        remediation: 'Run the failing command locally and fix the reported issue before publishing.'
      })]
    };
  }
}

function staleReleaseArtifactsCheck(cwd) {
  const findings = staleReleaseArtifactFindings(cwd);
  return {
    passed: findings.length === 0,
    findings,
    blocking: findings.map((finding) => blocker({
      code: 'STALE_NPM_RELEASE_INSTRUCTION',
      message: finding.file + ':' + finding.line + ' still references old npm-era release instructions.',
      why_blocked: 'Release artifacts must describe trusted publishing and pnpm-based release flow, not token-era npm publishing.',
      next_command: 'terrace release-preflight --json',
      remediation: 'Replace npm-token, npm-login, or direct npm-publish instructions with the trusted-publishing flow.',
      finding
    }))
  };
}

function createReleasePreflight(dependencies) {
  const { dirtyTreeCheck, shipCheck } = dependencies;
  return function releasePreflight(cwd, options) {
    const opts = options || {};
    const targetVersion = typeof opts.targetVersion === 'string' && opts.targetVersion.trim() ? opts.targetVersion.trim() : packageVersion(cwd);
    const runCommands = opts.runCommands !== false;
    const shipMode = opts.shipMode !== undefined ? opts.shipMode : (runCommands ? 'full' : 'fast');
    const modeBlocker = !SHIP_CHECK_MODES.includes(shipMode)
      ? blocker({
        code: 'RELEASE_PREFLIGHT_MODE_INVALID',
        message: 'Unsupported release-preflight ship-check mode: ' + String(shipMode) + '.',
        why_blocked: 'Terrace must validate the requested ship-check mode before any release-flow command can execute.',
        next_command: 'terrace release-preflight --static --json',
        remediation: 'Use `--fast`, `--local`, or `--full`; omit the mode to use the release-preflight default.'
      })
      : !runCommands && shipMode === 'full'
        ? blocker({
          code: 'RELEASE_STATIC_MODE_INVALID',
          message: 'release-preflight --static cannot run ship-check full mode.',
          why_blocked: 'The static release-preflight contract is read-only and must not execute project package scripts.',
          next_command: 'terrace release-preflight --static --fast --json',
          remediation: 'Use `--static` with the default fast mode or `--local`; omit `--static` when you intentionally authorize the full release flow.'
        })
        : null;
    const executionDirtyTree = !modeBlocker && runCommands ? dirtyTreeCheck(cwd) : null;
    const flow = modeBlocker
      ? []
      : executionDirtyTree && !executionDirtyTree.passed
        ? releaseFlowChecks(cwd).map((item) => ({
          ...item,
          ran: false,
          skipped: true,
          passed: false,
          blocking: []
        }))
        : releaseFlowChecks(cwd).map((item) => releaseFlowCommandResult(cwd, item, runCommands));
    const ship = modeBlocker
      ? {
        mode: shipMode,
        passed: false,
        blockers: [modeBlocker],
        warnings: [],
        categories: []
      }
      : shipCheck(cwd, {
        mode: shipMode,
        includeTrustedPublishing: false
      });
    const trustedPublishing = trustedPublishingCheck(cwd);
    const tagVersion = releaseVersionTagCheck(cwd, targetVersion);
    const staleArtifacts = staleReleaseArtifactsCheck(cwd);
    const flowBlockers = flow.flatMap((item) => item.blocking || []);
    const executionBlockers = executionDirtyTree && !executionDirtyTree.passed && shipMode === 'fast'
      ? executionDirtyTree.blocking
      : [];
    const blockers = [
      ...flowBlockers,
      ...executionBlockers,
      ...ship.blockers,
      ...trustedPublishing.blocking,
      ...tagVersion.blocking,
      ...staleArtifacts.blocking
    ];
    const warnings = [
      ...ship.warnings,
      ...trustedPublishing.warnings,
      ...tagVersion.warnings
    ];
    return {
      command: 'terrace release-preflight',
      release: targetVersion,
      passed: blockers.length === 0,
      flow,
      ship_check: {
        mode: ship.mode,
        passed: ship.passed,
        blocker_count: ship.blockers.length,
        warning_count: ship.warnings.length,
        categories: ship.categories.map((category) => ({
          category: category.category,
          passed: category.passed,
          skipped: Boolean(category.skipped),
          command: category.command || null
        }))
      },
      trusted_publishing: trustedPublishing,
      tag_version: tagVersion,
      stale_release_artifacts: staleArtifacts,
      blockers,
      warnings,
      top_blockers: topBlockers(blockers, 5),
      next_command: blockers.length > 0 ? (blockers[0].next_command || 'terrace release-preflight --json') : 'git tag ' + tagVersion.expected_tag,
      recheck_command: 'terrace release-preflight --json'
    };
  };
}

module.exports = {
  SHIP_CHECK_MODES,
  createReleasePreflight,
  terracePackageReleaseTarget,
  trustedPublishingShipCheck
};
