# riskdiff

[![npm version](https://img.shields.io/npm/v/riskdiff.svg)](https://www.npmjs.com/package/riskdiff)
[![CI](https://github.com/therealruthvik/riskdiff/actions/workflows/test.yml/badge.svg)](https://github.com/therealruthvik/riskdiff/actions/workflows/test.yml)
[![license](https://img.shields.io/npm/l/riskdiff.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/riskdiff.svg)](https://nodejs.org)

Pre-commit risk scanner for git diffs. Flags risky changes before they hit a PR — no LLM, no API key, no backend, no signup.

```
riskdiff: HIGH (score: 73, files: 3)
Signals:
  • Touches payments path: src/stripe/checkout.js (+30)
      ↳ Require a second reviewer; verify amount validation and idempotency are tested.
  • src/auth/middleware.js: empty catch block x2 (+16)
      ↳ Handle or log the error; do not swallow exceptions silently.
  • 87 lines added across 3 source file(s), 0 test lines (+15)
      ↳ Add tests covering the new code paths before merging.
```

Every finding comes with a one-line fix instruction, so the report tells a
developer what to change — not just what is wrong. The fix shows inline in the
text report, as a "Suggested fix" column in `--markdown`, and in the SARIF
`help` text surfaced by GitHub code scanning.

## Why

Developers now spend more time reviewing AI-generated code than they do writing it. AI-generated pull requests jumped from roughly 1% to ~28% of all PRs in the past year. Single-model review tools have blind spots that only show up against a second pass — heuristics, a different model, or a human reviewer. `riskdiff` is that second pass: a local, zero-cost guardrail that catches common AI-code failure patterns before a risky commit ever reaches review.

It runs in milliseconds, works offline, and has no external dependencies.

## How it compares

| | riskdiff | CodeRabbit / Greptile / Cursor Bugbot |
| --- | --- | --- |
| Runs locally pre-commit | ✅ | ❌ (PR-time, cloud) |
| Needs an account / API key | ❌ | ✅ |
| Sends your code to a server | ❌ | ✅ |
| Cost | Free | Paid / per-seat |
| Speed | Milliseconds | Seconds to minutes |
| Semantic AI review | ❌ | ✅ |
| Secrets / dangerous-call detection | ✅ | ✅ |
| Configurable heuristics | ✅ | Partial |

riskdiff is not an AI reviewer and does not try to be one — it is the fast,
deterministic guardrail that runs *before* code ever reaches those tools.

## Install

```sh
npm install -g riskdiff
```

Requires Node.js ≥ 18.

## Usage

```sh
# Scan unstaged working-tree changes
riskdiff

# Scan staged changes (for pre-commit hook)
riskdiff --staged

# Scan against a branch or ref
riskdiff --against main
riskdiff --against HEAD~1

# Block on a lower threshold (default: high)
riskdiff --staged --fail-on medium

# Output JSON / SARIF / Markdown
riskdiff --staged --json
riskdiff --against main --sarif > riskdiff.sarif
riskdiff --against main --markdown

# Quiet (exit code only, ideal in hooks) or verbose
riskdiff --staged --quiet
riskdiff --staged --verbose

# Help
riskdiff --help
```

### Commands

| Command | Description |
| --- | --- |
| `riskdiff init` | Scaffold `.riskdiffrc.json` and install the pre-commit hook |
| `riskdiff baseline` | Record current signals to `.riskdiff-baseline.json` to grandfather them |

### Flags

| Flag | Description |
| --- | --- |
| `--staged` | Scan staged changes (`git diff --cached`) |
| `--against <ref>` | Scan against a ref (e.g. `main`, `HEAD~1`) |
| `--fail-on <level>` | Exit 1 at/above this level (`low`/`medium`/`high`, default `high`) |
| `--json` / `--sarif` / `--markdown` | Machine-readable output formats |
| `--quiet` / `--verbose` | Suppress the report / print the config source |
| `--no-color` / `--no-baseline` | Disable color / ignore the baseline file |

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Pass (or no changes to scan) |
| `1` | Risk meets or exceeds `--fail-on` threshold |
| `2` | Not in a git repo / `git diff` failed |

### Risk levels

| Level | Score |
|-------|-------|
| LOW | < 25 |
| MEDIUM | 25 – 49 |
| HIGH | ≥ 50 |

## Pre-commit hook

The fastest setup is `riskdiff init`, which writes a starter config and installs
the hook for you:

```sh
riskdiff init
```

### Manual git hook

Add to `.git/hooks/pre-commit`:

```sh
echo 'riskdiff --staged --fail-on high || exit 1' >> .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

Or write it yourself:

```sh
#!/bin/sh
riskdiff --staged --fail-on high || exit 1
```

### pre-commit framework

If you use [pre-commit](https://pre-commit.com), add this to your
`.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/therealruthvik/riskdiff
    rev: v0.2.0
    hooks:
      - id: riskdiff
```

Then `pre-commit install`. The hook runs `riskdiff --staged --fail-on high` on
every commit.

## GitHub Action

Run riskdiff on pull requests to block risky changes before merge:

```yaml
# .github/workflows/riskdiff.yml
name: riskdiff
on: pull_request
jobs:
  riskdiff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # needed so riskdiff can diff against the base branch
      - uses: therealruthvik/riskdiff@v0.2.0
        with:
          fail-on: high    # low | medium | high
```

On a `pull_request` the action diffs against the PR base branch automatically.
Inputs: `fail-on` (default `high`), `against` (override the ref), `version`
(npm version/tag, default `latest`), `args` (extra CLI flags, e.g. `--json`).

## Configuration

riskdiff reads `.riskdiffrc.json`, `.riskdiffrc`, or a `"riskdiff"` key in
`package.json`. Every weight, threshold, and pattern is overridable. Example:

```json
{
  "failOn": "high",
  "thresholds": { "medium": 25, "high": 50 },
  "ignorePaths": ["dist/**", "build/**", "*.min.js"],
  "rules": {
    "diffSize": { "enabled": false }
  },
  "customRules": [
    { "name": "no-fixme", "pattern": "FIXME", "flags": "g", "points": 5, "label": "FIXME left in code" }
  ]
}
```

### Suppressing false positives

- Inline: add `riskdiff-ignore` on a line to skip it, or `riskdiff-disable-file`
  anywhere in a file to skip the whole file.
- Baseline: run `riskdiff baseline` to record existing signals to
  `.riskdiff-baseline.json`; they are subtracted from future runs until removed.

## SARIF / GitHub code scanning

`--sarif` emits a SARIF 2.1.0 log you can upload to GitHub so findings show up in
the repository's Security tab:

```sh
riskdiff --against origin/main --sarif > riskdiff.sarif
```

In a workflow, pair it with `github/codeql-action/upload-sarif`. Secrets and
dangerous calls map to `error`, sensitive paths and removed tests to `warning`,
everything else to `note`.

## What it checks

**Sensitive paths** — detects changes to auth, payments, config/secrets, database migrations, and access-control code. Each pattern adds weighted points.

**AI code smells** — scans added lines for patterns common in AI-generated code: empty catch blocks, unresolved TODO/FIXME stubs, generic placeholder variable names (`data`, `result`, `temp`…), leftover `console.log` calls, and TypeScript `any` escape hatches. Each pattern is capped at 5 occurrences per file so a single noisy file can't dominate the score.

**Test ratio** — if ≥ 30 source lines are added with zero test lines, it flags the commit. Thin coverage (< 15% of source lines) also adds points.

**Diff size** — large diffs (> 150 lines) carry a small penalty. Very large diffs (> 400 lines) carry a larger one.

## JSON output

```sh
riskdiff --staged --json
```

```json
{
  "score": 36,
  "level": "MEDIUM",
  "fileCount": 1,
  "reasons": [
    "Touches auth path: src/auth/login.js (+25)",
    "src/auth/login.js: empty catch block x1 (+8)",
    "src/auth/login.js: generic placeholder var x1 (+1)",
    "src/auth/login.js: leftover console.log/debug x1 (+2)"
  ]
}
```

## License

MIT
