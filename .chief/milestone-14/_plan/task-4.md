# task-4: Metadata Driven Listing Filters

## Objective

Update buyer listing/search filters so category, brand, and price range controls use backend metadata on desktop and mobile.

## Scope

- `app/features/product/components/ProductListingPage.tsx`
- Product query types/normalizers if needed.
- Focused listing UI tests.

## Required Behavior

- Category filters show facet counts when available.
- Brand filters show facet counts when available.
- Unavailable category/brand options are disabled or visually de-emphasized.
- Price range controls use backend min/max metadata as helper/default context when the buyer has not entered explicit values.
- Active filter chips remain removable.
- Clear filters preserves the search query when appropriate.
- Mobile filter sheet and desktop sidebar expose equivalent options.
- If facet metadata is unavailable but products load, listing remains usable.

## Constraints

- Do not add product spec/attribute filter UI.
- Do not add new shared UI business logic.
- Do not make text overflow in compact mobile filter sheet.

## Verification

- Add/update listing UI tests for category counts, brand counts, price metadata, active chips, clear filters, and no-facet fallback.
- Run:

```bash
bun run test app/features/product
bunx tsc --noEmit
```
