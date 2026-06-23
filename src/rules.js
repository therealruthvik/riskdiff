import { DEFAULT_CONFIG } from './config.js';

const TEST_FILE_RE = /(\.test\.|\.spec\.|__tests__|\/test\/|\/tests\/)/i;
const SOURCE_FILE_RE = /\.(js|ts|jsx|tsx|py|go|rb|java)$/i;

/** SARIF severity per rule id. */
export const RULE_SEVERITY = {
  secrets: 'error',
  dangerousCalls: 'error',
  sensitivePaths: 'warning',
  removedTests: 'warning',
  smells: 'note',
  testRatio: 'note',
  dependencyChanges: 'note',
  diffSize: 'note',
  custom: 'note',
};

/** Build one structured signal. `path` may be null for repo-level findings. */
function signal(ruleId, path, points, reason, remediation = '') {
  return {
    ruleId,
    path: path ?? null,
    points,
    reason,
    remediation,
    severity: RULE_SEVERITY[ruleId] || 'note',
  };
}

/** Build a RegExp from a {pattern, flags} spec, forcing the global flag. */
function buildRegex(spec) {
  const flags = spec.flags || '';
  return new RegExp(spec.pattern, flags.includes('g') ? flags : flags + 'g');
}

/** Convert a glob-ish ignore pattern to a RegExp. Supports ** and *. */
function globToRegex(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, ' ') // placeholder for **
    .replace(/\*/g, '[^/]*')
    .replace(/ /g, '.*');
  return new RegExp('^' + escaped + '$');
}

/** Drop files whose path matches any ignorePaths glob. */
export function applyIgnorePaths(files, config = DEFAULT_CONFIG) {
  const globs = config.ignorePaths || [];
  if (globs.length === 0) return files;
  const regexes = globs.map(globToRegex);
  return files.filter((f) => !regexes.some((re) => re.test(f.path)));
}

export function checkSensitivePaths(files, config = DEFAULT_CONFIG) {
  const rule = config.rules.sensitivePaths;
  if (!rule || rule.enabled === false) return empty();

  let points = 0;
  const signals = [];
  for (const file of files) {
    for (const spec of rule.patterns) {
      const re = new RegExp(spec.pattern, spec.flags || '');
      if (re.test(file.path)) {
        points += spec.points;
        signals.push(signal('sensitivePaths', file.path, spec.points,
          `Touches ${spec.label} path: ${file.path} (+${spec.points})`, spec.fix));
      }
    }
  }
  return withReasons(points, signals);
}

/**
 * Generic scanner for rules that match regex patterns against added lines,
 * cap occurrences per file, and score points per match.
 */
function scanLinePatterns(files, rule, ruleId, render) {
  if (!rule || rule.enabled === false) return empty();
  const cap = rule.cap ?? Infinity;
  let points = 0;
  const signals = [];
  for (const file of files) {
    for (const spec of rule.patterns) {
      let count = 0;
      for (const line of file.addedLines) {
        const re = buildRegex(spec);
        count += (line.match(re) || []).length;
      }
      const capped = Math.min(count, cap);
      if (capped > 0) {
        const pts = capped * spec.points;
        points += pts;
        signals.push(signal(ruleId, file.path, pts, render(file, spec, capped, pts), spec.fix));
      }
    }
  }
  return withReasons(points, signals);
}

export function checkSecrets(files, config = DEFAULT_CONFIG) {
  return scanLinePatterns(files, config.rules.secrets, 'secrets', (f, s, c, p) =>
    `${f.path}: possible ${s.label} x${c} (+${p})`
  );
}

export function checkDangerousCalls(files, config = DEFAULT_CONFIG) {
  return scanLinePatterns(files, config.rules.dangerousCalls, 'dangerousCalls', (f, s, c, p) =>
    `${f.path}: ${s.label} x${c} (+${p})`
  );
}

export function checkSmells(files, config = DEFAULT_CONFIG) {
  return scanLinePatterns(files, config.rules.smells, 'smells', (f, s, c, p) =>
    `${f.path}: ${s.label} x${c} (+${p})`
  );
}

