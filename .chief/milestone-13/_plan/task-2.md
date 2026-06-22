# task-2: Improve product detail media gallery, variant/quantity selection, trust signals, and sticky purchase bar

## Objective

Upgrade buyer product detail UX so buyers can inspect media, choose variants, understand purchase state, and act from mobile or desktop.

## Affected Areas

- `app/features/product/components/ProductDetailPage.tsx`
- `app/features/product/queries.ts`
- `app/features/product/components/ProductBuyerStates.test.tsx`
- translations if needed

## Requirements

- Improve media gallery:
  - stable image/video area
  - thumbnail selection
  - keyboard-accessible gallery controls
  - useful fallback when product has no images
- Improve variant selection:
  - selected, available, unavailable, and out-of-stock states
  - color swatches must include text labels
  - quantity stepper respects selected variant stock
  - disabled purchase reasons are visible
- Improve trust/purchase context:
  - price/range
  - original price/discount where available
  - rating and sold count
  - stock and selected variant summary
  - shop identity/location
  - buyer protection, shipping, and return hints when available or existing copy supports it
- Improve sticky purchase bar:
  - mobile-safe layout
  - selected price/variant/quantity summary
  - add-to-cart and buy-now states
  - no text overflow

## Constraints

- Do not redesign cart or checkout.
- Do not implement review/Q&A beyond planned milestone-10 integration points.
- Keep business logic inside product feature components/hooks, not shared UI primitives.

## Required Tests

- Valid in-stock variant enables add-to-cart/buy-now.
- Missing option and out-of-stock reasons render.
- Quantity cannot exceed selected stock.
- Gallery thumbnail/video controls are accessible.
- Sticky bar reflects selected price/variant/quantity.

## Completion Criteria

- Product detail remains functional for no-image, no-variant, out-of-stock, and normal products.
- Tests cover core interaction states.
