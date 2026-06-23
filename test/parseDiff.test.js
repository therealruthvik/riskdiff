import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDiff } from '../src/parseDiff.js';

const SAMPLE_DIFF = `diff --git a/src/auth.js b/src/auth.js
index abc1234..def5678 100644
--- a/src/auth.js
+++ b/src/auth.js
@@ -1,3 +1,5 @@
+const token = getToken();
+if (!token) return;
 existing line
-removed line
diff --git a/src/util.js b/src/util.js
index 111aaaa..222bbbb 100644
--- a/src/util.js
+++ b/src/util.js
@@ -10,2 +10,3 @@
+export function helper() {}
 unchanged
`;

test('parses two files from multi-file diff', () => {
  const files = parseDiff(SAMPLE_DIFF);
  assert.equal(files.length, 2);
  assert.equal(files[0].path, 'src/auth.js');
  assert.equal(files[1].path, 'src/util.js');
});

test('extracts added lines with leading + stripped', () => {
  const files = parseDiff(SAMPLE_DIFF);
  assert.deepEqual(files[0].addedLines, ['const token = getToken();', 'if (!token) return;']);
  assert.deepEqual(files[1].addedLines, ['export function helper() {}']);
});

test('empty string returns empty array', () => {
  assert.deepEqual(parseDiff(''), []);
  assert.deepEqual(parseDiff('   '), []);
});

test('binary diff header with no +++ line is filtered out', () => {
  const binaryDiff = `diff --git a/assets/logo.png b/assets/logo.png
index abc..def 100644
Binary files a/assets/logo.png and b/assets/logo.png differ
`;
  const files = parseDiff(binaryDiff);
  assert.equal(files.length, 0);
});
