import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreDiff } from '../src/score.js';
import { formatReport, toMarkdown, toSarif } from '../src/index.js';

function makeFile(path, addedLines = []) {
  return { path, addedLines, removedLines: [], status: 'modified' };
}

test('signals carry a remediation string', () => {
  const report = scoreDiff([makeFile('a.js', ['eval(x)'])]);
  const s = report.signals.find((x) => x.ruleId === 'dangerousCalls');
  assert.ok(s.remediation.length > 0);
  assert.ok(/eval/i.test(s.remediation));
});

test('every fired signal has a non-empty remediation', () => {
  const report = scoreDiff([
    makeFile('src/auth/login.js', ['const password = "hunter2pass";', 'eval(y)']),
    makeFile('big.js', Array(401).fill('x')),
  ]);
  assert.ok(report.signals.length > 0);
  for (const s of report.signals) {
    assert.ok(s.remediation && s.remediation.length > 0, `${s.ruleId} missing remediation`);
  }
});

test('formatReport prints the fix under each signal', () => {
  const report = scoreDiff([makeFile('a.js', ['eval(x)'])]);
  const out = formatReport(report, { color: false });
  assert.ok(out.includes('↳'));
  assert.ok(out.includes('Avoid eval()'));
});

test('markdown includes a Suggested fix column', () => {
  const report = scoreDiff([makeFile('a.js', ['eval(x)'])]);
  const md = toMarkdown(report);
  assert.ok(md.includes('Suggested fix'));
  assert.ok(md.includes('Avoid eval()'));
});

test('SARIF embeds the fix in the message and rule help', () => {
  const report = scoreDiff([makeFile('a.js', ['eval(x)'])]);
  const sarif = toSarif(report);
  const result = sarif.runs[0].results.find((r) => r.ruleId === 'dangerousCalls');
  assert.ok(result.message.text.includes('Fix:'));
  const rule = sarif.runs[0].tool.driver.rules.find((r) => r.id === 'dangerousCalls');
  assert.ok(rule.help && rule.help.text.length > 0);
});
