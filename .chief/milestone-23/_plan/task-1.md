# Task 1: Buyer i18n Audit

## Objective

Audit the scoped buyer-facing and public shopping surfaces before migration so implementation can target real gaps instead of guessing.

## Affected Areas

- `messages/en.json`
- `messages/th.json`
- `app/i18n/*`
- `app/components/BuyerShell.tsx`
- `app/components/BuyerState.tsx`
- `app/components/LanguageSwitcher.tsx`
- `app/features/buyer/**`
- `app/features/cart/**`
- `app/features/checkout/**`
- `app/features/order/**`
- `app/features/chat/**`
- `app/features/marketplace/**`
- `app/features/product/**`
- public shopping routes under `app/[locale]/(public)/**`
- buyer routes under `app/[locale]/(buyer)/**`

## Requirements

- Inventory scoped files and classify them into:
  - buyer-authenticated surfaces
  - public shopping surfaces
  - shared buyer-visible components/helpers
  - tests/fixtures to exclude from migration checks
- Identify hardcoded visible UI strings in scoped production files.
- Identify toast, aria-label, placeholder, loading, empty, error, and status text that is not translated.
- Identify message keys used by scoped files but missing from either locale.
- Identify `messages/th.json` values in scoped namespaces that render as mojibake or otherwise unreadable Thai.
- Identify affected tests likely to need updates.
- Write findings to `.chief/milestone-23/_report/task-1/buyer-i18n-audit.md`.

## Constraints

- Do not modify production code in this task.
- Keep audit output structured and actionable.
- Do not include seller/admin back-office surfaces except shared buyer-visible components.

## Done When

- Audit report exists and lists prioritized gaps.
- Implementation blockers are called out.
- `_todo.md` marks task-1 complete.

