# riskdiff

Pre-commit risk scanner for git diffs. Flags risky changes before they hit a PR — no LLM, no API key, no backend, no signup.

```
riskdiff: HIGH (score: 73, files: 3)
Signals:
  • Touches auth path: src/auth/middleware.js (+25)
  • Touches payments path: src/stripe/checkout.js (+30)
  • src/auth/middleware.js: empty catch block x2 (+16)
  • 87 lines added across 3 source file(s), 0 test lines (+15)
```

## Why

Developers now spend more time reviewing AI-generated code than they do writing it. AI-generated pull requests jumped from roughly 1% to ~28% of all PRs in the past year. Single-model review tools have blind spots that only show up against a second pass — heuristics, a different model, or a human reviewer. `riskdiff` is that second pass: a local, zero-cost guardrail that catches common AI-code failure patterns before a risky commit ever reaches review.

It runs in milliseconds, works offline, and has no external dependencies.

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

# Output JSON (for scripting or CI)
riskdiff --staged --json

# Help
riskdiff --help
```

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
