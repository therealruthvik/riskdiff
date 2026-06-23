import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDependencyChanges } from '../src/rules.js';

function file(path, added = ['x']) {
  return { path, addedLines: added, removedLines: [], status: 'modified' };
}

test('flags package.json change', () => {
  const r = checkDependencyChanges([file('package.json')]);
  assert.equal(r.points, 8);
});

test('flags lockfiles', () => {
  for (const p of ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'go.sum', 'Cargo.lock']) {
    assert.equal(checkDependencyChanges([file(p)]).points, 8, p);
  }
});

test('flags nested manifest', () => {
  const r = checkDependencyChanges([file('packages/web/package.json')]);
  assert.equal(r.points, 8);
});

test('flags requirements.txt and go.mod', () => {
  assert.equal(checkDependencyChanges([file('requirements.txt')]).points, 8);
  assert.equal(checkDependencyChanges([file('go.mod')]).points, 8);
});

test('does not flag ordinary source files', () => {
  assert.equal(checkDependencyChanges([file('src/package.service.js')]).points, 0);
});

test('does not flag a manifest with no added lines', () => {
  assert.equal(checkDependencyChanges([file('package.json', [])]).points, 0);
});

test('accumulates across multiple manifests', () => {
  const r = checkDependencyChanges([file('package.json'), file('yarn.lock')]);
  assert.equal(r.points, 16);
});

test('can be disabled via config', () => {
  const r = checkDependencyChanges([file('package.json')], {
    rules: { dependencyChanges: { enabled: false } },
  });
  assert.equal(r.points, 0);
});
