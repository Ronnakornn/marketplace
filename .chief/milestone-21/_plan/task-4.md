# Task 4: Product Detail Review and Q&A Controls

## Objective

Add buyer-facing review and Q&A discovery controls to product detail using the new paginated query helpers.

## Affected Areas

- `app/features/product/components/ProductDetailPage.tsx`
- `app/features/product/components/ProductBuyerStates.test.tsx`
- Translation data if existing keys are insufficient.

## Review UI Requirements

- Keep rating summary independent from filtered review results.
- Add review controls for:
  - all ratings / one selected rating
  - all reviews / with media / with comment
  - latest / rating high / rating low
- Show clear active state for selected controls.
- Reset review page/accumulated reviews when review filter or sort changes.
- Show load-more action when review meta has `hasNextPage`.
- Do not remove already loaded reviews while loading the next page.
- Empty state should mention active filters when filtered results are empty.

## Q&A UI Requirements

- Keep ask-question form and auth behavior unchanged.
- Add Q&A controls for:
  - all / answered / unanswered
  - latest / oldest
- Reset Q&A page/accumulated questions when Q&A filter or sort changes.
- Show load-more action when Q&A meta has `hasNextPage`.
- Empty state should mention active filters when filtered results are empty.

## UX Constraints

- Controls must fit on mobile without text clipping or overlap.
- Avoid card-in-card layout.
- Use existing button/control styling patterns where possible.
- Do not redesign unrelated product detail sections.

## Tests

- Frontend focused tests cover:
  - review controls render and call expected query input
  - review load-more appends or preserves previous pages
  - filtered review empty state
  - Q&A answered/unanswered controls render and call expected query input
  - Q&A load-more behavior
  - existing question form still submits correctly.

## Done When

- Product detail tests pass.
- UI behavior matches `product-detail-review-qa-ui-contract.md`.

