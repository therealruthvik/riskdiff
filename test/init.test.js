import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../src/init.js';

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'riskdiff-init-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('init writes config and reports skip for hook when no git repo', () => {
  withTempDir((dir) => {
    const { actions } = runInit(dir);
    assert.ok(existsSync(join(dir, '.riskdiffrc.json')));
    assert.ok(actions.some((a) => a.includes('wrote .riskdiffrc.json')));
    assert.ok(actions.some((a) => a.includes('not a git repo')));
  });
});

test('init installs an executable pre-commit hook in a git repo', () => {
  withTempDir((dir) => {
    mkdirSync(join(dir, '.git', 'hooks'), { recursive: true });
    runInit(dir);
    const hookPath = join(dir, '.git', 'hooks', 'pre-commit');
    assert.ok(existsSync(hookPath));
    const content = readFileSync(hookPath, 'utf8');
    assert.ok(content.includes('riskdiff --staged'));
    // executable bit set
    assert.ok(statSync(hookPath).mode & 0o100);
  });
});

test('init does not overwrite existing config without --force', () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, '.riskdiffrc.json'), '{"failOn":"low"}');
    const { actions } = runInit(dir);
    assert.ok(actions.some((a) => a.includes('skipped .riskdiffrc.json')));
    assert.equal(JSON.parse(readFileSync(join(dir, '.riskdiffrc.json'), 'utf8')).failOn, 'low');
  });
});

test('init --force overwrites config', () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, '.riskdiffrc.json'), '{"failOn":"low"}');
    runInit(dir, { force: true });
    assert.equal(JSON.parse(readFileSync(join(dir, '.riskdiffrc.json'), 'utf8')).failOn, 'high');
  });
});

test('init appends to an existing hook that lacks riskdiff', () => {
  withTempDir((dir) => {
    mkdirSync(join(dir, '.git', 'hooks'), { recursive: true });
    const hookPath = join(dir, '.git', 'hooks', 'pre-commit');
    writeFileSync(hookPath, '#!/bin/sh\nnpm test\n');
    const { actions } = runInit(dir);
    const content = readFileSync(hookPath, 'utf8');
    assert.ok(content.includes('npm test'));
    assert.ok(content.includes('riskdiff --staged'));
    assert.ok(actions.some((a) => a.includes('appended')));
  });
});

test('init leaves a hook that already runs riskdiff unchanged', () => {
  withTempDir((dir) => {
    mkdirSync(join(dir, '.git', 'hooks'), { recursive: true });
    const hookPath = join(dir, '.git', 'hooks', 'pre-commit');
    writeFileSync(hookPath, '#!/bin/sh\nriskdiff --staged --fail-on high || exit 1\n');
    const before = readFileSync(hookPath, 'utf8');
    const { actions } = runInit(dir);
    assert.equal(readFileSync(hookPath, 'utf8'), before);
    assert.ok(actions.some((a) => a.includes('already runs riskdiff')));
  });
});
