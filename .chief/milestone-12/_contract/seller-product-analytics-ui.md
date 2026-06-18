# Seller Product Analytics UI Contract

## Scope

Add a seller-facing product analytics page.

## Route

Preferred route:

```txt
/seller/analytics/products
```

Expected app route:

```txt
app/[locale]/seller/analytics/products/page.tsx
```

Feature code should live under:

```txt
app/features/seller/
```

or a dedicated analytics feature folder if the existing seller feature structure supports it.

## Navigation

- Add a seller navigation entry for Product Analytics.
- Add a contextual link from product management when practical.

## Required UI

- Date range selector for 7 days, 30 days, 90 days, and custom date range.
- Summary KPI row for views, add-to-cart, orders, units sold, revenue, and conversion rate.
- Daily trend chart.
- Product performance table.
- Top SKUs section.
- Low-performing products section.

## States

The UI must handle:

- Loading.
- Empty data.
- API error with retry.
- Custom date validation error.
- Mobile and desktop layouts.

## Data Fetching

- Use same-origin `/api/*` requests through the existing API client pattern.
- Use TanStack Query for server state.
- Do not manually duplicate backend response types if Eden inferred types are available.

## Design Constraints

- Keep the screen operational and information-dense, consistent with seller tooling.
- Avoid marketing hero layouts.
- Tables and cards must not overflow on mobile.

## Tests

Required tests:

- Renders summary metrics.
- Switches date ranges and refetches data.
- Shows loading, empty, and error states.
- Seller navigation exposes the Product Analytics route.
