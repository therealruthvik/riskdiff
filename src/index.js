import { execSync } from 'node:child_process';
import { parseDiff } from './parseDiff.js';
import { scoreDiff } from './score.js';
import { DEFAULT_CONFIG } from './config.js';
export { THRESHOLDS } from './score.js';
export { loadConfig, resolveConfig, DEFAULT_CONFIG } from './config.js';
export { loadBaseline } from './suppress.js';

export function getDiffText({ staged = false, against = null } = {}) {
  let cmd;
  if (against) {
    cmd = `git diff ${against}`;
  } else if (staged) {
    cmd = 'git diff --cached';
  } else {
    cmd = 'git diff';
  }

  try {
    return execSync(cmd, { maxBuffer: 20 * 1024 * 1024 }).toString();
  } catch (err) {
    throw new Error(`riskdiff: failed to run \`${cmd}\`: ${err.message}`);
  }
}

export function analyze(diffText, config = DEFAULT_CONFIG, opts = {}) {
  const files = parseDiff(diffText);
  return scoreDiff(files, config, opts);
}

/** Respect NO_COLOR env and non-TTY output by stripping ANSI. */
function colorEnabled({ color } = {}) {
  if (color === false) return false;
  if (color === true) return true;
  if (process.env.NO_COLOR) return false;
  return process.stdout.isTTY ?? false;
}

export function formatReport(report, opts = {}) {
  const useColor = colorEnabled(opts);
  const RESET = useColor ? '\x1b[0m' : '';
  const palette = { HIGH: '\x1b[31m', MEDIUM: '\x1b[33m', LOW: '\x1b[32m' };
  const color = useColor ? palette[report.level] : '';

  const lines = [
    `${color}riskdiff: ${report.level}${RESET} (score: ${report.score}, files: ${report.fileCount})`,
  ];

  if (report.reasons.length === 0) {
    lines.push('No risk signals found.');
  } else {
    lines.push('Signals:');
    for (const r of report.reasons) lines.push(`  • ${r}`);
  }

  if (report.suppressedCount > 0) {
    lines.push(`(${report.suppressedCount} baselined signal(s) suppressed)`);
  }

  return lines.join('\n');
}
