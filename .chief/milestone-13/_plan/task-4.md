# task-4: Add related products and recently viewed sections to product detail

## Objective

Add lightweight discovery continuity to product detail through related products and recently viewed products.

## Affected Areas

- `app/features/product/components/ProductDetailPage.tsx`
- `app/features/product/queries.ts`
- `app/features/tracking/**`
- related API from task-1
- frontend tests

## Requirements

- Add related products section using the related products API.
- Add recently viewed section using existing tracking/recently viewed behavior where possible.
- Exclude the current product from both sections.
- Show loading states that do not block the primary detail page.
- Show empty states without visual noise.
- Show error/retry state where useful, or fail softly if non-critical.
- Use `ProductCard` or a compact compatible card component.

## Constraints

- Do not build a recommendation engine.
- Do not expose another user's recently viewed data.
- Sections must not make the primary purchase area jump or become unreachable.

## Required Tests

- Related products render when returned.
- Recently viewed products render when available.
- Current product is excluded.
- Empty related/recently viewed sections render gracefully.
- Errors do not break product detail.

## Completion Criteria

- Product detail has lightweight related and recently viewed discovery sections.
- Non-critical discovery failures do not break product detail.
