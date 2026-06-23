import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Default configuration. Every weight, threshold, and pattern lives here so a
 * repo can override any of it via .riskdiffrc(.json) or a "riskdiff" key in
 * package.json. Rules read their numbers from the resolved config — nothing is
 * hardcoded in the rule functions.
 */
export const DEFAULT_CONFIG = {
  thresholds: { medium: 25, high: 50 },
  failOn: 'high',
  // Glob-ish path patterns to skip entirely (matched against file path).
  ignorePaths: [],
  rules: {
    sensitivePaths: {
      enabled: true,
      patterns: [
        { pattern: '/auth/', flags: 'i', points: 25, label: 'auth' },
        { pattern: '(payment|billing|stripe|checkout)', flags: 'i', points: 30, label: 'payments' },
        { pattern: '(secret|credential|\\.env|config/.*\\.(yml|yaml|json))', flags: 'i', points: 20, label: 'config/secrets' },
        { pattern: '(migration|schema)', flags: 'i', points: 15, label: 'db schema/migration' },
        { pattern: '(middleware|permission|acl|rbac)', flags: 'i', points: 20, label: 'access control' },
      ],
    },
    smells: {
      enabled: true,
      cap: 5,
      patterns: [
        { pattern: '\\bcatch\\s*\\(\\s*\\w*\\s*\\)\\s*\\{\\s*\\}', flags: 'g', points: 8, label: 'empty catch block' },
        { pattern: '\\b(TODO|FIXME)\\b.*\\b(implement|handle|fix)\\b', flags: 'gi', points: 4, label: 'unresolved TODO/FIXME' },
        { pattern: '\\b(data|temp|result|value|item|obj)\\d?\\s*=', flags: 'g', points: 1, label: 'generic placeholder var' },
        { pattern: 'console\\.(log|debug)\\(', flags: 'g', points: 2, label: 'leftover console.log/debug' },
        { pattern: '\\bany\\b\\s*[:)]', flags: 'g', points: 3, label: "TypeScript 'any' escape hatch" },
      ],
    },
    testRatio: {
      enabled: true,
      minSourceLines: 30,
      noTestPoints: 15,
      thinRatio: 0.15,
      thinPoints: 6,
    },
    diffSize: {
      enabled: true,
      largeThreshold: 400,
      largePoints: 12,
      mediumThreshold: 150,
      mediumPoints: 5,
    },
  },
  // User-defined regex rules: { name, pattern, flags, points, label, addedOnly }
  customRules: [],
};

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

/** Deep-merge `override` onto `base`. Arrays replace wholesale (not merged). */
export function mergeConfig(base, override) {
  if (!isObject(override)) return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const key of Object.keys(override)) {
    if (isObject(base[key]) && isObject(override[key])) {
      out[key] = mergeConfig(base[key], override[key]);
    } else {
      out[key] = override[key];
    }
  }
  return out;
}

/** Resolve a partial config object over the defaults. */
export function resolveConfig(partial) {
  return mergeConfig(DEFAULT_CONFIG, partial || {});
}

const CONFIG_FILENAMES = ['.riskdiffrc.json', '.riskdiffrc'];

/**
 * Load config from cwd. Search order:
 *   1. .riskdiffrc.json / .riskdiffrc (JSON)
 *   2. "riskdiff" key in package.json
 *   3. defaults
 * @returns {{ config: object, source: string|null }}
 */
export function loadConfig(cwd = process.cwd()) {
  for (const name of CONFIG_FILENAMES) {
    const path = join(cwd, name);
    if (existsSync(path)) {
      const raw = readFileSync(path, 'utf8');
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        throw new Error(`riskdiff: failed to parse ${name}: ${err.message}`);
      }
      return { config: resolveConfig(parsed), source: name };
    }
  }

  const pkgPath = join(cwd, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      if (pkg && isObject(pkg.riskdiff)) {
        return { config: resolveConfig(pkg.riskdiff), source: 'package.json' };
      }
    } catch {
      // ignore malformed package.json — fall through to defaults
    }
  }

  return { config: DEFAULT_CONFIG, source: null };
}
