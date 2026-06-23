import { RULES, applyIgnorePaths } from './rules.js';
import { applySuppressions, applyBaseline } from './suppress.js';
import { DEFAULT_CONFIG } from './config.js';

// Backwards-compatible static thresholds (default config values).
export const THRESHOLDS = { LOW: 0, MEDIUM: 25, HIGH: 50 };

/**
 * @param {Array} files parsed diff files
 * @param {object} config resolved config
 * @param {object} [opts]
 * @param {Set<string>} [opts.baseline] fingerprints to suppress
 */
export function scoreDiff(files, config = DEFAULT_CONFIG, opts = {}) {
  const scanned = applySuppressions(applyIgnorePaths(files, config));

  let score = 0;
  let reasons = [];
  for (const rule of RULES) {
    const result = rule(scanned, config);
    score += result.points;
    reasons.push(...result.reasons);
  }

  let suppressedCount = 0;
  if (opts.baseline) {
    const filtered = applyBaseline(score, reasons, opts.baseline);
    score = filtered.score;
    reasons = filtered.reasons;
    suppressedCount = filtered.suppressedCount;
  }

  const { medium, high } = config.thresholds;
  const level = score >= high ? 'HIGH' : score >= medium ? 'MEDIUM' : 'LOW';

  return { score, level, reasons, fileCount: scanned.length, suppressedCount };
}
