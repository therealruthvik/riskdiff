# Contributing to riskdiff

Thanks for your interest in improving riskdiff.

## Principles

- **Zero runtime dependencies.** riskdiff must stay installable, fast, and
  offline. Don't add packages to `dependencies`.
- **Deterministic.** No network calls, no LLMs, no non-determinism. Same diff in,
  same score out.
- **Node 18+.** Use only APIs available on Node 18 and the built-in test runner.

## Development

```sh
git clone https://github.com/therealruthvik/riskdiff
cd riskdiff
npm test          # run the test suite
npm run coverage  # run tests with coverage thresholds
```

There is no build step — the package ships plain ESM under `src/`.

## Adding or changing a rule

1. Add the rule's tunable values to `DEFAULT_CONFIG` in `src/config.js` so they
   are configurable and disablable.
2. Implement the rule in `src/rules.js`. It must return
   `{ points, reasons, signals }`; use the `signal()` and `withReasons()`
   helpers so SARIF and Markdown output stay consistent.
3. Add it to the `RULES` array.
4. Write tests asserting the exact point math, the cap (if any), the disable
   path, and at least one no-false-positive case.

When you change scoring, update the affected tests in the same change — tests
assert exact numbers on purpose.

## Pull requests

- Keep commits focused and messages plain and descriptive.
- `npm test` must pass; coverage thresholds must hold.
- New behavior needs tests and a README/CHANGELOG note.

## Releases

Versioning follows semver. Bump with `npm version <patch|minor|major>` (never
hand-edit the version field), then `git push --follow-tags` and `npm publish`.
