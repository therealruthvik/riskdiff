import { RULES } from './rules.js';

export const THRESHOLDS = { LOW: 0, MEDIUM: 25, HIGH: 50 };

export function scoreDiff(files) {
  let score = 0;
  const reasons = [];

  for (const rule of RULES) {
    const result = rule(files);
    score += result.points;
    reasons.push(...result.reasons);
  }

  const level = score >= THRESHOLDS.HIGH ? 'HIGH' : score >= THRESHOLDS.MEDIUM ? 'MEDIUM' : 'LOW';

  return { score, level, reasons, fileCount: files.length };
}
