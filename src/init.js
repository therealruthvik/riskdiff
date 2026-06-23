import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

const STARTER_CONFIG = {
  failOn: 'high',
  ignorePaths: ['dist/**', 'build/**', '*.min.js', '*.lock'],
  customRules: [],
};

const HOOK_MARKER = 'riskdiff --staged';
const HOOK_GUARD = 'riskdiff --staged --fail-on high || exit 1';

/**
 * Scaffold a riskdiff config and install the pre-commit hook.
 * @param {string} cwd
 * @param {object} [opts] { force }
 * @returns {{ actions: string[] }}
 */
export function runInit(cwd = process.cwd(), opts = {}) {
  const actions = [];

  // 1. config file
  const configPath = join(cwd, '.riskdiffrc.json');
  if (existsSync(configPath) && !opts.force) {
    actions.push(`skipped .riskdiffrc.json (already exists, use --force to overwrite)`);
  } else {
    writeFileSync(configPath, JSON.stringify(STARTER_CONFIG, null, 2) + '\n');
    actions.push(`wrote .riskdiffrc.json`);
  }

  // 2. pre-commit hook
  const hookDir = join(cwd, '.git', 'hooks');
  if (!existsSync(join(cwd, '.git'))) {
    actions.push(`skipped pre-commit hook (not a git repo — run "git init" first)`);
    return { actions };
  }

  const hookPath = join(hookDir, 'pre-commit');
  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, 'utf8');
    if (existing.includes(HOOK_MARKER)) {
      actions.push(`pre-commit hook already runs riskdiff (left unchanged)`);
    } else {
      const sep = existing.endsWith('\n') ? '' : '\n';
      writeFileSync(hookPath, existing + sep + HOOK_GUARD + '\n');
      chmodSync(hookPath, 0o755);
      actions.push(`appended riskdiff to existing pre-commit hook`);
    }
  } else {
    writeFileSync(hookPath, `#!/bin/sh\n# riskdiff pre-commit guard\n${HOOK_GUARD}\n`);
    chmodSync(hookPath, 0o755);
    actions.push(`installed .git/hooks/pre-commit`);
  }

  return { actions };
}

export { STARTER_CONFIG, HOOK_GUARD };
