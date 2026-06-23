#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getDiffText, analyze, formatReport } from '../src/index.js';
import { loadConfig } from '../src/config.js';
import { loadBaseline, fingerprintReason, BASELINE_FILENAME } from '../src/suppress.js';
import { runInit } from '../src/init.js';
import { toSarif } from '../src/sarif.js';
import { toMarkdown } from '../src/markdown.js';

const PKG_VERSION = (() => {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    return JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')).version;
  } catch {
    return '0.0.0';
  }
})();

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
  --sarif             Output SARIF 2.1.0 (for GitHub code scanning)
  --markdown          Output Markdown (for posting as a PR comment)
  --no-color          Disable colored output
  --no-baseline       Ignore .riskdiff-baseline.json for this run
  -h, --help          Show this help

Commands:
  init                Scaffold .riskdiffrc.json and install the pre-commit hook
                      (use --force to overwrite an existing config)
  baseline            Write all current signals to .riskdiff-baseline.json so
                      they are suppressed on future runs (grandfather existing
                      issues). Honors --staged / --against.

Config:
  Reads .riskdiffrc.json, .riskdiffrc, or a "riskdiff" key in package.json.
  Inline suppression: add "riskdiff-ignore" on a line to skip it, or
  "riskdiff-disable-file" anywhere in a file to skip the whole file.

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

const command = args[0] && !args[0].startsWith('-') ? args[0] : null;
const staged = args.includes('--staged');
const jsonMode = args.includes('--json');
const sarifMode = args.includes('--sarif');
const markdownMode = args.includes('--markdown');
const noColor = args.includes('--no-color');
const noBaseline = args.includes('--no-baseline');

const againstIdx = args.indexOf('--against');
const against = againstIdx !== -1 ? args[againstIdx + 1] : null;

// `riskdiff init` — scaffold config + install hook. Runs before config load.
if (command === 'init') {
  const { actions } = runInit(process.cwd(), { force: args.includes('--force') });
  for (const a of actions) console.log(`riskdiff: ${a}`);
  process.exit(0);
}

let config;
try {
  ({ config } = loadConfig());
} catch (err) {
  console.error(err.message);
  process.exit(2);
}

// `riskdiff baseline` — record current signals so they stop firing.
if (command === 'baseline') {
  let diff;
  try {
    diff = getDiffText({ staged, against });
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
  const report = analyze(diff, config);
  const reasons = report.reasons.map(fingerprintReason);
  writeFileSync(BASELINE_FILENAME, JSON.stringify({ reasons }, null, 2) + '\n');
  console.log(`riskdiff: wrote ${reasons.length} signal(s) to ${BASELINE_FILENAME}`);
  process.exit(0);
}

let baseline;
try {
  baseline = noBaseline ? new Set() : loadBaseline();
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
  if (sarifMode) {
    console.log(JSON.stringify(toSarif({ signals: [] }, { version: PKG_VERSION }), null, 2));
  } else if (markdownMode) {
    console.log(toMarkdown({ score: 0, level: 'LOW', reasons: [], signals: [], fileCount: 0 }));
  } else if (jsonMode) {
    console.log(JSON.stringify({ score: 0, level: 'LOW', reasons: [], fileCount: 0 }));
  } else {
    console.log('riskdiff: no changes to scan.');
  }
  process.exit(0);
}

const report = analyze(diffText, config, { baseline });

if (sarifMode) {
  console.log(JSON.stringify(toSarif(report, { version: PKG_VERSION }), null, 2));
} else if (markdownMode) {
  console.log(toMarkdown(report));
} else if (jsonMode) {
  console.log(JSON.stringify(report));
} else {
  console.log(formatReport(report, noColor ? { color: false } : {}));
}

if (LEVEL_ORDER[report.level] >= LEVEL_ORDER[failOnLevel]) {
  process.exit(1);
}
process.exit(0);
