import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDangerousCalls } from '../src/rules.js';

function makeFile(path, addedLines = []) {
  return { path, addedLines, removedLines: [] };
}

test('detects eval()', () => {
  const r = checkDangerousCalls([makeFile('a.js', ['eval(userInput);'])]);
  assert.equal(r.points, 15);
  assert.ok(r.reasons[0].includes('eval'));
});

test('detects os.system()', () => {
  const r = checkDangerousCalls([makeFile('a.py', ['os.system(cmd)'])]);
  assert.equal(r.points, 15);
});

test('detects subprocess shell=True', () => {
  const r = checkDangerousCalls([makeFile('a.py', ['subprocess.run(cmd, shell=True)'])]);
  // shell=True (+12) + subprocess invocation (+6) = 18
  assert.equal(r.points, 18);
});

test('detects unsafe pickle.loads', () => {
  const r = checkDangerousCalls([makeFile('a.py', ['data = pickle.loads(blob)'])]);
  assert.equal(r.points, 15);
});

test('detects dangerouslySetInnerHTML', () => {
  const r = checkDangerousCalls([makeFile('a.jsx', ['<div dangerouslySetInnerHTML={{__html: x}} />'])]);
  assert.equal(r.points, 10);
});

test('detects innerHTML assignment', () => {
  const r = checkDangerousCalls([makeFile('a.js', ['el.innerHTML = userContent;'])]);
  assert.equal(r.points, 8);
});

test('detects SQL string concatenation', () => {
  const r = checkDangerousCalls([makeFile('a.js', ['const q = "SELECT * FROM users WHERE id=" + id;'])]);
  assert.equal(r.points, 12);
});

test('detects TLS verification disabled (python)', () => {
  const r = checkDangerousCalls([makeFile('a.py', ['requests.get(url, verify=False)'])]);
  assert.equal(r.points, 12);
});

test('detects rejectUnauthorized:false', () => {
  const r = checkDangerousCalls([makeFile('a.js', ['const opts = { rejectUnauthorized: false };'])]);
  assert.equal(r.points, 12);
});

test('detects weak hash', () => {
  const r = checkDangerousCalls([makeFile('a.js', ['const h = md5(password);'])]);
  assert.equal(r.points, 5);
});

test('no false positive on safe code', () => {
  const r = checkDangerousCalls([makeFile('a.js', ['const sum = a + b;', 'return sum;'])]);
  assert.equal(r.points, 0);
});

test('respects cap of 5', () => {
  const lines = Array(8).fill('eval(x);');
  const r = checkDangerousCalls([makeFile('a.js', lines)]);
  assert.equal(r.points, 75); // 5 * 15
});

test('can be disabled via config', () => {
  const r = checkDangerousCalls([makeFile('a.js', ['eval(x);'])], {
    rules: { dangerousCalls: { enabled: false } },
  });
  assert.equal(r.points, 0);
});
