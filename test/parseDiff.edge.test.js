import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDiff } from '../src/parseDiff.js';

test('parses a new file (status added)', () => {
  const diff = `diff --git a/src/new.js b/src/new.js
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/src/new.js
@@ -0,0 +1,2 @@
+export const x = 1;
+export const y = 2;
`;
  const files = parseDiff(diff);
  assert.equal(files.length, 1);
  assert.equal(files[0].path, 'src/new.js');
  assert.equal(files[0].status, 'added');
  assert.deepEqual(files[0].addedLines, ['export const x = 1;', 'export const y = 2;']);
});

test('parses a deleted file (path from old side, status deleted)', () => {
  const diff = `diff --git a/src/old.js b/src/old.js
deleted file mode 100644
index abc1234..0000000
--- a/src/old.js
+++ /dev/null
@@ -1,2 +0,0 @@
-export const x = 1;
-export const y = 2;
`;
  const files = parseDiff(diff);
  assert.equal(files.length, 1);
  assert.equal(files[0].path, 'src/old.js');
  assert.equal(files[0].status, 'deleted');
  assert.equal(files[0].addedLines.length, 0);
  assert.equal(files[0].removedLines.length, 2);
});

test('parses a rename (uses new path)', () => {
  const diff = `diff --git a/src/old-name.js b/src/new-name.js
similarity index 100%
rename from src/old-name.js
rename to src/new-name.js
`;
  const files = parseDiff(diff);
  assert.equal(files.length, 1);
  assert.equal(files[0].path, 'src/new-name.js');
  assert.equal(files[0].status, 'renamed');
});

test('handles multiple hunks in one file', () => {
  const diff = `diff --git a/src/multi.js b/src/multi.js
index 111..222 100644
--- a/src/multi.js
+++ b/src/multi.js
@@ -1,3 +1,4 @@
+first add
 context
@@ -20,3 +21,4 @@
+second add
 more context
`;
  const files = parseDiff(diff);
  assert.equal(files.length, 1);
  assert.deepEqual(files[0].addedLines, ['first add', 'second add']);
});

test('ignores "\\ No newline at end of file" marker', () => {
  const diff = `diff --git a/src/nonl.js b/src/nonl.js
index 111..222 100644
--- a/src/nonl.js
+++ b/src/nonl.js
@@ -1 +1 @@
-old line
\\ No newline at end of file
+new line
\\ No newline at end of file
`;
  const files = parseDiff(diff);
  assert.equal(files.length, 1);
  assert.deepEqual(files[0].addedLines, ['new line']);
  assert.deepEqual(files[0].removedLines, ['old line']);
});

test('binary modify with no +++/--- is filtered out', () => {
  const diff = `diff --git a/logo.png b/logo.png
index abc..def 100644
Binary files a/logo.png and b/logo.png differ
`;
  assert.equal(parseDiff(diff).length, 0);
});

test('mode-change-only diff with no content is filtered out', () => {
  const diff = `diff --git a/script.sh b/script.sh
old mode 100644
new mode 100755
`;
  // no +++/--- path lines → filtered
  assert.equal(parseDiff(diff).length, 0);
});

test('mixed batch: add, delete, modify in one diff', () => {
  const diff = `diff --git a/added.js b/added.js
new file mode 100644
--- /dev/null
+++ b/added.js
@@ -0,0 +1 @@
+new
diff --git a/removed.js b/removed.js
deleted file mode 100644
--- a/removed.js
+++ /dev/null
@@ -1 +0,0 @@
-gone
diff --git a/changed.js b/changed.js
--- a/changed.js
+++ b/changed.js
@@ -1 +1 @@
-before
+after
`;
  const files = parseDiff(diff);
  assert.equal(files.length, 3);
  assert.deepEqual(files.map((f) => f.path), ['added.js', 'removed.js', 'changed.js']);
  assert.deepEqual(files.map((f) => f.status), ['added', 'deleted', 'modified']);
});
