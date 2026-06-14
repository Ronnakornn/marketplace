# Task 2: Improve Quantity, Stock, And Disabled Action Feedback

## Goal

Make stock, quantity, and disabled purchase action state explicit before a buyer clicks add-to-cart or buy-now.

## Applies To

- `app/features/product/components/ProductDetailPage.tsx`
- `app/features/product/components/ProductBuyerStates.test.tsx`

## Requirements

- Quantity controls must be disabled or constrained until a valid in-stock variant is selected.
- Quantity must never exceed the selected variant stock.
- Quantity must reset or clamp when the selected variant changes to one with lower stock.
- Show a buyer-readable disabled reason near the purchase controls when:
  - required options are missing
  - the selected combination is unavailable
  - the selected variant is out of stock
  - no purchasable variant exists
- Preserve existing add-to-cart mutation behavior.
- Preserve current buy-now behavior; do not introduce a new checkout flow.

## Acceptance Criteria

- Tests verify purchase actions are disabled before required variant selection.
- Tests verify quantity passed to add-to-cart respects the selected quantity and selected variant.
- Tests verify quantity cannot exceed selected variant stock after changing variants.
- Tests verify a disabled reason is visible before click.
- Mutation loading states prevent duplicate submissions.

## Guardrails

- UI stock display is advisory; backend/cart validation remains authoritative.
- Do not implement inventory reservation.
- Do not change cart API contracts.
