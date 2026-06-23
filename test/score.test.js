import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreDiff, THRESHOLDS } from '../src/score.js';

function makeFile(path, addedLines = []) {
  return { path, addedLines, removedLines: [] };
}

test('THRESHOLDS exports LOW/MEDIUM/HIGH values', () => {
  assert.equal(THRESHOLDS.LOW, 0);
  assert.equal(THRESHOLDS.MEDIUM, 25);
  assert.equal(THRESHOLDS.HIGH, 50);
});

test('zero files → score 0, level LOW', () => {
  const r = scoreDiff([]);
  assert.equal(r.score, 0);
  assert.equal(r.level, 'LOW');
  assert.deepEqual(r.reasons, []);
  assert.equal(r.fileCount, 0);
});

test('low risk safe file → level LOW', () => {
  const r = scoreDiff([makeFile('src/utils.js', ['export const add = (a, b) => a + b;'])]);
  assert.equal(r.level, 'LOW');
  assert.ok(r.score < THRESHOLDS.MEDIUM);
});

test('auth file alone → MEDIUM or HIGH', () => {
  // auth path = +25 → exactly MEDIUM threshold
  const r = scoreDiff([makeFile('src/auth/login.js', [])]);
  assert.ok(r.score >= THRESHOLDS.MEDIUM);
  assert.ok(['MEDIUM', 'HIGH'].includes(r.level));
});

test('auth + payment file → HIGH', () => {
  // auth (+25) + payment (+30) = +55 → HIGH
  const r = scoreDiff([
    makeFile('src/auth/token.js', []),
    makeFile('src/payment/checkout.js', []),
  ]);
  assert.equal(r.level, 'HIGH');
  assert.ok(r.score >= THRESHOLDS.HIGH);
});

test('score < 25 → LOW', () => {
  const r = scoreDiff([makeFile('src/config/app.yml', [])]);
  // config/secrets = +20, still LOW
  assert.equal(r.level, 'LOW');
});

test('score 25..49 → MEDIUM', () => {
  // auth = +25 exactly
  const r = scoreDiff([makeFile('src/auth/login.js', [])]);
  assert.equal(r.score, 25);
  assert.equal(r.level, 'MEDIUM');
});

test('score ≥ 50 → HIGH', () => {
  // auth (+25) + no tests for 35 lines (+15) + 200 line diff (+5) = 45, still need more
  // auth (+25) + payment (+30) = 55 → HIGH
  const r = scoreDiff([
    makeFile('src/auth/index.js', []),
    makeFile('src/payment/index.js', []),
  ]);
  assert.equal(r.level, 'HIGH');
});

test('fileCount equals number of parsed files', () => {
  const files = [
    makeFile('src/a.js', []),
    makeFile('src/b.js', []),
    makeFile('src/c.js', []),
  ];
  assert.equal(scoreDiff(files).fileCount, 3);
});

test('reasons array is populated on risky diff', () => {
  const r = scoreDiff([makeFile('src/auth/login.js', [])]);
  assert.ok(r.reasons.length > 0);
  assert.ok(r.reasons.some(reason => reason.toLowerCase().includes('auth')));
});
