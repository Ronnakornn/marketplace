# Home Buyer Action Handoff Contract

## Purpose

Buyer actions from the home page must hand off to cart and auth flows consistently with product listing and product detail surfaces.

## Add To Cart Requirements

- Quick-add is allowed only when the target variant is unambiguous and in stock.
- Successful add-to-cart must show readable confirmation on desktop and mobile.
- Successful add-to-cart must invalidate or refetch the buyer cart query keys used by the shell/cart surfaces.
- Add-to-cart errors must be converted into readable buyer-facing messages and must never render raw objects.
- Add-to-cart must not navigate away from the current home context unless the buyer explicitly chooses to view cart or checkout.

## Guest/Auth Requirements

- Guest buyers must get a clear login handoff for quick-add or favorite actions.
- Auth handoff must preserve enough return context to resume browsing after login where existing auth flow supports it.
- Seller/admin-only actions must not appear on buyer home cards.

## Favorite/Tracking Requirements

- Favorite buttons must not trigger product-card navigation.
- Product taps should keep existing product view/tracking behavior.
- Recently viewed should not break when tracking data is absent.

## Boundaries

- Use existing cart and auth APIs.
- Do not redesign cart conflict resolution.
- Do not change checkout validation or payment status behavior.
