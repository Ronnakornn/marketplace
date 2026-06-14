# Task 3: Add Sticky Purchase Summary For Product Detail

## Goal

Upgrade the sticky purchase action area so it carries the minimum context buyers need at the moment of action.

## Applies To

- `app/features/product/components/ProductDetailPage.tsx`
- `app/features/product/components/ProductBuyerStates.test.tsx`
- Product detail CSS/classes within the same component tree

## Requirements

- Sticky purchase summary must show:
  - selected price or product price range
  - selected variant label or a prompt to select options
  - selected quantity
  - stock state or disabled reason
- Keep add-to-cart and buy-now buttons available in the sticky area.
- Sticky layout must be readable on mobile and desktop.
- Sticky area must not overlap content in a way that hides product facts, media, or actions.
- Use stable dimensions/responsive constraints so state text does not cause layout jumps.

## Acceptance Criteria

- Tests verify sticky summary renders price, variant prompt or selected variant, quantity, and stock/disabled context.
- Mobile and desktop browser verification confirms the sticky area remains usable and readable.
- Add-to-cart and buy-now actions remain connected to the existing handlers.

## Guardrails

- Do not create a new app shell or global navigation redesign.
- Do not introduce a separate checkout route or backend behavior.
- Keep product-specific behavior in product feature files.
