# Buyer Product Detail UI Contract

## Scope

Improve `ProductDetailPage` so buyers can inspect media, choose variants, understand trust signals, and purchase with less friction.

## Affected Frontend

- `app/features/product/components/ProductDetailPage.tsx`
- `app/features/product/queries.ts`
- Product detail tests under `app/features/product/components/`

## Required UI

- Media gallery:
  - stable aspect ratio
  - thumbnails
  - selected media state
  - video affordance when available
  - keyboard-accessible controls
- Purchase panel:
  - price/range
  - promotion/original price where available
  - stock state
  - selected variant summary
  - clear disabled reason for add-to-cart/buy-now
- Variant selection:
  - unavailable and out-of-stock states
  - color swatch support when available
  - quantity stepper with max stock
- Trust signal area:
  - rating
  - sold count
  - shop identity/location
  - buyer protection, shipping, return hints where data or static copy exists
- Related products and recently viewed sections.
- Improved mobile sticky purchase bar.

## States

Must render:

- Loading skeleton.
- Product unavailable/empty.
- API error with retry.
- Product with no images.
- Product with no purchasable variants.
- Out-of-stock product.

## Constraints

- Keep business logic out of shared UI.
- Do not redesign cart/checkout.
- Do not implement review/Q&A content beyond placeholders or data hooks already planned for milestone 10.
- Text must not overflow controls on mobile.

## Tests

Required tests:

- Variant selection enables purchase only for valid in-stock variant.
- Missing option and out-of-stock disabled reasons render.
- Media gallery controls are keyboard-accessible.
- Sticky purchase bar shows selected price/variant/quantity state.
- Related/recently viewed sections handle loading and empty states.
