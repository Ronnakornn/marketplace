# task-4: Build seller product analytics UI

## Objective

Add a seller-facing product analytics page that visualizes the backend analytics APIs.

## Affected Areas

- `app/[locale]/seller/analytics/products/page.tsx`
- `app/features/seller/**`
- seller navigation components
- frontend tests

## Requirements

- Add route `/seller/analytics/products`.
- Add seller navigation entry for Product Analytics.
- Add contextual link from product management when practical.
- Include:
  - date range selector for 7 days, 30 days, 90 days, and custom range
  - summary KPI row
  - daily trend chart
  - product performance table
  - top SKUs section
  - low-performing products section
- Handle loading, empty, error, retry, and custom date validation states.
- Support mobile and desktop without overflow.

## Data Fetching

- Use TanStack Query.
- Use same-origin `/api/*` request pattern.
- Prefer Eden inferred types if available.
- Keep server state out of shared UI components.

## Design Notes

- Keep the page dense, operational, and seller-tool focused.
- Do not use a landing-page hero.
- Keep cards, tables, charts, and controls stable across breakpoints.

## Required Tests

- Page renders summary metrics.
- Date range changes trigger refetch behavior.
- Loading, empty, and error states render.
- Seller navigation exposes Product Analytics route.

## Completion Criteria

- Seller can open `/seller/analytics/products`.
- Page is usable on desktop and mobile.
- UI tests cover core states.
