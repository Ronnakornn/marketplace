# Task 2: i18n Audit Tooling

## Objective

Add deterministic tooling that prevents buyer-facing i18n regressions.

## Affected Areas

- `scripts/`
- test or verification files used by Vitest
- `messages/en.json`
- `messages/th.json`
- `.chief/milestone-23/_report/task-2/`

## Requirements

- Add an audit command or test that checks:
  - `messages/en.json` and `messages/th.json` key parity.
  - placeholder parity for matching message values.
  - scoped Thai message values are readable Thai and not mojibake.
  - obvious hardcoded English buyer-facing UI strings in scoped production files.
- Scope the hardcoded-string scan to buyer/public shopping production files.
- Exclude documented false-positive categories:
  - test files
  - import paths
  - CSS class names
  - URLs
  - analytics event names
  - enum/status raw values
  - product/shop/user-generated data
- Document how to run the audit in `.chief/milestone-23/_report/task-2/i18n-audit-tooling.md`.

## Constraints

- Keep the audit deterministic and runnable locally without network access.
- Prefer simple Node/Bun scripts and existing test tooling.
- Do not introduce a third-party i18n library.
- Avoid over-strict heuristics that block legitimate code patterns.

## Verification

- Run the audit command.
- Run focused tests if the audit is implemented through Vitest.

## Done When

- Audit tooling exists and is documented.
- Audit failures are actionable.
- `_todo.md` marks task-2 complete.

