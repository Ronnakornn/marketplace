# Contract: Product Detail UI State

## Applies To

Buyer product detail surfaces under:

- `app/features/product/components/ProductDetailPage.tsx`
- Focused product detail child components if extracted under `app/features/product/components/`

## Data Source

- Use the existing product detail response shape already consumed by `ProductDetailPage`.
- Use existing product variants, option groups, images, video URL, product attributes, seller summary, rating, sold count, and stock fields.
- Do not require new backend fields for this milestone.

## Variant State

- Option values must communicate these states:
  - selected
  - available
  - unavailable because no matching variant exists
  - unavailable because matching variants are out of stock
- Disabled option values must not be selectable.
- Selected variant summary must show the chosen option labels and selected SKU when available.
- When a product has purchasable variants, purchase actions require a valid in-stock selected variant.
- When a product has no purchasable variants, purchase actions stay disabled with a visible reason.

## Quantity And Stock State

- Quantity controls must be constrained by selected variant stock.
- Quantity must reset or clamp when the selected variant changes.
- Buyers must see the current stock state near the variant/quantity area and near the sticky action summary.
- UI stock messaging is advisory only; backend/cart validation remains authoritative.

## Sticky Action Summary

- Sticky action content must include enough context to purchase confidently:
  - selected price or product price range
  - selected variant label or prompt to select required options
  - selected quantity
  - stock/disabled reason
- Sticky actions must remain usable on mobile and desktop without overlapping product content.
- Sticky actions must preserve the existing add-to-cart and buy-now action entry points.

## Media And Facts

- Product media gallery must support the existing image and video data.
- Product facts/specifications must be easier to scan than a raw ungrouped list.
- Corrupted display separators or unclear product detail text must be corrected.

## Out of Scope

- New product media upload behavior.
- New product attribute schema.
- Faceted filter widgets.
- Review, Q&A, or recommendation components.
