import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_CONFIG, mergeConfig, resolveConfig, loadConfig } from '../src/config.js';
import { scoreDiff } from '../src/score.js';
import {
  checkSensitivePaths,
  checkDiffSize,
  checkCustomRules,
  applyIgnorePaths,
} from '../src/rules.js';

function makeFile(path, addedLines = []) {
  return { path, addedLines, removedLines: [] };
}

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'riskdiff-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── mergeConfig / resolveConfig ────────────────────────────────────────────

test('mergeConfig deep-merges nested objects', () => {
  const merged = mergeConfig(DEFAULT_CONFIG, { thresholds: { high: 80 } });
  assert.equal(merged.thresholds.high, 80);
  assert.equal(merged.thresholds.medium, 25); // preserved
});

test('mergeConfig replaces arrays wholesale', () => {
  const merged = mergeConfig(DEFAULT_CONFIG, { ignorePaths: ['dist/**'] });
  assert.deepEqual(merged.ignorePaths, ['dist/**']);
});

test('resolveConfig fills defaults for partial input', () => {
  const cfg = resolveConfig({ failOn: 'medium' });
  assert.equal(cfg.failOn, 'medium');
  assert.equal(cfg.rules.smells.cap, 5);
});

// ── loadConfig ─────────────────────────────────────────────────────────────

test('loadConfig returns defaults when no config present', () => {
  withTempDir((dir) => {
    const { config, source } = loadConfig(dir);
    assert.equal(source, null);
    assert.equal(config.thresholds.high, 50);
  });
});

test('loadConfig reads .riskdiffrc.json', () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, '.riskdiffrc.json'), JSON.stringify({ thresholds: { high: 99 } }));
    const { config, source } = loadConfig(dir);
    assert.equal(source, '.riskdiffrc.json');
    assert.equal(config.thresholds.high, 99);
    assert.equal(config.thresholds.medium, 25); // default preserved
  });
});

test('loadConfig reads "riskdiff" key from package.json', () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', riskdiff: { failOn: 'low' } }));
    const { config, source } = loadConfig(dir);
    assert.equal(source, 'package.json');
    assert.equal(config.failOn, 'low');
  });
});

test('loadConfig throws on malformed .riskdiffrc.json', () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, '.riskdiffrc.json'), '{ not valid json');
    assert.throws(() => loadConfig(dir), /failed to parse/);
  });
});

// ── config drives rules ────────────────────────────────────────────────────

test('custom threshold changes level', () => {
  const cfg = resolveConfig({ thresholds: { medium: 10, high: 20 } });
  const r = scoreDiff([makeFile('src/config/app.yml', [])], cfg); // config = +20
  assert.equal(r.level, 'HIGH'); // 20 >= high(20)
});

test('disabling a rule zeroes its points', () => {
  const cfg = resolveConfig({ rules: { sensitivePaths: { enabled: false } } });
  const r = checkSensitivePaths([makeFile('src/auth/login.js')], cfg);
  assert.equal(r.points, 0);
});

test('overriding a weight changes the score', () => {
  const cfg = resolveConfig({ rules: { diffSize: { largePoints: 100 } } });
  const r = checkDiffSize([makeFile('src/big.js', Array(401).fill('x'))], cfg);
  assert.equal(r.points, 100);
});

// ── ignorePaths ────────────────────────────────────────────────────────────

test('ignorePaths drops matching files before scoring', () => {
  const cfg = resolveConfig({ ignorePaths: ['dist/**', '*.min.js'] });
  const files = [
    makeFile('dist/bundle.js', Array(50).fill('x')),
    makeFile('app.min.js', Array(50).fill('x')),
    makeFile('src/auth/login.js', []),
  ];
  const kept = applyIgnorePaths(files, cfg);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].path, 'src/auth/login.js');
});

test('scoreDiff respects ignorePaths in fileCount', () => {
  const cfg = resolveConfig({ ignorePaths: ['vendor/**'] });
  const files = [makeFile('vendor/lib.js', Array(50).fill('x')), makeFile('src/a.js', [])];
  const r = scoreDiff(files, cfg);
  assert.equal(r.fileCount, 1);
});

// ── customRules ────────────────────────────────────────────────────────────

test('customRules add points on match', () => {
  const cfg = resolveConfig({
    customRules: [{ name: 'no-xxx', pattern: 'XXX', flags: 'g', points: 7, label: 'XXX marker' }],
  });
  const r = checkCustomRules([makeFile('src/a.js', ['// XXX fix this', 'const x = 1; // XXX'])], cfg);
  assert.equal(r.points, 14); // 2 matches * 7
});

test('customRules empty by default', () => {
  const r = checkCustomRules([makeFile('src/a.js', ['anything'])]);
  assert.equal(r.points, 0);
});
