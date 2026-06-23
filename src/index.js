import { execSync } from 'node:child_process';
import { parseDiff } from './parseDiff.js';
import { scoreDiff } from './score.js';
export { THRESHOLDS } from './score.js';

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

export function analyze(diffText) {
  const files = parseDiff(diffText);
  return scoreDiff(files);
}

export function formatReport(report) {
  const RESET = '\x1b[0m';
  const color = report.level === 'HIGH' ? '\x1b[31m' : report.level === 'MEDIUM' ? '\x1b[33m' : '\x1b[32m';

  const lines = [
    `${color}riskdiff: ${report.level}${RESET} (score: ${report.score}, files: ${report.fileCount})`,
  ];

  if (report.reasons.length === 0) {
    lines.push('No risk signals found.');
  } else {
    lines.push('Signals:');
    for (const r of report.reasons) lines.push(`  • ${r}`);
  }

  return lines.join('\n');
}
