# Contract: Product Card UI

## Required Fields

Product cards display:

- primary image
- title with two-line clamp
- price or price range
- original price or discount when promotion data exists
- rating
- sold count
- shop name
- shop location when available
- badges when data exists

Supported badges:

- Flash Sale
- Free Shipping
- Verified Shop
- Preferred Shop
- Low Stock
- New

## Actions

Supported actions:

- open product detail
- favorite or unfavorite
- quick add-to-cart only when the product has exactly one purchasable variant and no required option selection

Rules:

- Quick add-to-cart must never choose an ambiguous variant.
- Product impression and click tracking are emitted without blocking navigation.
- Product cards must remain layout-stable on mobile and desktop grids.
