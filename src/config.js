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
        { pattern: '/auth/', flags: 'i', points: 25, label: 'auth', fix: 'Get a security review of this change and confirm the auth paths are covered by tests.' },
        { pattern: '(payment|billing|stripe|checkout)', flags: 'i', points: 30, label: 'payments', fix: 'Require a second reviewer; verify amount validation and idempotency are tested.' },
        { pattern: '(secret|credential|\\.env|config/.*\\.(yml|yaml|json))', flags: 'i', points: 20, label: 'config/secrets', fix: 'Confirm no secrets are committed; load configuration from env vars or a secret manager.' },
        { pattern: '(migration|schema)', flags: 'i', points: 15, label: 'db schema/migration', fix: 'Review for backward compatibility, include a rollback plan, and test against a copy of prod.' },
        { pattern: '(middleware|permission|acl|rbac)', flags: 'i', points: 20, label: 'access control', fix: 'Have a reviewer confirm least-privilege and add authorization tests.' },
      ],
    },
    secrets: {
      enabled: true,
      cap: 10,
      patterns: [
        { pattern: '-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----', flags: 'g', points: 50, label: 'private key', fix: 'Remove the key from source, rotate it immediately, and store it in a secret manager.' },
        { pattern: '\\bAKIA[0-9A-Z]{16}\\b', flags: 'g', points: 50, label: 'AWS access key id', fix: 'Revoke and rotate the AWS key now; load credentials from the environment or IAM roles.' },
        { pattern: '\\bgh[pousr]_[A-Za-z0-9]{36}\\b', flags: 'g', points: 50, label: 'GitHub token', fix: 'Revoke the token in GitHub settings and load it from an environment variable instead.' },
        { pattern: '\\bxox[baprs]-[A-Za-z0-9-]{10,}\\b', flags: 'g', points: 50, label: 'Slack token', fix: 'Revoke the Slack token and load it from an environment variable instead.' },
        { pattern: '\\bAIza[0-9A-Za-z_\\-]{35}\\b', flags: 'g', points: 50, label: 'Google API key', fix: 'Rotate the Google API key, restrict it, and load it from an environment variable.' },
        { pattern: '\\b(sk|pk)_live_[0-9A-Za-z]{16,}\\b', flags: 'g', points: 50, label: 'Stripe live key', fix: 'Roll the Stripe key in the dashboard and load it from an environment variable.' },
        { pattern: '\\beyJ[A-Za-z0-9_\\-]{10,}\\.[A-Za-z0-9_\\-]{10,}\\.[A-Za-z0-9_\\-]{10,}\\b', flags: 'g', points: 40, label: 'JWT', fix: 'Do not hardcode tokens; mint them at runtime and keep signing secrets in the environment.' },
        { pattern: '(password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\\s*[:=]\\s*[\'\"][^\'\"]{8,}[\'\"]', flags: 'gi', points: 30, label: 'hardcoded credential', fix: 'Move the value to an environment variable or secret manager; never commit credentials.' },
      ],
    },
    dangerousCalls: {
      enabled: true,
      cap: 5,
      patterns: [
        { pattern: '\\beval\\s*\\(', flags: 'g', points: 15, label: 'eval() call', fix: 'Avoid eval(); parse/validate input or use a safe alternative such as JSON.parse or a lookup table.' },
        { pattern: '\\bnew Function\\s*\\(', flags: 'g', points: 12, label: 'Function constructor', fix: 'Avoid the Function constructor; use explicit logic or a real parser.' },
        { pattern: '\\bos\\.system\\s*\\(', flags: 'g', points: 15, label: 'os.system() call', fix: 'Use subprocess with an argument list (shell=False) and validated inputs.' },
        { pattern: 'shell\\s*=\\s*True', flags: 'g', points: 12, label: 'subprocess shell=True', fix: 'Set shell=False and pass arguments as a list to avoid shell injection.' },
        { pattern: '\\bsubprocess\\.(call|run|Popen)\\b', flags: 'g', points: 6, label: 'subprocess invocation', fix: 'Pass arguments as a list and never interpolate untrusted input into the command.' },
        { pattern: '\\bpickle\\.loads?\\s*\\(', flags: 'g', points: 15, label: 'unsafe pickle deserialization', fix: 'Do not unpickle untrusted data; use JSON or another safe serializer.' },
        { pattern: '\\byaml\\.load\\s*\\((?!.*Loader)', flags: 'g', points: 10, label: 'unsafe yaml.load', fix: 'Use yaml.safe_load() instead of yaml.load().' },
        { pattern: 'dangerouslySetInnerHTML', flags: 'g', points: 10, label: 'dangerouslySetInnerHTML', fix: 'Sanitize the HTML (e.g. DOMPurify) or render as text; never pass unsanitized user input.' },
        { pattern: '\\.innerHTML\\s*=', flags: 'g', points: 8, label: 'innerHTML assignment', fix: 'Use textContent, or sanitize the HTML before assigning it.' },
        { pattern: '\\bdocument\\.write\\s*\\(', flags: 'g', points: 8, label: 'document.write()', fix: 'Avoid document.write; build DOM nodes or use a templating library.' },
        { pattern: '(SELECT|INSERT|UPDATE|DELETE|DROP)\\b[^\'\"]*[\'\"]\\s*\\+', flags: 'gi', points: 12, label: 'SQL string concatenation', fix: 'Use parameterized queries / prepared statements instead of string concatenation.' },
        { pattern: '\\b(md5|sha1)\\s*\\(', flags: 'gi', points: 5, label: 'weak hash (md5/sha1)', fix: 'Use SHA-256+ for integrity; for passwords use bcrypt, scrypt, or argon2.' },
        { pattern: 'verify\\s*=\\s*False', flags: 'g', points: 12, label: 'TLS verification disabled', fix: 'Enable TLS verification; fix the certificate chain instead of disabling it.' },
        { pattern: 'rejectUnauthorized\\s*:\\s*false', flags: 'g', points: 12, label: 'TLS rejectUnauthorized:false', fix: 'Enable TLS verification; fix the certificate trust instead of disabling it.' },
      ],
    },
    smells: {
      enabled: true,
      cap: 5,
      patterns: [
        { pattern: '\\bcatch\\s*\\(\\s*\\w*\\s*\\)\\s*\\{\\s*\\}', flags: 'g', points: 8, label: 'empty catch block', fix: 'Handle or log the error; do not swallow exceptions silently.' },
        { pattern: '\\b(TODO|FIXME)\\b.*\\b(implement|handle|fix)\\b', flags: 'gi', points: 4, label: 'unresolved TODO/FIXME', fix: 'Resolve the TODO/FIXME or link a tracking issue before merging.' },
        { pattern: '\\b(data|temp|result|value|item|obj)\\d?\\s*=', flags: 'g', points: 1, label: 'generic placeholder var', fix: 'Give the variable a descriptive, intention-revealing name.' },
        { pattern: 'console\\.(log|debug)\\(', flags: 'g', points: 2, label: 'leftover console.log/debug', fix: 'Remove debug logging or switch to a proper logger.' },
        { pattern: '\\bany\\b\\s*[:)]', flags: 'g', points: 3, label: "TypeScript 'any' escape hatch", fix: "Replace 'any' with a specific type, or 'unknown' with explicit narrowing." },
      ],
    },
    removedTests: {
      enabled: true,
      cap: 5,
      keywordPattern: '\\b(it|test|describe|context|assert|expect|should)\\b',
      keywordFlags: 'i',
      pointsPerLine: 4,
      deletedFilePoints: 12,
      fix: 'Restore the removed tests, or justify their removal in the PR description.',
    },
    testRatio: {
      enabled: true,
      minSourceLines: 30,
      noTestPoints: 15,
      thinRatio: 0.15,
      thinPoints: 6,
      fix: 'Add tests covering the new code paths before merging.',
    },
    dependencyChanges: {
      enabled: true,
      manifestPattern: '(^|/)(package\\.json|package-lock\\.json|yarn\\.lock|pnpm-lock\\.yaml|requirements\\.txt|Pipfile(\\.lock)?|go\\.(mod|sum)|Gemfile(\\.lock)?|Cargo\\.(toml|lock)|composer\\.(json|lock))$',
      manifestFlags: 'i',
      points: 8,
      fix: 'Review the dependency change for supply-chain risk; verify the lockfile and the package provenance.',
    },
    diffSize: {
      enabled: true,
      largeThreshold: 400,
      largePoints: 12,
      mediumThreshold: 150,
      mediumPoints: 5,
      fix: 'Consider splitting this into smaller, independently reviewable commits or PRs.',
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
