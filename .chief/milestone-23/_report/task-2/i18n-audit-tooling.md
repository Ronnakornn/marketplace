# Task 2 i18n Audit Tooling

## Command

```bash
bun run audit:i18n
```

The command runs `scripts/i18n-audit.ts` locally with no network access.

## What It Checks

- `messages/en.json` and `messages/th.json` have matching flattened key structure.
- Matching message values have identical interpolation placeholders such as `{count}`, `{amount}`, `{time}`, `{orderNo}`, and `{name}`.
- Scoped Thai message values in buyer/public namespaces contain readable Thai and do not match obvious mojibake markers.
- Scoped buyer/public production TSX files do not introduce new obvious hardcoded English UI strings.

## Scope

Message readability is scoped to these namespaces:

- `common`, `nav`, `home`, `product`, `cart`, `checkout`, `order`, `chat`, `buyer`, `notification`, `affiliate`, `state`, `ui`

Hardcoded English scanning is scoped to buyer/public production surfaces:

- `app/[locale]/(buyer)/**`
- `app/[locale]/(public)/**`
- `app/features/buyer/**`
- `app/features/cart/**`
- `app/features/checkout/**`
- `app/features/order/**`
- `app/features/chat/**`
- `app/features/affiliate/**`
- `app/features/home/**`
- `app/features/marketplace/**`
- `app/features/product/**`
- shared buyer-visible components in `app/components/BuyerShell.tsx`, `BuyerState.tsx`, `LanguageSwitcher.tsx`
- `app/features/product/cart-handoff.ts`

## Documented Exceptions

The scanner intentionally excludes or baselines these categories:

- test files and fixtures
- import paths and module specifiers
- CSS class names and style-only attributes
- URLs, route templates, and query keys
- analytics event names and machine identifiers
- enum/status raw values and API normalizer fallback data when they are not JSX-visible literals
- product, shop, order, address, notification, chat, review, and other user/API-provided data

## Baseline

Current known task-1 debt is stored in `scripts/i18n-audit-baseline.json`.

The baseline allows task-2 tooling to pass before task-3 and task-4 fix the existing Thai mojibake and hardcoded UI strings. New unbaselined findings fail the audit. After intentional localization fixes, run:

```bash
bun run audit:i18n -- --update-baseline
```

Only update the baseline when the removed findings correspond to completed migration work or a documented false-positive exception.

## Verification

Ran:

```bash
bun run audit:i18n
```

Result:

- key parity passed for 379 English keys and 379 Thai keys
- placeholder parity passed
- 176 current scoped Thai/hardcoded findings are covered by the baseline
