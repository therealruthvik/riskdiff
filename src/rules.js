const SENSITIVE_PATHS = [
  { pattern: /\/auth\//i, points: 25, label: 'auth' },
  { pattern: /(payment|billing|stripe|checkout)/i, points: 30, label: 'payments' },
  { pattern: /(secret|credential|\.env|config\/.*\.(yml|yaml|json))/i, points: 20, label: 'config/secrets' },
  { pattern: /(migration|schema)/i, points: 15, label: 'db schema/migration' },
  { pattern: /(middleware|permission|acl|rbac)/i, points: 20, label: 'access control' },
];

const SMELLS = [
  {
    pattern: /\bcatch\s*\(\s*\w*\s*\)\s*\{\s*\}/g,
    points: 8,
    label: 'empty catch block',
  },
  {
    pattern: /\b(TODO|FIXME)\b.*\b(implement|handle|fix)\b/gi,
    points: 4,
    label: 'unresolved TODO/FIXME',
  },
  {
    pattern: /\b(data|temp|result|value|item|obj)\d?\s*=/g,
    points: 1,
    label: 'generic placeholder var',
  },
  {
    pattern: /console\.(log|debug)\(/g,
    points: 2,
    label: 'leftover console.log/debug',
  },
  {
    pattern: /\bany\b\s*[:)]/g,
    points: 3,
    label: "TypeScript 'any' escape hatch",
  },
];

const TEST_FILE_RE = /(\.test\.|\.spec\.|__tests__|\/test\/|\/tests\/)/i;
const SOURCE_FILE_RE = /\.(js|ts|jsx|tsx|py|go|rb|java)$/i;

function countMatches(text, pattern) {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  return (text.match(re) || []).length;
}

export function checkSensitivePaths(files) {
  let points = 0;
  const reasons = [];
  for (const file of files) {
    for (const { pattern, points: pts, label } of SENSITIVE_PATHS) {
      if (pattern.test(file.path)) {
        points += pts;
        reasons.push(`Touches ${label} path: ${file.path} (+${pts})`);
      }
    }
  }
  return { points, reasons };
}

export function checkSmells(files) {
  let points = 0;
  const reasons = [];
  for (const file of files) {
    const text = file.addedLines.join('\n');
    for (const smell of SMELLS) {
      let count = 0;
      for (const line of file.addedLines) {
        const re = new RegExp(smell.pattern.source, smell.pattern.flags.includes('g') ? smell.pattern.flags : smell.pattern.flags + 'g');
        count += (line.match(re) || []).length;
      }
      const capped = Math.min(count, 5);
      if (capped > 0) {
        const pts = capped * smell.points;
        points += pts;
        reasons.push(`${file.path}: ${smell.label} x${capped} (+${pts})`);
      }
    }
  }
  return { points, reasons };
}

export function checkTestRatio(files) {
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

  if (sourceLines >= 30 && testLines === 0) {
    return {
      points: 15,
      reasons: [`${sourceLines} lines added across ${sourceFileCount} source file(s), 0 test lines (+15)`],
    };
  }
  if (testLines > 0 && testLines < sourceLines * 0.15) {
    return {
      points: 6,
      reasons: [`Test coverage thin: ${testLines} test lines vs ${sourceLines} source lines (+6)`],
    };
  }
  return { points: 0, reasons: [] };
}

export function checkDiffSize(files) {
  const total = files.reduce((sum, f) => sum + f.addedLines.length, 0);
  if (total > 400) return { points: 12, reasons: [`Large diff: ${total} lines added (+12)`] };
  if (total > 150) return { points: 5, reasons: [`Medium diff: ${total} lines added (+5)`] };
  return { points: 0, reasons: [] };
}

export const RULES = [checkSensitivePaths, checkSmells, checkTestRatio, checkDiffSize];
