import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMarkdown } from '../src/markdown.js';
import { scoreDiff } from '../src/score.js';

function makeFile(path, addedLines = []) {
  return { path, addedLines, removedLines: [], status: 'modified' };
}

test('renders a header with level and score', () => {
  const report = scoreDiff([makeFile('cfg.js', ['const k = "AKIAIOSFODNN7EXAMPLE";'])]);
  const md = toMarkdown(report);
  assert.ok(md.startsWith('### '));
  assert.ok(md.includes('HIGH'));
  assert.ok(md.includes(`score ${report.score}`));
});

test('renders a table row per signal', () => {
  const report = scoreDiff([makeFile('a.js', ['eval(x)', 'console.log(1)'])]);
  const md = toMarkdown(report);
  assert.ok(md.includes('| Severity | Signal |'));
  for (const s of report.signals) {
    assert.ok(md.includes(s.reason.replace(/\|/g, '\\|')), s.reason);
  }
});

test('clean diff shows the no-signals message', () => {
  const report = scoreDiff([makeFile('a.js', ['const sum = a + b;'])]);
  const md = toMarkdown(report);
  assert.ok(md.includes('No risk signals found'));
});

test('footer reports file count and suppressed count', () => {
  const report = { score: 0, level: 'LOW', signals: [], fileCount: 3, suppressedCount: 2 };
  const md = toMarkdown(report);
  assert.ok(md.includes('3 file(s) scanned'));
  assert.ok(md.includes('2 baselined signal(s) suppressed'));
});

test('escapes pipe characters in signal text', () => {
  const report = {
    score: 5,
    level: 'LOW',
    signals: [{ ruleId: 'custom', path: 'a.js', points: 5, severity: 'note', reason: 'a.js: matched a|b (+5)' }],
    fileCount: 1,
  };
  const md = toMarkdown(report);
  assert.ok(md.includes('a\\|b'));
});
