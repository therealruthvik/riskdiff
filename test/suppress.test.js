import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applySuppressions,
  fingerprintReason,
  pointsFromReason,
  applyBaseline,
} from '../src/suppress.js';
import { scoreDiff } from '../src/score.js';
import { resolveConfig } from '../src/config.js';

function makeFile(path, addedLines = []) {
  return { path, addedLines, removedLines: [] };
}

// ── inline suppression ─────────────────────────────────────────────────────

test('riskdiff-ignore drops the line from added lines', () => {
  const files = [makeFile('src/a.js', ['console.log("x") // riskdiff-ignore', 'keep me'])];
  const out = applySuppressions(files);
  assert.deepEqual(out[0].addedLines, ['keep me']);
});

test('riskdiff-ignore line no longer scores a smell', () => {
  const files = [makeFile('src/a.js', ['console.log("x") // riskdiff-ignore'])];
  const r = scoreDiff(files);
  // console.log smell would be +2; suppressed → 0
  assert.equal(r.score, 0);
});

test('riskdiff-disable-file removes the whole file', () => {
  const files = [
    makeFile('src/auth/x.js', ['// riskdiff-disable-file', 'try{}catch(e){}']),
    makeFile('src/b.js', ['clean']),
  ];
  const out = applySuppressions(files);
  assert.equal(out.length, 1);
  assert.equal(out[0].path, 'src/b.js');
});

test('disable-file zeroes even path-based score', () => {
  const files = [makeFile('src/auth/login.js', ['// riskdiff-disable-file'])];
  const r = scoreDiff(files);
  assert.equal(r.score, 0);
  assert.equal(r.fileCount, 0);
});

// ── fingerprint / points parsing ───────────────────────────────────────────

test('fingerprintReason strips the (+N) suffix', () => {
  assert.equal(
    fingerprintReason('Touches auth path: src/auth.js (+25)'),
    'Touches auth path: src/auth.js'
  );
});

test('pointsFromReason extracts the number', () => {
  assert.equal(pointsFromReason('Large diff: 512 lines added (+12)'), 12);
  assert.equal(pointsFromReason('no points here'), 0);
});

// ── baseline filtering ─────────────────────────────────────────────────────

test('applyBaseline removes matching reasons and subtracts points', () => {
  const reasons = ['Touches auth path: src/auth.js (+25)', 'src/auth.js: empty catch block x1 (+8)'];
  const baseline = new Set(['Touches auth path: src/auth.js']);
  const out = applyBaseline(33, reasons, baseline);
  assert.equal(out.score, 8);
  assert.equal(out.reasons.length, 1);
  assert.equal(out.suppressedCount, 1);
});

test('applyBaseline is a no-op for empty set', () => {
  const reasons = ['x (+5)'];
  const out = applyBaseline(5, reasons, new Set());
  assert.equal(out.score, 5);
  assert.equal(out.suppressedCount, 0);
});

test('scoreDiff applies baseline and recomputes level', () => {
  const cfg = resolveConfig({});
  const files = [makeFile('src/auth/login.js', [])]; // +25 → MEDIUM
  const baseline = new Set(['Touches auth path: src/auth/login.js']);
  const r = scoreDiff(files, cfg, { baseline });
  assert.equal(r.score, 0);
  assert.equal(r.level, 'LOW');
  assert.equal(r.suppressedCount, 1);
});
