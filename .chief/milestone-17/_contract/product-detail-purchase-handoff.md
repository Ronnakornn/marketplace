# Product Detail Purchase Handoff Contract

## Purpose

Add to cart and Buy now must use existing cart infrastructure safely and give buyers recoverable feedback.

## Add To Cart Contract

- Add to cart requires an authenticated buyer, selected variant, quantity >= 1, and positive selected stock.
- Success must invalidate/refetch buyer cart query keys used by cart and shell surfaces.
- Success must show a readable confirmation with product and variant context where available.
- Errors must be converted into readable messages and must never show raw objects.
- Add to cart must keep the buyer on product detail unless the buyer explicitly chooses to view cart.

## Buy Now Contract

- Buy now uses the same validated selected variant and quantity as Add to cart.
- On success, Buy now routes to `/cart`.
- Buy now must not create checkout, order, payment, or payment-success state directly.
- If add-to-cart fails, Buy now must not navigate away from product detail.

## Auth Contract

- Guest purchase actions route to login with a product detail return path.
- Seller/admin/non-buyer sessions cannot purchase and must see a readable disabled reason.

## Boundaries

- Use existing cart APIs.
- Do not introduce a mini confirmation modal/drawer.
- Do not redesign checkout.
