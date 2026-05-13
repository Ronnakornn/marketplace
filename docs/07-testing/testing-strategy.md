# Testing Strategy

This document defines the marketplace testing strategy across backend, frontend, and end-to-end flows.

## Test Layers

- Unit tests for pure domain logic.
- Integration tests for services, repositories, transactions, and API routes.
- Frontend component tests for UI behavior where practical.
- End-to-end tests for critical buyer/seller/admin journeys.

## Required Commands

```bash
bunx tsc --noEmit
bun run test
```

After Prisma schema changes:

```bash
bun run db:generate
bunx tsc --noEmit
bun run test
```

## Backend Test Priorities

Checkout:
- validates selected cart items
- groups items by shop
- calculates trusted totals
- applies coupons correctly
- reserves stock transactionally
- rolls back reservation on failure
- rejects expired checkout

Payment:
- creates payment intent for payable order
- verifies webhook signature
- enforces webhook idempotency
- marks payment succeeded only from webhook
- commits reserved stock on success
- releases reserved stock on failure/cancel
- does not duplicate shipments on duplicate webhook

Shipping:
- creates shipments by shop after payment success
- restricts seller shipment processing to owned shop
- validates tracking number before marking shipped
- updates shipment status from provider event

Authorization:
- buyer cannot access another buyer order/cart/checkout
- seller cannot access another shop product/inventory/shipment
- admin routes require admin role
- provider webhooks require valid signatures

## Frontend Test Priorities

Buyer:
- home renders product feed fallback/loading/empty states
- search updates URL params and results
- product detail requires variant selection before CTA action
- sticky buy bar remains visible on mobile
- cart groups items by shop
- checkout shows stock/price/shipping errors
- payment return shows pending until trusted status changes
- order detail shows per-shop shipment cards

Seller:
- dashboard shows pending shipments and low stock
- seller orders list renders mobile cards and desktop table
- shipment processing validates carrier/tracking input

Admin:
- user management separates customers and system users
- order monitoring shows payment/shipment exceptions
- admin tables degrade to cards on mobile

## End-to-End MVP Scenarios

1. Browse product -> product detail -> add to cart.
2. Cart with items from two shops -> checkout grouped by shop.
3. Checkout reserves stock -> creates pending order -> opens payment.
4. Payment return page shows pending before webhook.
5. Payment webhook succeeds -> order paid -> shipments created by shop.
6. Seller processes one shipment -> buyer sees partial shipment status.
7. All shipments delivered -> buyer can review.
8. Buyer requests return/refund -> admin reviews case.

## Mocking Rules

- Mock payment provider for integration and E2E tests.
- Mock webhook signatures with deterministic test secrets.
- Mock shipping provider events.
- Use seeded shops, products, variants, inventory, and users for repeatable tests.

## Regression Risks

- Overselling due to non-transactional reservation.
- Payment success from browser redirect.
- Duplicate shipments from duplicate webhook.
- Seller ownership bypass.
- Admin route exposure.
- Product price changes not reflected at checkout.

## Acceptance Checklist

- Critical checkout/payment/shipping paths have integration tests.
- Auth and ownership checks are covered.
- Frontend mobile sticky CTA behavior is verified.
- Payment webhook idempotency is tested.
- Multi-shop cart/order/shipment behavior is tested.
