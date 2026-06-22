# Task 1: Clarify Product Detail Variant Option States

## Goal

Make buyer variant selection states clear on the product detail page and fix corrupted display text that weakens the purchase experience.

## Applies To

- `app/features/product/components/ProductDetailPage.tsx`
- `app/features/product/components/ProductBuyerStates.test.tsx`
- Extracted product feature components only if the implementation stays under `app/features/product/components/`

## Requirements

- Represent each option value as one of:
  - selected
  - available
  - unavailable because no matching variant exists
  - unavailable because matching variants are out of stock
- Keep unavailable and out-of-stock option values non-selectable.
- Preserve the existing selected-variant lookup behavior for products with up to two option groups.
- Fix corrupted text separators in selected variant, rating, sold count, or related product detail copy.
- Use concise buyer-facing labels or helper text where visual state alone is insufficient.

## Acceptance Criteria

- A buyer can distinguish selected, available, unavailable, and out-of-stock option values without clicking every option.
- Disabled option values cannot be selected by click.
- Existing valid variant selection still resolves the correct variant ID.
- Product detail text no longer renders corrupted separator characters.
- Focused tests cover at least one disabled unavailable or out-of-stock option state.

## Guardrails

- Do not change product API response shape.
- Do not add schema or backend changes.
- Do not move product-specific variant logic into shared UI.
