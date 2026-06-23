import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bin = join(root, 'bin', 'riskdiff.js');
const pkgVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

function run(args) {
  return execFileSync('node', [bin, ...args], { encoding: 'utf8' });
}

test('--version prints the package version', () => {
  assert.equal(run(['--version']).trim(), pkgVersion);
});

test('-v prints the package version', () => {
  assert.equal(run(['-v']).trim(), pkgVersion);
});

test('--help prints usage', () => {
  const out = run(['--help']);
  assert.ok(out.includes('riskdiff'));
  assert.ok(out.includes('Usage:'));
});
