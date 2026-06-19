# Task 4: Component i18n Migration

## Objective

Migrate scoped buyer-facing components and helpers to translation keys, including visible text, toasts, aria-labels, placeholders, and status labels.

## Affected Areas

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
- public shopping route components under `app/[locale]/(public)/**`
- buyer route components under `app/[locale]/(buyer)/**`
- affected component tests

## Requirements

- Replace hardcoded buyer-facing UI text with existing or newly added translation keys.
- Cover:
  - titles and headings
  - buttons and links
  - labels and placeholders
  - empty/loading/error states
  - toast text
  - aria-labels and screen-reader-only text
  - stock/status/filter labels shown to buyers
- Use existing i18n utilities:
  - `useTranslations`
  - `createTranslator`
  - `useFormatters`
  - `useLocalePath`
  - `withLocale`
- Update tests whose expected labels changed.
- Keep dynamic data dynamic; do not translate API-provided product/shop/order/user content.

## Constraints

- Do not redesign layouts while migrating text.
- Do not change backend schemas or business rules.
- Avoid broad refactors unrelated to i18n.
- Keep Thai/English text fitting in existing responsive UI.

## Verification

- Run i18n audit.
- Run focused tests for affected buyer/product/cart/checkout/order/chat components.
- Run `bunx tsc --noEmit`.

## Done When

- Scoped production files pass i18n audit.
- Focused tests pass.
- `_todo.md` marks task-4 complete.