export function checkRemovedTests(files, config = DEFAULT_CONFIG) {
  const rule = config.rules.removedTests;
  if (!rule || rule.enabled === false) return empty();

  const cap = rule.cap ?? 5;
  const keywordRe = new RegExp(rule.keywordPattern, rule.keywordFlags || 'i');
  let points = 0;
  const signals = [];

  for (const file of files) {
    if (!TEST_FILE_RE.test(file.path)) continue;

    if (file.status === 'deleted') {
      points += rule.deletedFilePoints;
      signals.push(signal('removedTests', file.path, rule.deletedFilePoints,
        `Test file deleted: ${file.path} (+${rule.deletedFilePoints})`, rule.fix));
      continue;
    }

    const removed = file.removedLines.filter((l) => keywordRe.test(l)).length;
    const added = file.addedLines.filter((l) => keywordRe.test(l)).length;
    // Only flag a net loss of test/assertion lines (refactors that move lines
    // around add roughly as many as they remove and shouldn't trip this).
    const net = removed - added;
    if (net > 0) {
      const capped = Math.min(net, cap);
      const pts = capped * rule.pointsPerLine;
      points += pts;
      signals.push(signal('removedTests', file.path, pts,
        `${file.path}: ${capped} test/assertion line(s) removed (+${pts})`, rule.fix));
    }
  }
  return withReasons(points, signals);
}

export function checkTestRatio(files, config = DEFAULT_CONFIG) {
  const rule = config.rules.testRatio;
  if (!rule || rule.enabled === false) return empty();

  let testLines = 0;
  let sourceLines = 0;
  let sourceFileCount = 0;

  for (const file of files) {
    if (TEST_FILE_RE.test(file.path)) {
      testLines += file.addedLines.length;
    } else if (SOURCE_FILE_RE.test(file.path)) {
      sourceLines += file.addedLines.length;
      sourceFileCount++;
    }
  }

  if (sourceLines >= rule.minSourceLines && testLines === 0) {
    return withReasons(rule.noTestPoints, [signal('testRatio', null, rule.noTestPoints,
      `${sourceLines} lines added across ${sourceFileCount} source file(s), 0 test lines (+${rule.noTestPoints})`, rule.fix)]);
  }
  if (testLines > 0 && testLines < sourceLines * rule.thinRatio) {
    return withReasons(rule.thinPoints, [signal('testRatio', null, rule.thinPoints,
      `Test coverage thin: ${testLines} test lines vs ${sourceLines} source lines (+${rule.thinPoints})`, rule.fix)]);
  }
  return empty();
}

export function checkDependencyChanges(files, config = DEFAULT_CONFIG) {
  const rule = config.rules.dependencyChanges;
  if (!rule || rule.enabled === false) return empty();

  const re = new RegExp(rule.manifestPattern, rule.manifestFlags || 'i');
  let points = 0;
  const signals = [];
  for (const file of files) {
    if (re.test(file.path) && file.addedLines.length > 0) {
      points += rule.points;
      signals.push(signal('dependencyChanges', file.path, rule.points,
        `Dependency manifest changed: ${file.path} (+${rule.points})`, rule.fix));
    }
  }
  return withReasons(points, signals);
}

export function checkDiffSize(files, config = DEFAULT_CONFIG) {
  const rule = config.rules.diffSize;
  if (!rule || rule.enabled === false) return empty();

  const total = files.reduce((sum, f) => sum + f.addedLines.length, 0);
  if (total > rule.largeThreshold) {
    return withReasons(rule.largePoints, [signal('diffSize', null, rule.largePoints,
      `Large diff: ${total} lines added (+${rule.largePoints})`, rule.fix)]);
  }
  if (total > rule.mediumThreshold) {
    return withReasons(rule.mediumPoints, [signal('diffSize', null, rule.mediumPoints,
      `Medium diff: ${total} lines added (+${rule.mediumPoints})`, rule.fix)]);
  }
  return empty();
}

/** Run user-defined regex rules from config.customRules. */
export function checkCustomRules(files, config = DEFAULT_CONFIG) {
  const rules = config.customRules || [];
  if (rules.length === 0) return empty();

  let points = 0;
  const signals = [];
  for (const spec of rules) {
    const addedOnly = spec.addedOnly !== false; // default true
    for (const file of files) {
      const lines = addedOnly ? file.addedLines : [...file.addedLines, ...file.removedLines];
      let count = 0;
      for (const line of lines) {
        const re = buildRegex(spec);
        count += (re.global ? (line.match(re) || []).length : re.test(line) ? 1 : 0);
      }
      if (count > 0) {
        const pts = count * spec.points;
        points += pts;
        signals.push(signal('custom', file.path, pts,
          `${file.path}: ${spec.label || spec.name} x${count} (+${pts})`, spec.fix || ''));
      }
    }
  }
  return withReasons(points, signals);
}

/** Empty rule result. */
function empty() {
  return { points: 0, reasons: [], signals: [] };
}

/** Attach a derived `reasons` array (back-compat) to a set of signals. */
function withReasons(points, signals) {
  return { points, reasons: signals.map((s) => s.reason), signals };
}

export const RULES = [
  checkSecrets,
  checkDangerousCalls,
  checkSensitivePaths,
  checkSmells,
  checkRemovedTests,
  checkTestRatio,
  checkDependencyChanges,
  checkDiffSize,
  checkCustomRules,
];
