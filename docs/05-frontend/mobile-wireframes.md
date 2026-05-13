# Mobile-First Wireframes

These wireframes define implementation-ready mobile layouts for a Shopee/Lazada-style marketplace. They are intentionally low fidelity and focus on hierarchy, sticky controls, states, and data dependencies.

Design baseline:
- Primary mobile widths: 360px and 430px.
- Tap targets: at least 44px tall.
- Fixed bottom UI must account for safe-area inset and page bottom padding.
- Product feeds use skeleton loading and infinite scroll.
- Critical pages keep the primary CTA visible without forcing the buyer to hunt for it.

## Buyer Home

Purpose: drive fast discovery and product entry.

```text
┌──────────────────────────────┐
│ Sticky search + cart/account │
├──────────────────────────────┤
│ Voucher strip / promo chips  │
├──────────────────────────────┤
│ Swipe banner carousel        │
├──────────────────────────────┤
│ Flash sale header + timer    │
│ [Product][Product][Product]  │
├──────────────────────────────┤
│ Category grid 4 x 2          │
│ [Icon] [Icon] [Icon] [Icon]  │
│ [Icon] [Icon] [Icon] [Icon]  │
├──────────────────────────────┤
│ Recommended for you          │
│ [Card] [Card]                │
│ [Card] [Card]                │
│ ... infinite scroll          │
├──────────────────────────────┤
│ Fixed bottom nav             │
└──────────────────────────────┘
```

Sticky/fixed elements:
- Sticky top compact search bar.
- Fixed bottom navigation: Home, Categories, Deals, Cart, Account.

Primary CTA:
- Product card tap opens product detail.
- Flash sale cards emphasize discount and urgency.

States:
- Loading: skeleton banner, category icons, flash sale row, product grid.
- Empty: show category shortcuts and popular products fallback.
- Error: retry module while preserving navigation.
- Infinite scroll: append skeleton row near bottom.

API dependencies:
- `GET /api/categories`
- `GET /api/catalog/products`

Conversion notes:
- Keep first product cards visible above the fold after promo/category content.
- Avoid large hero blocks that push products too far down.

## Search Results

Purpose: help buyers narrow intent quickly.

```text
┌──────────────────────────────┐
│ Back | Search input | Clear  │
├──────────────────────────────┤
│ Sort chips: Relevant Sales $ │
├──────────────────────────────┤
│ Filter bar: Category Price   │
├──────────────────────────────┤
│ Results grid                 │
│ [Card] [Card]                │
│ [Card] [Card]                │
│ ... infinite scroll          │
├──────────────────────────────┤
│ Fixed bottom nav             │
└──────────────────────────────┘
```

Sticky/fixed elements:
- Search input stays sticky at top.
- Filter bottom sheet opens over current results.

Primary CTA:
- Open product detail.

States:
- No query: recent searches, trending keywords, popular categories.
- Loading: product grid skeleton.
- Empty: suggest removing filters and show popular categories.
- Error: retry search.

API dependencies:
- `GET /api/search/suggestions`
- `GET /api/catalog/products`

Conversion notes:
- Sorting is one tap.
- Filter choices should not navigate away from the result list.

## Category Product List

Purpose: let buyers browse category-specific products with minimal friction.

```text
┌──────────────────────────────┐
│ Back | Category search       │
├──────────────────────────────┤
│ Category title + subchips    │
├──────────────────────────────┤
│ Sort + Filter controls       │
├──────────────────────────────┤
│ Product grid                 │
│ [Card] [Card]                │
│ [Card] [Card]                │
│ ... infinite scroll          │
├──────────────────────────────┤
│ Fixed bottom nav             │
└──────────────────────────────┘
```

Sticky/fixed elements:
- Compact category search/header.
- Fixed buyer bottom nav.

Primary CTA:
- Open product detail.

States:
- Loading: category header and grid skeleton.
- Empty category: show sibling categories.
- Filtered empty: clear filter CTA.

API dependencies:
- `GET /api/categories`
- `GET /api/catalog/products?categoryId=...`

Conversion notes:
- Category title should not consume excessive vertical space.
- Keep subcategory chips horizontally scrollable.

## Product Detail

Purpose: convert evaluation into Add to Cart or Buy Now.

