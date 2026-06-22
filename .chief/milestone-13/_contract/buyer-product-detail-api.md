# Buyer Product Detail API Contract

## Scope

Shape buyer product detail data so the UI can render media, variant selection, trust signals, and purchase context without ad hoc client inference.

## Existing Endpoint

```txt
GET /api/products/:productId
```

## Required Response Support

The product detail response must support:

- Ordered product media with primary image first.
- Product video when available and public-safe.
- Variant matrix data:
  - variant id
  - SKU/title
  - price/currency
  - available stock derived from inventory
  - option value links
- Option definitions and option values for buyer selection.
- Trust signal fields when available:
  - rating summary or average rating
  - sold count
  - shop identity
  - shop location
  - brand
  - warranty/condition/origin
  - shipping or return hints if already represented by existing domain data
- Clear unavailable/out-of-stock semantics.

## Constraints

- Do not trust client-provided pricing or stock.
- Do not add large schema changes unless a field cannot be derived from existing models.
- Keep product detail compatible with existing frontend normalizer in `app/features/product/queries.ts`.
- Avoid N+1 queries when loading media, variants, inventory, shop, brand, and attributes.

## Tests

Required backend tests:

- Product detail returns variant option matrix with stock.
- Product detail returns ordered public media and hides secret/private storage URLs.
- Product detail exposes trust signal fields when data exists.
- Inactive/deleted products remain unavailable publicly.
