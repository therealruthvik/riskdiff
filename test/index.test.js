import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyze, getDiffText, formatReport } from '../src/index.js';

function withGitRepo(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'riskdiff-idx-'));
  const run = (cmd) => execSync(cmd, { cwd: dir, stdio: 'pipe' });
  try {
    run('git init -q');
    run('git config user.email t@t.t');
    run('git config user.name t');
    return fn(dir, run);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('analyze parses and scores a diff string', () => {
  const diff = `diff --git a/src/auth/login.js b/src/auth/login.js
--- a/src/auth/login.js
+++ b/src/auth/login.js
@@ -0,0 +1 @@
+const password = "hunter2pass";
`;
  const report = analyze(diff);
  assert.equal(report.level, 'HIGH');
  assert.ok(report.signals.length > 0);
});

test('getDiffText reads the unstaged working-tree diff', () => {
  withGitRepo((dir, run) => {
    writeFileSync(join(dir, 'a.js'), 'const x = 1;\n');
    run('git add a.js');
    run('git commit -qm init');
    writeFileSync(join(dir, 'a.js'), 'const x = 1;\nconst y = 2;\n');
    const text = execSync(`node ${join(process.cwd(), 'bin', 'riskdiff.js')} --json`, {
      cwd: dir,
      encoding: 'utf8',
    });
    const report = JSON.parse(text);
    assert.equal(report.level, 'LOW');
  });
});

test('getDiffText for staged changes returns the cached diff', () => {
  withGitRepo((dir, run) => {
    writeFileSync(join(dir, 'b.js'), 'eval(x);\n');
    run('git add b.js');
    const text = getDiffTextIn(dir, { staged: true });
    assert.ok(text.includes('eval(x);'));
  });
});

test('getDiffText throws a descriptive error outside a git repo', () => {
  const dir = mkdtempSync(join(tmpdir(), 'riskdiff-nogit-'));
  try {
    assert.throws(() => getDiffTextIn(dir, {}), /riskdiff: failed to run/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('formatReport renders the no-signals case', () => {
  const out = formatReport({ score: 0, level: 'LOW', reasons: [], signals: [], fileCount: 0 }, { color: false });
  assert.ok(out.includes('No risk signals found'));
});

test('formatReport emits ANSI color when color:true', () => {
  const out = formatReport({ score: 60, level: 'HIGH', reasons: [], signals: [], fileCount: 1 }, { color: true });
  assert.ok(out.includes('\x1b['));
});

// getDiffText runs git in process.cwd(); run it with cwd set via a child to
// keep the call hermetic.
function getDiffTextIn(dir, opts) {
  const original = process.cwd();
  process.chdir(dir);
  try {
    return getDiffText(opts);
  } finally {
    process.chdir(original);
  }
}
