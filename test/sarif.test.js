import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSarif } from '../src/sarif.js';
import { scoreDiff } from '../src/score.js';

function makeFile(path, addedLines = []) {
  return { path, addedLines, removedLines: [], status: 'modified' };
}

test('produces a valid SARIF 2.1.0 skeleton', () => {
  const sarif = toSarif({ signals: [] }, { version: '1.2.3' });
  assert.equal(sarif.version, '2.1.0');
  assert.ok(sarif.$schema.includes('sarif-2.1.0'));
  assert.equal(sarif.runs.length, 1);
  assert.equal(sarif.runs[0].tool.driver.name, 'riskdiff');
  assert.equal(sarif.runs[0].tool.driver.version, '1.2.3');
  assert.deepEqual(sarif.runs[0].results, []);
});

test('maps a secret signal to an error result with a file location', () => {
  const report = scoreDiff([makeFile('cfg.js', ['const k = "AKIAIOSFODNN7EXAMPLE";'])]);
  const sarif = toSarif(report);
  const results = sarif.runs[0].results;
  assert.ok(results.length >= 1);
  const secret = results.find((r) => r.ruleId === 'secrets');
  assert.equal(secret.level, 'error');
  assert.equal(secret.locations[0].physicalLocation.artifactLocation.uri, 'cfg.js');
  assert.ok(secret.locations[0].physicalLocation.region.startLine >= 1);
});

test('repo-level findings (diff size) have no physical location', () => {
  const report = scoreDiff([makeFile('big.js', Array(401).fill('x'))]);
  const sarif = toSarif(report);
  const diffResult = sarif.runs[0].results.find((r) => r.ruleId === 'diffSize');
  assert.ok(diffResult);
  assert.equal(diffResult.locations, undefined);
});

test('declares each fired rule once in tool.driver.rules', () => {
  const report = scoreDiff([
    makeFile('a.js', ['eval(x)', 'eval(y)']), // dangerousCalls twice
    makeFile('src/auth/login.js', []), // sensitivePaths
  ]);
  const sarif = toSarif(report);
  const ids = sarif.runs[0].tool.driver.rules.map((r) => r.id);
  // unique
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes('dangerousCalls'));
  assert.ok(ids.includes('sensitivePaths'));
});

test('sensitivePaths maps to warning level', () => {
  const report = scoreDiff([makeFile('src/auth/login.js', [])]);
  const sarif = toSarif(report);
  const r = sarif.runs[0].results.find((x) => x.ruleId === 'sensitivePaths');
  assert.equal(r.level, 'warning');
});
