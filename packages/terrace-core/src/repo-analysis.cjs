'use strict';

const { execFileSync } = require('child_process');
const fastGlob = require('fast-glob');
const fs = require('fs');
const ignore = require('ignore');
const path = require('path');
const YAML = require('yaml');

const TEXT_EXTENSIONS = new Set([
  '.cjs', '.css', '.env', '.html', '.js', '.jsx', '.json', '.md', '.mjs',
  '.prisma', '.scss', '.sql', '.ts', '.tsx', '.txt', '.yaml', '.yml'
]);

function safeReadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function safeReadYaml(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  try {
    return YAML.parse(fs.readFileSync(filePath, 'utf8')) || fallback;
  } catch (error) {
    return fallback;
  }
}

function loadIgnoreMatcher(cwd) {
  const matcher = ignore().add(['.git', 'node_modules', 'dist', 'coverage', '.next', '.turbo']);
  const gitignorePath = path.join(cwd, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    for (const line of fs.readFileSync(gitignorePath, 'utf8').split(/\r?\n/)) {
      const pattern = line.trim();
      if (pattern && !pattern.startsWith('#')) {
        matcher.add(pattern);
      }
    }
  }
  return matcher;
}

function listProjectFiles(cwd, options) {
  const opts = options || {};
  const matcher = loadIgnoreMatcher(cwd);
  const files = fastGlob.sync('**/*', {
    cwd,
    absolute: false,
    dot: true,
    onlyFiles: true,
    unique: true
  }).filter((file) => !matcher.ignores(file.replace(/\\/g, '/')));
  return files.sort().slice(0, opts.limit || 5000);
}

function currentChangedFiles(cwd) {
  try {
    const output = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function readSmallText(cwd, file, maxBytes) {
  const resolved = path.resolve(cwd, file);
  const root = path.resolve(cwd);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return null;
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return null;
  }
  if (!TEXT_EXTENSIONS.has(path.extname(file)) && !path.basename(file).startsWith('.env')) {
    return null;
  }
  const stat = fs.statSync(resolved);
  if (stat.size > (maxBytes || 200000)) {
    return null;
  }
  return fs.readFileSync(resolved, 'utf8');
}

function classifyFile(file) {
  const normalized = file.replace(/\\/g, '/');
  if (/(\btests?\b|__tests__|\.test\.|\.spec\.)/.test(normalized)) {
    return 'tests';
  }
  if (/\.(md|mdx)$/.test(normalized) || normalized.startsWith('docs/')) {
    return 'docs';
  }
  if (/(migrations?|prisma|schema\.sql|\.sql$)/.test(normalized)) {
    return 'data/migrations';
  }
  if (/(pages\/api|app\/api|routes|server|api|controller|resolver)/.test(normalized)) {
    return 'backend';
  }
  if (/(components|app\/|pages\/|ui\/|\.tsx$|\.jsx$|\.css$|\.scss$)/.test(normalized)) {
    return 'frontend';
  }
  if (/(observability|telemetry|logger|logging|metrics|trace|sentry|datadog)/i.test(normalized)) {
    return 'observability';
  }
  if (/(\.terrace|ROADMAP|PRD|SPEC|requirements)/i.test(normalized)) {
    return 'product/spec';
  }
  return 'backend';
}

function groupFilesByLane(files) {
  const lanes = {
    'product/spec': [],
    tests: [],
    frontend: [],
    backend: [],
    'data/migrations': [],
    observability: [],
    docs: [],
    cleanup: []
  };
  for (const file of files) {
    lanes[classifyFile(file)].push(file);
  }
  return lanes;
}

function detectImports(cwd, files) {
  const imports = [];
  for (const file of files.slice(0, 300)) {
    if (!/\.[cm]?[jt]sx?$/.test(file)) {
      continue;
    }
    const text = readSmallText(cwd, file, 120000);
    if (!text) {
      continue;
    }
    const patterns = [
      /import\s+[^'"]*['"]([^'"]+)['"]/g,
      /require\(['"]([^'"]+)['"]\)/g
    ];
    for (const pattern of patterns) {
      let match = pattern.exec(text);
      while (match) {
        imports.push({ file, source: match[1] });
        match = pattern.exec(text);
      }
    }
  }
  return imports;
}

function routeHints(files) {
  return files.filter((file) => /(app|pages)\/.*\.(tsx|jsx|ts|js)$/.test(file)).slice(0, 25);
}

function componentHints(files) {
  return files.filter((file) => /(components|ui)\/.*\.(tsx|jsx)$/.test(file)).slice(0, 25);
}

function analyzeRepository(cwd) {
  const files = listProjectFiles(cwd);
  const packageJson = safeReadJson(path.join(cwd, 'package.json'), {});
  const scripts = packageJson.scripts && typeof packageJson.scripts === 'object' ? packageJson.scripts : {};
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies
  };
  const changed_files = currentChangedFiles(cwd);
  const source_files = files.filter((file) => /\.(cjs|mjs|js|jsx|ts|tsx)$/.test(file) && !/(\btests?\b|__tests__|\.test\.|\.spec\.)/.test(file));
  const test_files = files.filter((file) => /(\btests?\b|__tests__|\.test\.|\.spec\.)/.test(file));
  const docs_files = files.filter((file) => file.startsWith('docs/') || /\.(md|mdx)$/.test(file));
  const config_files = files.filter((file) => /(^|\/)(package\.json|tsconfig|vite|next|eslint|vitest|docker|compose|workflow|action|\.github|\.env)/i.test(file) || /\.(ya?ml|json)$/.test(file));
  const migrations = files.filter((file) => /(migrations?|prisma|schema\.sql|\.sql$)/.test(file));
  return {
    files,
    changed_files,
    package_json: packageJson,
    workspace: safeReadYaml(path.join(cwd, 'pnpm-workspace.yaml'), null),
    scripts,
    dependencies,
    source_files,
    test_files,
    docs_files,
    config_files,
    migrations,
    route_hints: routeHints(files),
    component_hints: componentHints(files),
    imports: detectImports(cwd, source_files),
    lanes: groupFilesByLane(changed_files.length > 0 ? changed_files : files)
  };
}

function bulletList(items, empty) {
  const list = Array.from(new Set((items || []).filter(Boolean))).slice(0, 20);
  return list.length > 0 ? list.map((item) => '- ' + item) : ['- ' + empty];
}

module.exports = {
  analyzeRepository,
  bulletList,
  classifyFile,
  currentChangedFiles,
  groupFilesByLane,
  listProjectFiles,
  readSmallText
};
