export type Level = 'LOW' | 'MEDIUM' | 'HIGH';
export type Severity = 'error' | 'warning' | 'note';

export interface DiffFile {
  path: string;
  addedLines: string[];
  removedLines: string[];
  status: 'added' | 'modified' | 'deleted' | 'renamed';
}

export interface Signal {
  ruleId: string;
  path: string | null;
  points: number;
  reason: string;
  severity: Severity;
}

export interface Report {
  score: number;
  level: Level;
  reasons: string[];
  signals: Signal[];
  fileCount: number;
  suppressedCount?: number;
}

export interface PatternSpec {
  pattern: string;
  flags?: string;
  points: number;
  label: string;
}

export interface Config {
  thresholds: { medium: number; high: number };
  failOn: 'low' | 'medium' | 'high';
  ignorePaths: string[];
  rules: Record<string, any>;
  customRules: Array<{
    name: string;
    pattern: string;
    flags?: string;
    points: number;
    label?: string;
    addedOnly?: boolean;
  }>;
}

export const THRESHOLDS: { LOW: number; MEDIUM: number; HIGH: number };
export const DEFAULT_CONFIG: Config;

export function getDiffText(opts?: { staged?: boolean; against?: string | null }): string;
export function analyze(diffText: string, config?: Config, opts?: { baseline?: Set<string> }): Report;
export function formatReport(report: Report, opts?: { color?: boolean }): string;

export function loadConfig(cwd?: string): { config: Config; source: string | null };
export function resolveConfig(partial: Partial<Config>): Config;
export function loadBaseline(cwd?: string): Set<string>;

export function toSarif(report: Pick<Report, 'signals'>, opts?: { version?: string }): object;
export function toMarkdown(report: Report): string;
