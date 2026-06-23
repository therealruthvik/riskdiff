import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

test('--no-fail exits 0 even on a HIGH-risk staged diff', () => {
  const dir = mkdtempSync(join(tmpdir(), 'riskdiff-nofail-'));
  const sh = (c) => execFileSync('sh', ['-c', c], { cwd: dir });
  try {
    sh('git init -q && git config user.email t@t.t && git config user.name t');
    writeFileSync(join(dir, 'a.js'), 'const k = "AKIAIOSFODNN7EXAMPLE";\n');
    sh('git add -A');
    // Without --no-fail this would exit 1; with it, exit 0 and still report.
    const out = execFileSync('node', [bin, '--staged', '--no-fail', '--no-color'], {
      cwd: dir,
      encoding: 'utf8',
    });
    assert.ok(out.includes('HIGH'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
