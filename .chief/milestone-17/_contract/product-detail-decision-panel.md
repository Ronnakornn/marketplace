# Product Detail Decision Panel Contract

## Purpose

The product detail decision panel must help buyers understand what they are buying, whether it is purchasable, and what action is currently available.

## Required Content

- Product title and trusted shop/brand context.
- Rating, sold count, stock summary, and current price or price range.
- Variant selector for option-based products and standalone multi-variant products.
- Quantity selector bounded by selected variant stock.
- Selected purchase summary showing variant/SKU where available and quantity.
- Purchase status line with disabled reason, pending state, or error state.

## State Rules

- If options are missing, purchase actions must explain what remains to select.
- If a selected combination is unavailable, purchase actions must be disabled with a readable reason.
- If selected variant stock is zero, purchase actions must be disabled with a readable reason.
- If buyer role is not allowed to purchase, purchase actions must be disabled with a readable reason.
- If the user is a guest, purchase actions must route to login with the product return path.

## Layout Rules

- Desktop decision panel must remain stable beside the media gallery.
- Mobile decision panel must not overlap the sticky buy bar.
- Text must not overflow or hide adjacent controls.
- Variant chips, stock labels, and status text must remain readable at narrow widths.

## Boundaries

- Do not change product pricing or stock authority.
- Do not redesign product listing/search/home surfaces.
- Do not introduce new backend pricing or inventory logic unless required to expose existing state safely.
