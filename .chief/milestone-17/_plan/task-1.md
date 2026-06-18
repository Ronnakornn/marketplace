# task-1: Refine Product Detail Decision Panel State and Layout

## Objective

Improve the product detail decision panel so buyers can clearly understand price, stock, variant selection, quantity, and why purchase actions are enabled or disabled.

## Primary Files

- `app/features/product/components/ProductDetailPage.tsx`
- `app/features/product/components/ProductBuyerStates.test.tsx`

## Implementation Notes

- Keep logic in `app/features/product/`.
- Refine existing decision panel instead of replacing the page structure.
- Make selected variant/SKU, quantity, stock, price/range, and disabled reason visually easy to scan.
- Preserve support for option-based products and standalone multi-variant products.
- Keep quantity bounded by selected variant stock.
- Do not change backend pricing or inventory authority.

## Acceptance Criteria

- Missing option, unavailable combination, out-of-stock, guest, and non-buyer states show readable purchase reasons.
- Selected variant and quantity summary is clear.
- Option chips and standalone variants remain readable on narrow mobile widths.
- Decision panel has no obvious text overlap or clipped controls on desktop or mobile.

## Verification

- Add or update focused tests for variant selection, missing options, unavailable/out-of-stock states, and quantity bounds.
- Include browser evidence in task-4.
