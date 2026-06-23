# Known issues

Bugs found by scanning 30 popular open-source repositories (Python, Node,
TypeScript, Go, Ruby, Rust) with a whole-codebase scan. Across the corpus, 26 of
28 repos scored HIGH — almost entirely from false positives caused by
context-blindness, not from real risk. These are tracked here to fix in a future
release.

Ranked by impact.

## 1. Test detection is broken (critical)

16 of 28 repos with full test suites reported "0 test lines (+15)". The
test-file pattern requires `/test/` with a leading slash, so it misses
root-level `test/` and `tests/`, and Python conventions `test_*.py` /
`*_test.py`. Test files are then mis-counted as production source.

- **Fix:** match `(^|/)tests?/`, `(^|/)spec/`, `test_*.py`, `*_test.py`,
  `*_test.go`, `*_spec.rb`, in addition to the existing patterns.
- **Seen in:** requests, click, express, flask, black, cobra, gin, sinatra,
  rich, typer, mux, dotenv, underscore, and others.

## 2. Code rules run on prose / documentation files

Code-smell, dangerous-call, and secret rules fire on `.md`, `.rst`, `.txt`,
`README`, `CHANGES`, `HISTORY`. Documentation is not executable code. Observed:
124 `console.log` hits, 14 `any`, 11 "hardcoded credential", plus
`eval`/TLS/pickle — all inside docs.

- **Fix:** skip prose/doc file types for code-content rules (still allow path
  rules where relevant), or add them to default ignore for content scanning.

## 3. The `any` rule matches non-TypeScript files

111 false hits. `\bany\b\s*[:)]` matches Python `any()`, Rust generics, and
prose, not just TypeScript's `any` type.

- **Fix:** only run the `any` smell on `.ts` / `.tsx` files.
- **Seen in:** requests/*.py, flask/*.py, rich/*.py, pydantic-core/*.rs, many docs.

## 4. Example / demo / docs / benchmark directories scanned as production

285 findings inside `examples/`, `samples/`, `demo/`, `docs/`, `benchmark/`.
Teaching code legitimately uses `console.log` and demo credentials.

- **Fix:** add these directories to the default ignore set.

## 5. Private keys in test fixtures flagged as leaks

12 hits on `tests/certs/*.key` and similar (requests, httpie, axios). These are
intentional test certificates, not leaked secrets.

- **Fix:** lower severity (or ignore) for key/cert files under test/fixture
  paths.

## 6. Sensitive-path rule matches by substring in any filename

The path rule matches keywords anywhere, including documentation filenames:
`pydantic_extra_types_payment.md` was flagged as **payments (+30)**, and
`*_schema.md` / `migration.md` as **db migration**.

- **Fix:** require a path-segment match (e.g. `migrations/`, `auth/`) rather than
  a bare substring, and exclude doc files.

## 7. Score explosion / no normalization for repo size

Large and TypeScript-heavy repos scored 1700-2200+ (axios 2230, pydantic 2015,
typer 1875, zod 1874, date-fns 1725). Mostly a symptom of #2-#4, but there is
also no separation between "audit a whole repo" and "review one change", so
score scales with codebase size and level loses meaning.

- **Fix:** land #1-#4 first, then consider a per-file or normalized mode for
  whole-repo audits distinct from per-change scoring.

## 8. Non-ASCII / git-quoted filenames are not unquoted

git quotes paths containing non-ASCII or special characters (C-style octal
escapes, controlled by `core.quotepath`), e.g.
`"b/docs/zh-CN/\344\270\215...md"`. `parseDiff` only strips an unquoted `b/`
prefix, so the quotes, the `b/` prefix, and the escapes leak into the reported
path.

- **Fix:** detect a quoted `"..."` path in the `+++`/`---` lines, remove the
  surrounding quotes, strip the `a/`/`b/` prefix, and decode the octal escapes.

---

_Method: shallow-cloned each repo and ran `riskdiff --against <empty-tree> --json`
(whole-codebase scan). Raw data was collected for analysis; counts above are
across the 28 repos that scanned cleanly._
