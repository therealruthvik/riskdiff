import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSecrets } from '../src/rules.js';
import { scoreDiff } from '../src/score.js';

function makeFile(path, addedLines = []) {
  return { path, addedLines, removedLines: [] };
}

test('detects AWS access key id', () => {
  const r = checkSecrets([makeFile('src/cfg.js', ['const k = "AKIAIOSFODNN7EXAMPLE";'])]);
  assert.equal(r.points, 50);
  assert.ok(r.reasons[0].includes('AWS access key'));
});

test('detects private key block', () => {
  const r = checkSecrets([makeFile('key.pem', ['-----BEGIN RSA PRIVATE KEY-----'])]);
  assert.equal(r.points, 50);
});

test('detects GitHub token', () => {
  const r = checkSecrets([makeFile('.env', ['GITHUB_TOKEN=ghp_' + 'a'.repeat(36)])]);
  assert.equal(r.points, 50);
});

test('detects Stripe live key', () => {
  const r = checkSecrets([makeFile('pay.js', ['const k = "sk_live_' + 'a'.repeat(24) + '";'])]);
  assert.equal(r.points, 50);
});

test('detects hardcoded credential assignment', () => {
  const r = checkSecrets([makeFile('db.js', ['const password = "hunter2pass";'])]);
  assert.equal(r.points, 30);
});

test('detects JWT', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N';
  const r = checkSecrets([makeFile('auth.js', [`const t = "${jwt}";`])]);
  assert.ok(r.points >= 40);
});

test('no false positive on ordinary code', () => {
  const r = checkSecrets([makeFile('src/a.js', ['const total = price * qty;', 'return total;'])]);
  assert.equal(r.points, 0);
});

test('a single secret pushes the diff to HIGH', () => {
  const r = scoreDiff([makeFile('src/cfg.js', ['const k = "AKIAIOSFODNN7EXAMPLE";'])]);
  assert.equal(r.level, 'HIGH');
});

test('secrets respect the cap', () => {
  const lines = Array(15).fill('const password = "hunter2pass";');
  const r = checkSecrets([makeFile('db.js', lines)]);
  // cap 10 * 30 = 300
  assert.equal(r.points, 300);
});

test('secrets rule can be disabled via config', () => {
  const r = checkSecrets([makeFile('src/cfg.js', ['const k = "AKIAIOSFODNN7EXAMPLE";'])], {
    rules: { secrets: { enabled: false } },
  });
  assert.equal(r.points, 0);
});
