const LEVEL_ICON = { HIGH: '🔴', MEDIUM: '🟡', LOW: '🟢' };
const SEVERITY_ICON = { error: '🔴', warning: '🟡', note: '🔵' };

/**
 * Render a riskdiff report as Markdown suitable for posting as a PR comment.
 * @param {object} report result of analyze()/scoreDiff()
 */
export function toMarkdown(report) {
  const icon = LEVEL_ICON[report.level] || '';
  const lines = [`### ${icon} riskdiff: ${report.level} (score ${report.score})`];

  const signals = report.signals || [];
  if (signals.length === 0) {
    lines.push('');
    lines.push('No risk signals found. ✅');
  } else {
    lines.push('');
    lines.push('| Severity | Signal | Suggested fix |');
    lines.push('| --- | --- | --- |');
    for (const s of signals) {
      const sev = SEVERITY_ICON[s.severity] || '🔵';
      // escape pipes so the table renders
      const text = s.reason.replace(/\|/g, '\\|');
      const fix = (s.remediation || '').replace(/\|/g, '\\|');
      lines.push(`| ${sev} | ${text} | ${fix} |`);
    }
  }

  const footer = [`${report.fileCount} file(s) scanned`];
  if (report.suppressedCount > 0) {
    footer.push(`${report.suppressedCount} baselined signal(s) suppressed`);
  }
  lines.push('');
  lines.push(`_${footer.join(' · ')}_`);

  return lines.join('\n');
}
