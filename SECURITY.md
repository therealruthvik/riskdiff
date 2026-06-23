# Security Policy

## Design guarantees

riskdiff is built to be safe to run on any codebase:

- **No network access.** riskdiff never makes network requests. It reads your
  git diff locally and exits.
- **No telemetry.** It collects and transmits nothing.
- **No runtime dependencies.** The published package has zero dependencies, so
  there is no transitive supply-chain surface.
- **Read-only by default.** Scanning only reads the diff. The only commands that
  write to disk are `riskdiff init` (creates a config and hook) and
  `riskdiff baseline` (writes `.riskdiff-baseline.json`).

You can verify this: the entire source is plain ESM under `src/`, and
`npm view riskdiff dependencies` returns nothing.

## Reporting a vulnerability

If you find a security issue in riskdiff itself, please open a private report via
GitHub Security Advisories on the repository, or open an issue describing the
problem without including any real secret values.

We aim to acknowledge reports within a few days.

## Scope

riskdiff is a heuristic scanner. It reduces risk but is not a guarantee: it can
produce false positives and false negatives. Do not rely on it as your only
control for secrets or vulnerabilities — pair it with dedicated tools
(e.g. gitleaks/TruffleHog for secrets) in CI.
