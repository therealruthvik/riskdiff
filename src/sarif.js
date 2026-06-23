import { RULE_SEVERITY } from './rules.js';

const RULE_NAMES = {
  secrets: 'Hardcoded secret',
  dangerousCalls: 'Dangerous call',
  sensitivePaths: 'Sensitive path touched',
  smells: 'AI code smell',
  removedTests: 'Test removed',
  testRatio: 'Insufficient tests',
  dependencyChanges: 'Dependency manifest changed',
  diffSize: 'Large diff',
  custom: 'Custom rule',
};

const INFO_URI = 'https://github.com/therealruthvik/riskdiff';

/**
 * Convert a riskdiff report into a SARIF 2.1.0 log for GitHub code scanning.
 * Findings without a file path (repo-level, e.g. diff size) are emitted as
 * results without a physical location, which is valid SARIF.
 *
 * @param {object} report result of analyze()/scoreDiff()
 * @param {object} [opts] { version }
 */
export function toSarif(report, opts = {}) {
  const signals = report.signals || [];

  // Collect the distinct rules that actually fired, in stable order.
  const seen = new Map();
  const rules = [];
  for (const s of signals) {
    if (seen.has(s.ruleId)) continue;
    seen.set(s.ruleId, true);
    const rule = {
      id: s.ruleId,
      name: RULE_NAMES[s.ruleId] || s.ruleId,
      shortDescription: { text: RULE_NAMES[s.ruleId] || s.ruleId },
      defaultConfiguration: { level: RULE_SEVERITY[s.ruleId] || 'note' },
    };
    if (s.remediation) rule.help = { text: s.remediation };
    rules.push(rule);
  }

  const results = signals.map((s) => {
    const message = s.remediation ? `${s.reason}\nFix: ${s.remediation}` : s.reason;
    const result = {
      ruleId: s.ruleId,
      level: s.severity || RULE_SEVERITY[s.ruleId] || 'note',
      message: { text: message },
    };
    if (s.path) {
      result.locations = [
        {
          physicalLocation: {
            artifactLocation: { uri: s.path },
            region: { startLine: s.line && s.line > 0 ? s.line : 1 },
          },
        },
      ];
    }
    return result;
  });

  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'riskdiff',
            informationUri: INFO_URI,
            version: opts.version || '0.0.0',
            rules,
          },
        },
        results,
      },
    ],
  };
}
