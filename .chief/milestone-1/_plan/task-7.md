# task-7: Optimize buyer entry render and hydration path where measured

## Goal

Reduce user-visible blank/loading time for `/th` and `/th/search` where task-5 evidence points to frontend render or hydration cost.

## Scope

- Optimize only the measured bottlenecks.
- Prefer small, compatible changes over redesign.
- Preserve current UX, localization behavior, and public links.
- Avoid introducing broad global state management.

## Likely Files

- `app/[locale]/(public)/page.tsx`
- `app/[locale]/(public)/search/page.tsx`
- `app/features/marketplace/components/*`
- `app/features/product/components/*`
- `app/components/AppChrome.tsx`
- `app/i18n/*` only if measurement points to locale loading overhead

## Steps

1. Use task-5 evidence to choose the smallest frontend bottleneck to address.
2. Reduce unnecessary client work, repeated fetches, or avoidable dynamic rendering where practical.
3. Keep shared UI free of business logic.
4. Preserve existing locale path behavior.
5. Add or update focused smoke tests where component behavior changes.

## Verification

- `/th` and `/th/search` still render expected buyer entry content.
- No new console/runtime errors are introduced.
- Focused frontend tests pass where changed.
