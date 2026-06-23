import { RULES, applyIgnorePaths } from './rules.js';
import { DEFAULT_CONFIG } from './config.js';

// Backwards-compatible static thresholds (default config values).
export const THRESHOLDS = { LOW: 0, MEDIUM: 25, HIGH: 50 };

export function scoreDiff(files, config = DEFAULT_CONFIG) {
  const scanned = applyIgnorePaths(files, config);

  let score = 0;
  const reasons = [];
  for (const rule of RULES) {
    const result = rule(scanned, config);
    score += result.points;
    reasons.push(...result.reasons);
  }

  const { medium, high } = config.thresholds;
  const level = score >= high ? 'HIGH' : score >= medium ? 'MEDIUM' : 'LOW';

  return { score, level, reasons, fileCount: scanned.length };
}
