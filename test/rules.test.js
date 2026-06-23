import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkSensitivePaths,
  checkSmells,
  checkTestRatio,
  checkDiffSize,
} from '../src/rules.js';

function makeFile(path, addedLines = [], removedLines = []) {
  return { path, addedLines, removedLines };
}

// ── checkSensitivePaths ────────────────────────────────────────────────────

test('auth path → +25', () => {
  const result = checkSensitivePaths([makeFile('src/auth/login.js')]);
  assert.equal(result.points, 25);
  assert.ok(result.reasons[0].includes('auth'));
});

test('payment path → +30', () => {
  const result = checkSensitivePaths([makeFile('src/billing/invoice.js')]);
  assert.equal(result.points, 30);
});

test('stripe path → +30', () => {
  const result = checkSensitivePaths([makeFile('lib/stripe/client.js')]);
  assert.equal(result.points, 30);
});

test('config .yml path → +20', () => {
  const result = checkSensitivePaths([makeFile('config/database.yml')]);
  assert.equal(result.points, 20);
});

test('migration path → +15', () => {
  const result = checkSensitivePaths([makeFile('db/migrations/001_add_users.sql')]);
  assert.equal(result.points, 15);
});

test('acl path → +20', () => {
  const result = checkSensitivePaths([makeFile('src/acl/roles.js')]);
  assert.equal(result.points, 20);
});

test('file matching multiple patterns accumulates all points', () => {
  // auth AND rbac both match this path
  const result = checkSensitivePaths([makeFile('src/auth/middleware/rbac.js')]);
  // auth (+25) + access control (+20) = +45
  assert.equal(result.points, 45);
  assert.equal(result.reasons.length, 2);
});

test('zero files → zero points', () => {
  const result = checkSensitivePaths([]);
  assert.equal(result.points, 0);
  assert.deepEqual(result.reasons, []);
});

test('safe path → zero points', () => {
  const result = checkSensitivePaths([makeFile('src/utils/format.js')]);
  assert.equal(result.points, 0);
});

// ── checkSmells ────────────────────────────────────────────────────────────

test('empty catch block → +8 per occurrence', () => {
  const result = checkSmells([makeFile('src/app.js', ['try { foo() } catch (e) {}'])]);
  assert.equal(result.points, 8);
});

test('smell capped at 5 occurrences', () => {
  // 7 console.log lines → capped at 5, each +2 = +10
  const lines = Array(7).fill('console.log("debug")');
  const result = checkSmells([makeFile('src/app.js', lines)]);
  // only console.log/debug smell fires; 5 * 2 = 10
  const logReason = result.reasons.find(r => r.includes('console.log'));
  assert.ok(logReason);
  assert.ok(logReason.includes('x5'));
});

test('TODO FIXME smell → +4 each', () => {
  const result = checkSmells([
    makeFile('src/app.js', ['// TODO: implement this handler']),
  ]);
  assert.ok(result.points >= 4);
});

test('TypeScript any → +3', () => {
  const result = checkSmells([makeFile('src/api.ts', ['function process(value: any): void {}'])]);
  assert.ok(result.points >= 3);
});

test('generic var name → +1', () => {
  const result = checkSmells([makeFile('src/x.js', ['const result = compute();'])]);
  assert.ok(result.points >= 1);
});

test('no smells → zero points', () => {
  const result = checkSmells([makeFile('src/clean.js', ['export function greet(name) { return `Hello ${name}`; }'])]);
  // no smells expected
  const smellPoints = result.reasons.filter(r =>
    r.includes('empty catch') || r.includes('TODO') || r.includes('console.log') || r.includes("'any'")
  );
  // generic var might fire on clean code; just check smell-specific ones are absent
  assert.equal(smellPoints.length, 0);
});

// ── checkTestRatio ─────────────────────────────────────────────────────────

test('≥30 source lines, 0 test lines → +15', () => {
  const sourceLines = Array(35).fill('const x = 1;');
  const result = checkTestRatio([makeFile('src/service.js', sourceLines)]);
  assert.equal(result.points, 15);
});

test('<30 source lines, 0 test lines → 0 (no penalty)', () => {
  const sourceLines = Array(10).fill('const x = 1;');
  const result = checkTestRatio([makeFile('src/service.js', sourceLines)]);
  assert.equal(result.points, 0);
});

test('thin test coverage (<15%) → +6', () => {
  const sourceLines = Array(40).fill('const x = 1;');  // 40 source
  const testLines = Array(4).fill('assert(true)');      // 4 test = 10% < 15%
  const result = checkTestRatio([
    makeFile('src/service.js', sourceLines),
    makeFile('test/service.test.js', testLines),
  ]);
  assert.equal(result.points, 6);
});

test('healthy test ratio (≥15%) → 0', () => {
  const sourceLines = Array(40).fill('const x = 1;');  // 40 source
  const testLines = Array(8).fill('assert(true)');      // 8 = 20% ≥ 15%
  const result = checkTestRatio([
    makeFile('src/service.js', sourceLines),
    makeFile('test/service.test.js', testLines),
  ]);
  assert.equal(result.points, 0);
});

test('only test files, no source → 0', () => {
  const result = checkTestRatio([makeFile('test/foo.test.js', Array(50).fill('assert(true)'))]);
  assert.equal(result.points, 0);
});

// ── checkDiffSize ──────────────────────────────────────────────────────────

test('>400 added lines → +12', () => {
  const files = [makeFile('src/big.js', Array(401).fill('x'))];
  const result = checkDiffSize(files);
  assert.equal(result.points, 12);
});

test('>150 and ≤400 added lines → +5', () => {
  const files = [makeFile('src/med.js', Array(200).fill('x'))];
  const result = checkDiffSize(files);
  assert.equal(result.points, 5);
});

test('≤150 added lines → 0', () => {
  const files = [makeFile('src/small.js', Array(50).fill('x'))];
  const result = checkDiffSize(files);
  assert.equal(result.points, 0);
});

test('zero files → 0', () => {
  assert.equal(checkDiffSize([]).points, 0);
});
