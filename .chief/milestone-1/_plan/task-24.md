# task-24: Add admin brand management APIs and extend catalog product APIs for enrichment and filters

## Goal

Expose protected brand management APIs and make catalog product APIs support enriched product data and buyer filters.

## Scope

- Add admin brand APIs:
  - list/search with pagination
  - create
  - update
  - deactivate/archive
  - reactivate
- Extend catalog repository/service/routes for:
  - product enrichment create/update/read
  - product highlights and attributes/specs
  - brand profile data in product responses
  - public filtering by `brandId`
  - public exact-match filtering by filterable attribute key/value
- Extend seller product create/update endpoints to accept enrichment fields and specs.
- Extend public product detail/list/search responses with buyer-needed brand/spec/highlight fields.

## Implementation Notes

- Use existing auth macros for admin protection.
- Keep brand mutations admin-only.
- Seller ownership checks must cover enrichment mutations.
- Preserve active-only public product visibility.
- Preserve existing pagination and response compatibility where practical.
- Normalize brand slugs and product `attributeKey` values in services.
- Reject duplicate brand slug/code conflicts.
- Avoid N+1 relation loading when including brand/highlights/attributes.
- Search module may remain separate; only extend it enough to honor brand/attribute filters where required.

## Verification

- Add backend tests for admin brand create/update/list/search/deactivate/reactivate and duplicate handling.
- Add backend tests for seller product enrichment ownership checks.
- Add backend tests for public product filtering by brand and filterable attributes.
- Run focused catalog/admin/search tests.
- Run `bunx tsc --noEmit`.
