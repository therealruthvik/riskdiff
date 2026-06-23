# Launch kit

Copy-paste assets and steps for getting riskdiff in front of developers. These
are manual steps — most require your accounts/auth.

## 1. Publish the GitHub Action to the Marketplace

The action (`action.yml`) is already valid and branded. To list it:

1. Push a release tag (done automatically by `npm version` → `git push --follow-tags`).
2. On GitHub: open the release for the tag (e.g. `v0.4.0`).
3. Check **"Publish this Action to the GitHub Marketplace"**, accept the terms,
   pick a primary + secondary category (suggested: *Code quality*, *Security*).
4. Save. The action then appears at
   `https://github.com/marketplace/actions/riskdiff`.

Requirements GitHub enforces: the repo must be public, have a `README.md`, and
the `action.yml` must have `name`, `description`, and `branding` (all present).

## 2. Submit to awesome lists

Open a PR adding an entry to these lists:

- **awesome-devsecops** — under static analysis / pre-commit.
- **awesome-precommit** / pre-commit hooks lists.
- **awesome-nodejs** — under "Security" or "Command-line utilities".

Suggested entry:

```markdown
- [riskdiff](https://github.com/therealruthvik/riskdiff) - Local, zero-config
  pre-commit risk scanner for git diffs (secrets, dangerous calls, untested
  code) with per-finding fixes. No LLM, no backend, no telemetry.
```

## 3. Hacker News — Show HN

**Title:** `Show HN: riskdiff – a local, zero-config risk gate for AI-generated code`

**Body:**

```
I kept shipping AI-generated diffs faster than I could review them, so I wrote a
small pre-commit scanner that scores a git diff for risk before it reaches a PR.

It flags secrets, dangerous calls (eval, shell=True, unsafe deserialization, XSS
sinks, SQL string concat), sensitive-path changes (auth/payments/migrations),
removed tests, and dependency changes — then gives each finding a one-line fix.

Unlike CodeRabbit/Greptile/Bugbot it runs fully locally: no LLM, no API key, no
backend, no telemetry, zero runtime dependencies. It's the fast deterministic
gate that runs in front of those tools, not a replacement for them.

Try it: npx riskdiff --staged

It outputs text, JSON, SARIF (GitHub code scanning), or Markdown (PR comments),
and ships a GitHub Action + pre-commit/husky/lefthook recipes.

Feedback welcome — especially on false positives.
```

Post around 8–10am ET on a weekday; reply to every comment in the first hour.

## 4. Product Hunt

**Tagline:** `A local, zero-config risk gate for AI-generated code`

**Description:**

```
riskdiff scores your git diff for risk — secrets, dangerous calls, untested
code, sensitive paths — before it reaches a PR, and tells you how to fix each
finding. Runs fully offline: no LLM, no API key, no telemetry, zero deps.
One command: npx riskdiff init.
```

First comment: the maker story + the `npx riskdiff --staged` one-liner.

## 5. One-liner (use everywhere)

> One local, zero-config gate for AI-generated-code risk — before it reaches a PR.
