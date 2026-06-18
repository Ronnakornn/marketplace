# Home Flash Sale Contract

## Purpose

Flash Sale remains a home-specific commerce section because it needs urgency, progress, and sale pricing treatment that generic product cards do not cover.

## Display Requirements

- Each sale item must show product identity, shop context where available, sale price, original price when available, currency, and sale progress/stock context.
- Sale timing or urgency UI must be readable and must not rely on color alone.
- Sold/progress indicators must handle zero, missing, and capped stock values without broken math or visual overflow.
- Cards must remain stable in desktop rails and mobile horizontal scrolling.

## Action Requirements

- Add-to-cart from Flash Sale must use the same cart mutation path and feedback behavior as other home quick-add actions.
- If the sale item does not provide enough variant/cart data, the primary action should route to product detail instead of guessing.
- Errors must be readable and recoverable.

## Backend/Data Requirements

- Flash Sale data may keep its sale-specific DTO, but any extra fields added for action safety must come from backend APIs, not client inference.
- Client-side sale display must not be treated as pricing authority.

## Boundaries

- Do not replace Flash Sale with the generic reusable `ProductCard` unless sale urgency/progress remains intact.
- Do not implement a full flash-sale management backend in this milestone.
