# Cart Domain

The Cart domain owns buyer cart state before checkout.

## Responsibilities

- Buyer cart
- Cart items
- Shop grouping
- Item selection
- Quantity updates
- Cart availability warnings
- Estimated totals for display

## Business Rules

- Cart belongs to one buyer.
- Guest cart items are stored browser-locally and include a product snapshot for display.
- Guest buyers can add, view, and remove browser-local cart items; the header cart count updates immediately.
- Guest buyers must sign in before persistent-cart checkout. The local guest cart is not a server cart and must be revalidated before any future merge/import flow.
- Cart items are grouped by shop.
- Adding to cart validates product and variant availability.
- Cart does not reserve stock.
- Cart prices and stock must be revalidated during checkout.
- Cart can contain items from many shops.

## Item States

- Available
- Quantity changed
- Out of stock
- Product removed
- Shop suspended

## API Surface

- `GET /api/cart`
- `POST /api/cart/items`
- `PATCH /api/cart/items/:itemId`
- `DELETE /api/cart/items/:itemId`
- `POST /api/checkout`

## Frontend Surfaces

- Product detail Add to Cart
- Mini cart confirmation
- Cart page
- Checkout item review

## Edge Cases

- Quantity exceeds stock.
- Product removed after add.
- Variant archived.
- Shop suspended.
- Price changed after add.
- Buyer selects items from multiple shops.

## Acceptance Criteria

- Cart displays shop groups.
- Buyer can select/remove items per item and per shop.
- Checkout CTA only enables for valid selected items.
- Backend revalidates cart before checkout draft creation.
- Guest cart remains available after refresh in the same browser and never exposes a checkout CTA.
