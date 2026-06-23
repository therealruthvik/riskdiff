# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

`riskdiff` — a pre-commit risk scanner for git diffs, published as an npm CLI package. It scans `git diff` output and scores risk using static heuristics, then blocks or warns before a risky commit goes out.

The differentiator: **no LLM calls, no API key, no backend, no signup** — pure static heuristic scoring. This is the line versus PR-bot tools (CodeRabbit / Greptile / Cursor Bugbot), which all require backend integration. It targets the "AI generates code faster than humans can review it" gap as a local, zero-cost guardrail that runs before code reaches a PR.

Keep all future work offline-first: **no network dependencies, no runtime dependencies.** Node 18+, ESM only.

## Commands

```sh
npm test                 # run all tests (node --test 'test/*.test.js')
node bin/riskdiff.js     # run the CLI locally against the working-tree diff
```

CLI flags: `--staged`, `--against <ref>`, `--fail-on <low|medium|high>` (default high), `--json`, `--help`/`-h`.
Exit codes: `0` pass/no changes, `1` blocked by `--fail-on`, `2` not a git repo / git diff failed.

## Architecture

Data flows: raw diff text → `parseDiff` → file objects → `scoreDiff` (runs all `RULES`) → report → `formatReport`.

- `src/parseDiff.js` — `parseDiff(rawDiffText)` → `Array<{ path, addedLines, removedLines }>`. Reads path from `+++ b/X` (strips `b/`), collects `+`/`-` lines (not `+++`/`---`), strips leading char. Filters entries with no resolved path (binary headers).
- `src/rules.js` — exports `RULES`, an array of 4 functions, each `(files) => { points, reasons }`:
  1. `checkSensitivePaths` — path regex → weighted points (auth +25, payments +30, config/secrets +20, migration/schema +15, access-control +20). One file can match multiple patterns; all apply.
  2. `checkSmells` — regex on **added lines only**, each match type **capped at 5 per file** (empty catch +8, TODO/FIXME-near-implement/handle/fix +4, generic var +1, console.log/debug +2, TS `any` +3).
  3. `checkTestRatio` — test files vs source files. ≥30 source added lines + 0 test lines → +15; else test lines > 0 but < 15% of source → +6.
  4. `checkDiffSize` — total added lines: >400 → +12, >150 → +5.
- `src/score.js` — `THRESHOLDS = { LOW: 0, MEDIUM: 25, HIGH: 50 }`; `scoreDiff(files)` → `{ score, level, reasons, fileCount }`. Level: HIGH if ≥50, MEDIUM if ≥25, else LOW.
- `src/index.js` — `getDiffText({ staged, against })` (shells `git diff` via execSync, 20MB maxBuffer, throws with the command on failure), `analyze(diffText)`, `formatReport(report)` (ANSI: green LOW / yellow MEDIUM / red HIGH), re-exports `THRESHOLDS`.
- `bin/riskdiff.js` — CLI entry. Empty/whitespace diff → "no changes to scan" (or zero-score JSON) and exit 0 without analysis.
- `test/` — `node:test` + `node:assert/strict`. `parseDiff.test.js`, `rules.test.js`, `score.test.js`.

When changing scoring, update the affected `test/*.test.js` assertions in the same change — tests assert exact point math.

## Hard rules (entire project, every commit, forever)

- **Never** add `Co-Authored-By: Claude` or any AI-attribution line/footer to any commit message.
- **Never** hand-edit the `version` field in `package.json` — always `npm version <patch|minor|major>` so the git tag and version stay in sync.
- Keep commit messages and README in plain, direct, human style — no AI tone, no overselling, no emoji-heavy formatting.

## Versioning

0.1.0 is the MVP baseline. `patch` = bug fix, no API change. `minor` = new backwards-compatible feature (new rule/flag). `major` = breaking change (removed flag, changed score math, changed output shape).