```text
┌──────────────────────────────┐
│ Back | Search | Share/Cart   │
├──────────────────────────────┤
│ Product image carousel       │
├──────────────────────────────┤
│ Price + discount + timer     │
│ Product title, rating, sold  │
├──────────────────────────────┤
│ Variant selector             │
│ Shipping estimate            │
├──────────────────────────────┤
│ Shop card + Chat             │
├──────────────────────────────┤
│ Reviews summary              │
├──────────────────────────────┤
│ Description / specs          │
├──────────────────────────────┤
│ More recommendations         │
├──────────────────────────────┤
│ Sticky: Add to Cart | Buy Now│
└──────────────────────────────┘
```

Sticky/fixed elements:
- Sticky bottom CTA replaces bottom navigation.
- CTA contains Add to Cart and Buy Now, above safe-area bottom.

Primary CTA:
- Add to Cart.
- Buy Now.

States:
- Loading: image, price, title, shop, reviews skeleton.
- Variant required: open variant picker bottom sheet.
- Out of stock: disable Buy Now, allow notify/favorite if supported later.
- Add success: mini cart confirmation with View Cart.
- Error: retry product detail.

API dependencies:
- `GET /api/catalog/products/:productId`
- `GET /api/products/:productId/reviews`
- `POST /api/cart/items`
- `POST /api/checkout` for Buy Now draft

Conversion notes:
- Price and CTA must be visible quickly.
- Variant picker should confirm selection without losing scroll context.

## Cart

Purpose: prepare selected items for checkout while preserving shop grouping.

```text
┌──────────────────────────────┐
│ Cart title | Edit            │
├──────────────────────────────┤
│ Shop A checkbox + voucher    │
│  [Item row + qty + price]    │
│  [Item row + qty + price]    │
│  Shop subtotal / shipping    │
├──────────────────────────────┤
│ Shop B checkbox + voucher    │
│  [Item row + qty + price]    │
├──────────────────────────────┤
│ Availability warnings        │
├──────────────────────────────┤
│ Sticky total + Checkout CTA  │
├──────────────────────────────┤
│ Fixed bottom nav             │
└──────────────────────────────┘
```

Sticky/fixed elements:
- Sticky bottom selected total and checkout CTA.
- Bottom nav remains visible below or is replaced by checkout-focused CTA depending on viewport height.

Primary CTA:
- Checkout selected.

States:
- Empty: continue shopping CTA.
- Quantity exceeds stock: inline item error and quantity adjust action.
- Product removed: item disabled with remove action.
- Shop unavailable: shop group disabled.

API dependencies:
- `GET /api/cart`
- `PATCH /api/cart/items/:itemId`
- `DELETE /api/cart/items/:itemId`
- `POST /api/checkout`

Conversion notes:
- Show total for selected items only.
- Keep checkout CTA enabled only when at least one valid item is selected.

## Single-Page Checkout

Purpose: finish checkout quickly while validating stock and trusted totals.

```text
┌──────────────────────────────┐
│ Checkout title               │
├──────────────────────────────┤
│ Address card                 │
├──────────────────────────────┤
│ Shop A items                 │
│ Shipping method selector     │
├──────────────────────────────┤
│ Shop B items                 │
│ Shipping method selector     │
├──────────────────────────────┤
│ Coupon / voucher             │
├──────────────────────────────┤
│ Payment method               │
├──────────────────────────────┤
│ Totals breakdown             │
│ Reservation timer            │
├──────────────────────────────┤
│ Sticky Place Order CTA       │
└──────────────────────────────┘
```

Sticky/fixed elements:
- Sticky bottom Place Order CTA with final total.
- No buyer bottom nav.

Primary CTA:
- Place order.

States:
- Calculating: totals skeleton.
- Address missing: block CTA and show address action.
- Reservation failed: show per-item stock errors and return to cart.
- Price changed: show changed items and require buyer acknowledgement.
- Payment intent failed: retry payment creation.

API dependencies:
- `POST /api/checkout`
- `PATCH /api/checkout/:checkoutId`
- `POST /api/checkout/:checkoutId/reserve`
- `POST /api/checkout/:checkoutId/place-order`
- `POST /api/payments/:orderId/intent`

