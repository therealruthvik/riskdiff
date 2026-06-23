import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreDiff } from '../src/score.js';
import { checkSecrets, checkDangerousCalls } from '../src/rules.js';

function f(path, addedLines = []) {
  return { path, addedLines, removedLines: [], status: 'modified' };
}

// ── default ignorePaths ────────────────────────────────────────────────────

test('SVG files are ignored by default', () => {
  assert.equal(scoreDiff([f('logo.svg', ['console.log(1)'])]).fileCount, 0);
  assert.equal(scoreDiff([f('assets/icons/menu.svg', ['data1 = 2'])]).fileCount, 0);
});

test('lockfiles and minified files are ignored by default', () => {
  assert.equal(scoreDiff([f('package-lock.json', ['x'])]).fileCount, 0);
  assert.equal(scoreDiff([f('app.min.js', ['x'])]).fileCount, 0);
  assert.equal(scoreDiff([f('dist/bundle.js', ['x'])]).fileCount, 0);
});

test('.example/.sample/.template files are ignored by default', () => {
  assert.equal(scoreDiff([f('.env.example', [])]).fileCount, 0);
  assert.equal(scoreDiff([f('config.sample', [])]).fileCount, 0);
});

test('ordinary source files are still scanned', () => {
  assert.equal(scoreDiff([f('src/app.js', ['const x = 1;'])]).fileCount, 1);
});

// ── placeholder credential filter ──────────────────────────────────────────

test('placeholder credential values are not flagged', () => {
  for (const v of ['change-me-in-production', 'your_api_key_here', '<your-token>', 'xxxxxxxx', 'example-secret']) {
    const r = checkSecrets([f('a.py', [`password = "${v}"`])]);
    assert.equal(r.points, 0, v);
  }
});

test('env-reference credentials are not flagged', () => {
  assert.equal(checkSecrets([f('a.js', ['const password = process.env.DB_PASS;'])]).points, 0);
  assert.equal(checkSecrets([f('a.py', ['password = os.environ["DB_PASS"]'])]).points, 0);
});

test('a real hardcoded credential is still flagged', () => {
  assert.equal(checkSecrets([f('a.py', ['password = "hunter2RealValue"'])]).points, 30);
});

// ── eval / weak-hash method-call false positives ───────────────────────────

test('method-call .eval() is not flagged', () => {
  assert.equal(checkDangerousCalls([f('m.py', ['self.model.eval()'])]).points, 0);
  assert.equal(checkDangerousCalls([f('m.js', ['form.eval()'])]).points, 0);
});

test('bare eval() is still flagged', () => {
  assert.equal(checkDangerousCalls([f('a.js', ['eval(userInput)'])]).points, 15);
});

test('method-call .md5() is not flagged but bare md5() is', () => {
  assert.equal(checkDangerousCalls([f('a.js', ['crypto.md5(x)'])]).points, 0);
  assert.equal(checkDangerousCalls([f('a.js', ['md5(x)'])]).points, 5);
});
