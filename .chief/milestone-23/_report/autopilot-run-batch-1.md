# Autopilot Run Batch 1

## Mode

auto

## Summary

Completed milestone-23 buyer-facing i18n. The milestone now has an audit report, deterministic i18n audit tooling, normalized Thai dictionaries, expanded EN/TH message keys, migrated buyer/public shopping UI strings, updated focused tests, and EN/TH browser evidence.

## Tasks Completed

- task-1: Audited scoped buyer/public shopping surfaces for hardcoded UI text, key gaps, Thai mojibake, and test impact.
- task-2: Added `bun run audit:i18n` for key parity, placeholder parity, Thai readability, and scoped hardcoded UI string checks.
- task-3: Normalized scoped Thai message values and completed EN/TH message dictionaries.
- task-4: Migrated scoped buyer/public shopping components and helpers to translation keys and updated focused tests.
- task-5: Ran verification and captured EN/TH browser evidence for home and authenticated wishlist.

## Decisions Made (auto mode only)

- **Issue:** The initial audit found many existing hardcoded strings plus Thai mojibake, which would make a strict audit fail before migration began.
  - **Options:** Fail the audit immediately, skip audit until the end, or add a baseline for known existing debt.
  - **Chosen:** Add a deterministic audit with a baseline.
  - **Reason:** This allowed task-by-task migration while preventing new i18n regressions.
- **Issue:** The i18n audit reported some strings that are not visible UI copy, including machine strings, route templates, generated IDs, formatter literals, and API/user-provided content.
  - **Options:** Translate all flagged strings, weaken the audit globally, or keep documented baseline exceptions.
  - **Chosen:** Keep documented baseline exceptions for non-UI or dynamic data strings.
  - **Reason:** Translating these would change behavior or make code less clear without improving buyer-facing localization.
- **Issue:** In-app browser screenshot capture timed out during verification.
  - **Options:** Skip browser evidence, retry indefinitely, or use local headless Chrome/CDP.
  - **Chosen:** Use Chrome headless/CDP for PNG evidence.
  - **Reason:** It produced deterministic local screenshots while preserving the evidence requirement.
- **Issue:** Local Redis was unavailable during browser evidence, causing backend `ECONNREFUSED` logs and home feed loading state.
  - **Options:** Start or mutate external Redis state, skip home evidence, or capture the available localized home shell/loading state.
  - **Chosen:** Capture the available localized home state and document the Redis limitation.
  - **Reason:** The milestone is i18n-focused, and mutating local infrastructure was outside scope.

## Backlog

- Reduce the remaining 17 audit baseline findings further if future work wants a stricter zero-baseline hardcoded-string policy.
- Localize auth pages separately; this milestone focused buyer/public shopping surfaces and authenticated buyer pages.
- Re-capture populated home evidence when local Redis/feed dependencies are available.

## User Action Needed

None.
