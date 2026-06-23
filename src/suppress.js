import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const INLINE_IGNORE = /riskdiff-ignore/;
const FILE_DISABLE = /riskdiff-disable-file/;

/**
 * Apply inline suppressions before scoring:
 *   - any added line containing `riskdiff-disable-file` removes the whole file
 *   - any added line containing `riskdiff-ignore` is dropped from added lines
 *     (so line-based rules — smells, custom — never see it)
 * Path-based rules naturally still apply to surviving files.
 */
export function applySuppressions(files) {
  const out = [];
  for (const file of files) {
    if (file.addedLines.some((l) => FILE_DISABLE.test(l))) continue;
    const addedLines = file.addedLines.filter((l) => !INLINE_IGNORE.test(l));
    out.push({ ...file, addedLines });
  }
  return out;
}

export const BASELINE_FILENAME = '.riskdiff-baseline.json';

/** Stable fingerprint for a reason string: strip the trailing " (+N)" suffix. */
export function fingerprintReason(reason) {
  return reason.replace(/\s*\(\+\d+\)\s*$/, '').trim();
}

/** Parse the "(+N)" point value out of a reason string. */
export function pointsFromReason(reason) {
  const m = reason.match(/\(\+(\d+)\)\s*$/);
  return m ? Number(m[1]) : 0;
}

/**
 * Load a baseline file. Shape: { reasons: string[] } or string[].
 * Returns a Set of fingerprints to suppress.
 */
export function loadBaseline(cwd = process.cwd()) {
  const path = join(cwd, BASELINE_FILENAME);
  if (!existsSync(path)) return new Set();
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(`riskdiff: failed to parse ${BASELINE_FILENAME}: ${err.message}`);
  }
  const list = Array.isArray(parsed) ? parsed : parsed.reasons || [];
  return new Set(list.map(fingerprintReason));
}

/**
 * Filter baselined reasons out of a scored result and subtract their points.
 * @returns {{ score, reasons, suppressedCount }}
 */
export function applyBaseline(score, reasons, baselineSet) {
  if (!baselineSet || baselineSet.size === 0) {
    return { score, reasons, suppressedCount: 0 };
  }
  let newScore = score;
  let suppressedCount = 0;
  const kept = [];
  for (const reason of reasons) {
    if (baselineSet.has(fingerprintReason(reason))) {
      newScore -= pointsFromReason(reason);
      suppressedCount++;
    } else {
      kept.push(reason);
    }
  }
  return { score: Math.max(0, newScore), reasons: kept, suppressedCount };
}
