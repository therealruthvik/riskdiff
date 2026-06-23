import { RULES, applyIgnorePaths } from './rules.js';
import { applySuppressions, fingerprintReason } from './suppress.js';
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

  let signals = [];
  for (const rule of RULES) {
    signals.push(...rule(scanned, config).signals);
  }

  let suppressedCount = 0;
  if (opts.baseline && opts.baseline.size > 0) {
    const before = signals.length;
    signals = signals.filter((s) => !opts.baseline.has(fingerprintReason(s.reason)));
    suppressedCount = before - signals.length;
  }

  const score = signals.reduce((sum, s) => sum + s.points, 0);
  const reasons = signals.map((s) => s.reason);

  const { medium, high } = config.thresholds;
  const level = score >= high ? 'HIGH' : score >= medium ? 'MEDIUM' : 'LOW';

  return { score, level, reasons, signals, fileCount: scanned.length, suppressedCount };
}
