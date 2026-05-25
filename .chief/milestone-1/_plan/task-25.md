# task-25: Integrate brand management, seller product enrichment, and buyer brand/spec display/filter UI

## Goal

Wire the new brand and product enrichment capabilities into admin, seller, and buyer UI surfaces.

## Scope

- Add or extend admin UI for brand management:
  - list/search
  - create/edit
  - deactivate/reactivate
- Extend seller product UI to edit:
  - SEO title/description
  - highlights
  - warranty info
  - condition
  - country of origin
  - product attributes/specifications
  - brand selection with active brands only
- Extend buyer UI to:
  - show brand where useful on product cards/listing/detail
  - show highlights, facts, and specifications on product detail
  - filter listing/search/category by brand
  - filter by simple exact-match filterable attributes where practical
- Update product query helpers and query keys for brand/attribute filters.

## Implementation Notes

- Follow existing admin/seller/buyer UI patterns.
- Do not add brand landing pages.
- Do not redesign the whole product detail or listing page.
- Keep filter UI simple and accessible.
- Use Eden/TanStack Query inferred types where practical.
- Keep seller form failures from clearing user-entered enrichment data.
- Do not let sellers create or modify brand records.

## Verification

- Add focused admin brand UI tests where practical.
- Add seller product form tests for enrichment fields and active brand selection where practical.
- Add buyer UI tests for brand/spec display and brand/attribute filters where practical.
- Run focused affected frontend tests.
- Run `bunx tsc --noEmit`.
