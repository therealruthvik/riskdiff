#!/usr/bin/env node
import { getDiffText, analyze, formatReport } from '../src/index.js';
import { loadConfig } from '../src/config.js';

const LEVEL_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2 };

const HELP = `
riskdiff — pre-commit risk scanner for git diffs

Usage:
  riskdiff [options]

Options:
  --staged            Scan staged changes (git diff --cached)
  --against <ref>     Scan against a ref (e.g. main, HEAD~1)
  --fail-on <level>   Exit 1 if risk meets/exceeds level (low|medium|high)
                      [default: config failOn, or high]
  --json              Output JSON instead of formatted text
  --no-color          Disable colored output
  -h, --help          Show this help

Config:
  Reads .riskdiffrc.json, .riskdiffrc, or a "riskdiff" key in package.json.

Exit codes:
  0   Pass (or no changes)
  1   Blocked by --fail-on threshold
  2   Not in a git repo / git diff failed / bad config

Install as pre-commit hook:
  echo 'riskdiff --staged --fail-on high || exit 1' >> .git/hooks/pre-commit
  chmod +x .git/hooks/pre-commit
`.trim();

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(HELP);
  process.exit(0);
}

const staged = args.includes('--staged');
const jsonMode = args.includes('--json');
const noColor = args.includes('--no-color');

const againstIdx = args.indexOf('--against');
const against = againstIdx !== -1 ? args[againstIdx + 1] : null;

let config;
try {
  ({ config } = loadConfig());
} catch (err) {
  console.error(err.message);
  process.exit(2);
}

const failOnIdx = args.indexOf('--fail-on');
const failOnRaw = failOnIdx !== -1 ? args[failOnIdx + 1] : config.failOn || 'high';
const failOnLevel = String(failOnRaw).toUpperCase();

if (!(failOnLevel in LEVEL_ORDER)) {
  console.error(`riskdiff: invalid --fail-on value "${failOnRaw}". Use low, medium, or high.`);
  process.exit(2);
}

let diffText;
try {
  diffText = getDiffText({ staged, against });
} catch (err) {
  console.error(err.message);
  process.exit(2);
}

if (!diffText || !diffText.trim()) {
  if (jsonMode) {
    console.log(JSON.stringify({ score: 0, level: 'LOW', reasons: [], fileCount: 0 }));
  } else {
    console.log('riskdiff: no changes to scan.');
  }
  process.exit(0);
}

const report = analyze(diffText, config);

if (jsonMode) {
  console.log(JSON.stringify(report));
} else {
  console.log(formatReport(report, noColor ? { color: false } : {}));
}

if (LEVEL_ORDER[report.level] >= LEVEL_ORDER[failOnLevel]) {
  process.exit(1);
}
process.exit(0);