Conversion notes:
- Keep all checkout decisions on one page.
- Use collapsible shop sections only when item count is high.
- Reservation timer should be visible after stock is reserved.

## Payment Pending / Result

Purpose: handle gateway return without trusting client-side success.

```text
┌──────────────────────────────┐
│ Payment status               │
├──────────────────────────────┤
│ Pending animation/skeleton   │
│ Waiting for confirmation     │
├──────────────────────────────┤
│ Order number                 │
│ Payment method               │
├──────────────────────────────┤
│ Status explanation           │
├──────────────────────────────┤
│ Sticky: View order / Retry   │
└──────────────────────────────┘
```

Sticky/fixed elements:
- Sticky bottom action area.
- No bottom nav until final status is known.

Primary CTA:
- Pending: View order.
- Failed: Retry payment or return to checkout.
- Confirmed: Track order.

States:
- Pending webhook: poll trusted status.
- Succeeded: show confirmed and route to order detail.
- Failed/canceled: show retry and stock reservation outcome.

API dependencies:
- `GET /api/orders/:orderId/payment-status`
- `GET /api/orders/:orderId`

Conversion notes:
- Do not show payment success from URL params.
- Explain pending state plainly so buyers do not duplicate payment.

## Order Detail / Tracking

Purpose: show order and shipment status clearly across shops.

```text
┌──────────────────────────────┐
│ Order status header          │
│ Payment status               │
├──────────────────────────────┤
│ Shipment card: Shop A        │
│ Status + tracking timeline   │
│ Items in this shipment       │
├──────────────────────────────┤
│ Shipment card: Shop B        │
│ Status + tracking timeline   │
│ Items in this shipment       │
├──────────────────────────────┤
│ Order summary                │
├──────────────────────────────┤
│ Actions: Chat / Return/Review│
├──────────────────────────────┤
│ Fixed bottom nav             │
└──────────────────────────────┘
```

Sticky/fixed elements:
- Bottom nav may remain visible.
- Contextual CTA appears near eligible shipment/item groups.

Primary CTA:
- Track shipment while in transit.
- Review after delivered.
- Request return/refund when eligible.

States:
- Pending payment.
- Paid, waiting for sellers.
- Partially shipped.
- Delivered.
- Return requested.
- Refunded.

API dependencies:
- `GET /api/orders/:orderId`
- `POST /api/orders/:orderId/reviews`
- `POST /api/orders/:orderId/returns`

Conversion notes:
- Separate order-level status from shipment-level status.
- Use shop names in shipment cards to reduce confusion.

## Return Request

Purpose: let buyers request return/refund for eligible items with minimal support friction.

```text
┌──────────────────────────────┐
│ Return/refund title          │
├──────────────────────────────┤
│ Eligible item selector       │
├──────────────────────────────┤
│ Reason selector              │
├──────────────────────────────┤
│ Quantity / refund amount     │
├──────────────────────────────┤
│ Evidence upload placeholder  │
├──────────────────────────────┤
│ Notes field                  │
├──────────────────────────────┤
│ Sticky Submit Request CTA    │
└──────────────────────────────┘
```

Sticky/fixed elements:
- Sticky submit CTA.
- No bottom nav.

Primary CTA:
- Submit return/refund request.

States:
- No eligible items.
- Missing reason/evidence.
- Submit pending.
- Submitted success with case status.

API dependencies:
- `GET /api/orders/:orderId`
- `POST /api/orders/:orderId/returns`

Conversion notes:
- Keep refund amount visible before submit.
- Make seller/admin review status clear after submission.

## Seller Dashboard

Purpose: help sellers act on operational priorities quickly.

```text
┌──────────────────────────────┐
│ Seller shop header           │
├──────────────────────────────┤
│ KPI row: Sales Orders Chats  │
├──────────────────────────────┤
│ Alert: pending shipments     │
├──────────────────────────────┤
│ Alert: low-stock variants    │
├──────────────────────────────┤
│ Product/moderation status    │
├──────────────────────────────┤
│ Seller mobile nav            │
└──────────────────────────────┘
```

Primary CTA:
- Process pending shipments.

States:
- Shop verification pending.
- Suspended shop.
- Empty shop setup.
- Loading dashboard metrics.

