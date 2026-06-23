# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [0.4.0] - 2026-06-23

### Changed
- Calibrated defaults so the first run on a real repo is credible, not noisy
  (cut roughly 60% of signals on test repos): default ignorePaths for generated/
  vendored/minified/lockfile/example files, dropped the noisy generic-var smell,
  placeholder/env-reference filtering for hardcoded credentials, and
  method-call-aware eval()/md5()/sha1() patterns. Improved glob matching so a
  leading `**/` also matches the repo root.

### Added
- `--no-fail` flag for report-only runs (always exits 0).
- Quickstart and husky/lefthook/lint-staged recipes in the README; SECURITY.md;
  no-network/no-telemetry guarantee and trust badges; launch kit under docs/.

## [0.3.0] - 2026-06-23

### Added
- Remediation guidance: every signal now carries a `remediation` string telling
  the developer what to change. Shown inline under each finding in the text
  report, as a "Suggested fix" column in Markdown, and embedded in SARIF result
  messages and rule `help` so it surfaces in GitHub code scanning.

## [0.2.1] - 2026-06-23

### Added
- `-v` / `--version` flag prints the riskdiff version.

## [0.2.0] - 2026-06-23

### Added
- Config system: `.riskdiffrc.json` / `.riskdiffrc` / `package.json` key, with
  overridable weights and thresholds, `ignorePaths`, custom regex rules, and
  per-rule enable/disable.
- Suppression: inline `riskdiff-ignore` / `riskdiff-disable-file` comments and a
  `.riskdiff-baseline.json` baseline (`riskdiff baseline` command).
- `riskdiff init` to scaffold config and install the pre-commit hook.
- Secrets detection rule (private keys, AWS/GitHub/Slack/Google/Stripe tokens,
  JWTs, hardcoded credentials).
- Dangerous-call detection rule (eval, os.system/shell=True, unsafe
  deserialization, XSS sinks, SQL string concatenation, weak hashes, disabled
  TLS verification).
- Removed-test detection and dependency-manifest change detection.
- Structured signals with per-finding severity.
- `--sarif` output for GitHub code scanning and `--markdown` output for PR
  comments.
- `pre-commit` framework hook (`.pre-commit-hooks.yaml`) and a composite GitHub
  Action (`action.yml`).
- TypeScript declarations (`src/index.d.ts`) and `--quiet` / `--verbose` flags.
- CI coverage gate.

### Changed
- Hardened the diff parser for renames, deletions, multiple hunks, `\ No newline`
  markers, and binary/mode-change headers.

## [0.1.0] - 2026-06-23

### Added
- Initial release: diff parser, four heuristic rules (sensitive paths, AI code
  smells, test ratio, diff size), score-to-level mapping, CLI with `--staged`,
  `--against`, `--fail-on`, `--json`, and the git pre-commit hook snippet.
