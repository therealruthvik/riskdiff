import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRemovedTests } from '../src/rules.js';

function file(path, { added = [], removed = [], status = 'modified' } = {}) {
  return { path, addedLines: added, removedLines: removed, status };
}

test('flags removed assertion lines in a test file', () => {
  const r = checkRemovedTests([
    file('src/foo.test.js', { removed: ['expect(x).toBe(1)', 'assert.equal(a, b)'] }),
  ]);
  assert.equal(r.points, 8); // 2 * 4
});

test('flags a deleted test file', () => {
  const r = checkRemovedTests([
    file('src/foo.test.js', { status: 'deleted', removed: ['it("works", () => {})'] }),
  ]);
  assert.equal(r.points, 12);
});

test('ignores removed lines in non-test files', () => {
  const r = checkRemovedTests([file('src/app.js', { removed: ['expect(x).toBe(1)'] })]);
  assert.equal(r.points, 0);
});

test('does not flag a refactor that adds as many test lines as it removes', () => {
  const r = checkRemovedTests([
    file('src/foo.test.js', {
      removed: ['it("a", () => {})', 'it("b", () => {})'],
      added: ['it("a renamed", () => {})', 'it("b renamed", () => {})'],
    }),
  ]);
  assert.equal(r.points, 0);
});

test('flags only the net loss of test lines', () => {
  const r = checkRemovedTests([
    file('src/foo.test.js', {
      removed: ['expect(1)', 'expect(2)', 'expect(3)'],
      added: ['expect(1)'],
    }),
  ]);
  assert.equal(r.points, 8); // net 2 * 4
});

test('respects the cap', () => {
  const removed = Array(10).fill('expect(x).toBe(1)');
  const r = checkRemovedTests([file('src/foo.test.js', { removed })]);
  assert.equal(r.points, 20); // cap 5 * 4
});

test('can be disabled via config', () => {
  const r = checkRemovedTests([file('src/foo.test.js', { removed: ['expect(x)'] })], {
    rules: { removedTests: { enabled: false } },
  });
  assert.equal(r.points, 0);
});