API dependencies:
- `GET /api/seller/dashboard`

## Seller Product Management

Purpose: manage product content, variants, and publication state.

```text
┌──────────────────────────────┐
│ Products title | Create      │
├──────────────────────────────┤
│ Status tabs                  │
├──────────────────────────────┤
│ Search/filter products       │
├──────────────────────────────┤
│ Product row/card             │
│ image title status stock     │
├──────────────────────────────┤
│ Product row/card             │
├──────────────────────────────┤
│ Seller mobile nav            │
└──────────────────────────────┘
```

Primary CTA:
- Create product.
- Edit product.

States:
- Empty product list.
- Draft.
- Active.
- Archived.
- Rejected by moderation.

API dependencies:
- `GET /api/seller/products`
- `POST /api/seller/products`
- `PATCH /api/seller/products/:productId`

## Seller Order Processing

Purpose: process shop-owned shipments created from paid orders.

```text
┌──────────────────────────────┐
│ Shipment detail              │
├──────────────────────────────┤
│ Buyer/order summary          │
├──────────────────────────────┤
│ Pick/pack item checklist     │
├──────────────────────────────┤
│ Carrier + tracking input     │
├──────────────────────────────┤
│ Notes / exception actions    │
├──────────────────────────────┤
│ Sticky Mark Shipped CTA      │
└──────────────────────────────┘
```

Sticky/fixed elements:
- Sticky Mark Shipped CTA.

Primary CTA:
- Mark shipped.

States:
- Ready to ship.
- Partially packed.
- Tracking missing.
- Shipped.
- Canceled/refunded.

API dependencies:
- `GET /api/seller/shipments`
- `POST /api/seller/shipments/:shipmentId/ship`

## Admin Dashboard

Purpose: surface marketplace exceptions and operational health.

```text
┌──────────────────────────────┐
│ Admin dashboard header       │
├──────────────────────────────┤
│ Exception cards              │
│ payments shipments refunds   │
├──────────────────────────────┤
│ Moderation queue summary     │
├──────────────────────────────┤
│ Sales/order metrics          │
├──────────────────────────────┤
│ Admin nav                    │
└──────────────────────────────┘
```

Primary CTA:
- Review highest priority exception.

States:
- Loading metrics.
- No exceptions.
- API error with retry.

API dependencies:
- `GET /api/admin/dashboard`

## Admin User Management

Purpose: manage customers and system users separately.

```text
┌──────────────────────────────┐
│ User management title        │
├──────────────────────────────┤
│ Segmented tabs               │
│ Customers | System users     │
├──────────────────────────────┤
│ Search + role/status filters │
├──────────────────────────────┤
│ User row/card                │
│ name email role status       │
├──────────────────────────────┤
│ Admin nav                    │
└──────────────────────────────┘
```

Primary CTA:
- Update role/status.

States:
- Empty customer list.
- Empty system user list.
- Suspended user.
- Save pending.

API dependencies:
- `GET /api/admin/users`

## Admin Order Monitoring

Purpose: inspect order, payment, shipment, and refund issues.

```text
┌──────────────────────────────┐
│ Order monitoring title       │
├──────────────────────────────┤
│ Exception filters            │
│ Payment Shipment Refund      │
├──────────────────────────────┤
│ Search order/user/shop       │
├──────────────────────────────┤
│ Order card                   │
│ status payment shipments     │
├──────────────────────────────┤
│ Order card                   │
├──────────────────────────────┤
│ Admin nav                    │
└──────────────────────────────┘
```

Primary CTA:
- Inspect order.

States:
- Payment pending too long.
- Webhook failed.
- Shipment delayed.
- Refund escalation.
- No matching orders.

API dependencies:
- `GET /api/admin/orders`
- `GET /api/orders/:orderId`

## Shared Layout Rules

- Add bottom padding to any page with fixed bottom nav or sticky CTA.
- Do not stack bottom nav and CTA in a way that hides content; checkout and product detail prioritize CTA.
- Use skeletons that match final card dimensions to avoid layout shift.
- Use infinite scroll only for browse feeds and product lists, not for checkout or operational decision pages.
- Keep destructive or irreversible admin/seller actions behind confirmation patterns in implementation.
