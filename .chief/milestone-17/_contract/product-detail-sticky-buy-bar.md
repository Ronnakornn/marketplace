# Product Detail Sticky Buy Bar Contract

## Purpose

The sticky buy bar must expose purchase actions without hiding important product detail content or crowding controls.

## Content Contract

- Show current price or price range.
- Show selected variant/SKU summary where available.
- Show quantity and stock/purchase status.
- Include wishlist and chat seller only when they do not crowd primary purchase actions.
- Include Add to cart and Buy now as the primary purchase controls.

## Responsive Contract

- Mobile layout must keep Add to cart and Buy now tappable without label overflow.
- Desktop layout may show additional secondary controls such as chat seller.
- Sticky bar must respect safe-area inset on mobile.
- Sticky bar must not obscure form controls without enough page bottom padding.

## Accessibility Contract

- Action buttons must have clear labels.
- Disabled actions must expose the reason via visible text and/or button title.
- Status text must be associated with purchase actions through `aria-describedby` where practical.
- Pending state must be readable and stable.

## Boundaries

- Do not add a new mini cart drawer.
- Do not make sticky bar responsible for business validation beyond displaying state derived from product detail logic.
