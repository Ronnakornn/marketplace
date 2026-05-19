# Marketplace Implementation Plan

This document breaks the marketplace ecommerce project into small PR-sized implementation tasks. Follow the order strictly:

1. Prisma schema
2. Auth
3. Catalog
4. Inventory
5. Cart
6. Checkout
7. Payment webhook
8. Order
9. Shipment
10. Seller Center
11. Admin

Before every task, read `AGENTS.md`, `docs/ARCHITECTURE.md`, the relevant domain docs, and this plan. Keep changes PR-sized, add tests, run `bunx tsc --noEmit`, and run `bun run test`.

## Task 1. Prisma Schema Foundation

- **Goal**: Align `prisma/schema.prisma` with the marketplace DB model in `docs/schema.dbml`.
- **Affected files**: `prisma/schema.prisma`, generated Prisma/Prismabox output, migration files, `README.md` if commands need adjustment.
- **Affected modules**: Auth, Seller, Catalog, Inventory, Cart, Checkout, Order, Payment, Shipping, Promotion, Review, Chat, Notification.
- **Database impact**: Adds/updates marketplace enums and tables for users, shops, products, variants, inventory, carts, checkouts, reservations, orders, payments, shipments, coupons, reviews, refunds, returns, chat, notifications.
- **API impact**: No new routes yet; generated model and validation schemas become available.
- **Frontend impact**: No UI changes; future frontend types can infer backend responses.
- **Test cases**:
  - Prisma schema validates.
  - Prisma client and Prismabox schemas generate.
  - Migration applies on a clean database.
- **Acceptance criteria**:
  - All required marketplace models exist with UUID primary keys.
  - Money fields use integer cents.
  - Order item and shipping address snapshot fields exist.
  - Indexes exist for common filters from `docs/schema.dbml`.
  - No manual edits to `generated/`.
- **Codex prompt**:
  ```text
  Read AGENTS.md, docs/schema.dbml, docs/erd.md, docs/ARCHITECTURE.md, and .agents Prisma skills. Update prisma/schema.prisma to match the marketplace schema. Use PostgreSQL, UUID primary keys, enums, relations, integer cents money fields, order item snapshots, address snapshots, and indexes. Run Prisma format/validate, generate client, create a migration, then run typecheck and tests. Do not hand-edit generated files.
  ```

## Task 2. Auth and Authorization Foundation

- **Goal**: Ensure Better Auth users support buyer, active-shop seller, and admin flows with backend auth macros and shop ownership guards.
- **Affected files**: `server/lib/auth*`, `server/lib/auth-plugin*`, `server/context/app-context.ts`, `app/lib/auth-client.ts`, `app/lib/auth-server.ts`, `app/lib/roles.ts`, seed/admin scripts, tests.
- **Affected modules**: Auth, User, Seller, Admin.
- **Database impact**: Uses `User.role` only for `USER`/`ADMIN`; seller access comes from `SellerProfile`, `Shop.ownerId`, active shop status, and later `ShopStaff`.
- **API impact**: Standardizes `{ withAuth: true }`, `{ withRole: "ADMIN" }`, and service-level active shop ownership guards.
- **Frontend impact**: Application/shop-aware redirects and protected page guards for seller/admin entrypoints.
- **Test cases**:
  - Guest can access public catalog routes.
  - Buyer-only route rejects guest.
  - Seller operational route rejects users without an active owned shop.
  - Admin route rejects non-admin.
  - Admin seed promotes configured emails.
- **Acceptance criteria**:
  - No repeated inline auth checks where macros should be used.
  - Role helpers and seller access helpers are centralized.
  - Seller active-shop/admin route protection is test-covered.
- **Codex prompt**:
  ```text
  Read docs/04-security/auth-permissions.md and existing auth code. Implement or tighten auth helpers and active-shop ownership guards for buyer, seller, and admin flows. Keep auth logic centralized, update seed/admin behavior if needed, add authorization tests, then run typecheck and tests.
  ```

## Task 3. Catalog Backend Module

- **Goal**: Implement catalog product listing, detail, categories, and seller product CRUD foundation.
- **Affected files**: `server/modules/catalog/**`, `server/context/app-context.ts`, `server/index.ts`, tests.
- **Affected modules**: Catalog, Seller, Inventory.
- **Database impact**: Uses `Shop`, `Product`, `ProductVariant`, `Inventory`; no schema change expected after Task 1.
- **API impact**:
  - `GET /api/catalog/products`
  - `GET /api/catalog/products/:productId`
  - `GET /api/categories` if category model exists
  - `GET /api/seller/products`
  - `POST /api/seller/products`
  - `PATCH /api/seller/products/:productId`
- **Frontend impact**: Enables marketplace home, product feed, product detail, and seller catalog screens.
- **Test cases**:
  - Public list returns active products only.
  - Product detail includes variants, inventory availability, and shop summary.
  - Seller can create/update own products.
  - Seller cannot update another shop product.
  - Cursor pagination and filters work.
- **Acceptance criteria**:
  - Repository/service/routes follow domain structure.
  - Validation uses generated Prismabox schemas where applicable.
  - No frontend response type duplication.
  - APIs return stable error codes from `api-contracts.md`.
- **Codex prompt**:
  ```text
  Implement the Catalog backend module using ElysiaJS, Prisma, Prismabox/TypeBox, repository and service layers. Follow docs/02-domains/catalog.md and docs/06-backend/api-contracts.md. Add public product list/detail APIs and seller-owned product create/update/list APIs. Mount routes, wire services in app context, add tests for filtering, detail, seller ownership, and validation.
  ```

## Task 4. Catalog Storefront UI

- **Goal**: Connect mobile-first marketplace discovery UI to catalog APIs with mock fallback only when API is empty/unavailable.
- **Affected files**: `app/page.tsx`, `app/features/marketplace/**`, `app/features/catalog/**`, `app/lib/eden.ts`, tests where present.
- **Affected modules**: Marketplace, Catalog frontend.
- **Database impact**: None.
- **API impact**: Consumes catalog APIs from Task 3.
- **Frontend impact**: Home feed, flash sale section, category grid, product grid, product detail entry points.
- **Test cases**:
  - Home renders loading, success, empty/mock fallback, and error states.
  - Product cards format integer cents correctly.
  - Infinite scroll reveal works client-side.
  - Mobile bottom nav and sticky search do not overlap content.
- **Acceptance criteria**:
  - Uses TanStack Query and Eden-inferred types.
  - Uses shadcn/ui and Tailwind-compatible components.
  - Mobile-first layout follows `mobile-wireframes.md`.
- **Codex prompt**:
  ```text
  Implement the marketplace storefront UI using docs/05-frontend/frontend-architecture.md, components.md, mobile-wireframes.md, and design-system.md. Connect to catalog APIs with TanStack Query and Eden types. Keep fallback mock data isolated. Do not implement cart or checkout behavior beyond placeholder CTAs. Run typecheck and tests.
  ```

## Task 5. Inventory Module

- **Goal**: Implement inventory read/update and stock-safe primitives for reservation, commit, and release.
- **Affected files**: `server/modules/inventory/**`, `server/modules/catalog/**` if availability joins are needed, app context, tests.
- **Affected modules**: Inventory, Catalog, Checkout, Payment.
- **Database impact**: Uses `Inventory` and `InventoryReservation`; no schema change expected.
- **API impact**:
  - `PATCH /api/seller/variants/:variantId/inventory`
  - internal service methods for reserve/commit/release.
- **Frontend impact**: Seller inventory can show on-hand, reserved, available, reorder level; product detail can show stock hint.
- **Test cases**:
  - Seller can update own variant inventory.
  - Seller cannot update another shop variant.
  - Available stock derives from on-hand minus reserved.
  - Reservation is transactional and prevents oversell.
  - Commit/release updates quantities correctly.
- **Acceptance criteria**:
  - Inventory writes use transactions.
  - Reservation service is reusable by checkout/payment.
  - Oversell race conditions are covered by tests as far as practical.
- **Codex prompt**:
  ```text
  Implement Inventory domain services and seller inventory API from docs/02-domains/inventory.md. Add transactional reserve, commit, and release methods for checkout/payment use. Enforce seller ownership for inventory edits. Add tests for oversell prevention, reserved quantity, commit/release, and ownership.
  ```

## Task 6. Cart Backend and UI

- **Goal**: Implement buyer cart APIs and mobile cart page grouped by shop.
- **Affected files**: `server/modules/cart/**`, `app/features/cart/**`, `app/cart/page.tsx`, app context, route mount, tests.
- **Affected modules**: Cart, Catalog, Inventory, Auth.
- **Database impact**: Uses `Cart`, `CartItem`; may add selected state if schema does not already support it.
- **API impact**:
  - `GET /api/cart`
  - `POST /api/cart/items`
  - `PATCH /api/cart/items/:itemId`
  - `DELETE /api/cart/items/:itemId`
- **Frontend impact**: Cart page, `CartItem`, `ShopGroupedCart`, quantity controls, sticky checkout CTA.
- **Test cases**:
  - Buyer can add active variant to cart.
  - Cart groups items by shop.
  - Quantity update validates positive quantities.
  - Cart reports unavailable/out-of-stock items.
  - Buyer cannot access another buyer cart.
  - UI renders empty, loading, error, and unavailable item states.
- **Acceptance criteria**:
  - Cart does not reserve stock.
  - Checkout CTA only uses valid selected items.
  - Backend revalidates product/variant availability.
- **Codex prompt**:
  ```text
  Implement Cart backend and mobile cart UI using docs/02-domains/cart.md, docs/06-backend/api-contracts.md, and docs/05-frontend/components.md. Use auth for buyer cart, group by shop, validate availability, and do not reserve stock. Add service/repository/routes, hooks, page UI, and tests.
  ```

## Task 7. Checkout Backend

- **Goal**: Implement checkout draft, trusted totals, shipping/coupon selection, stock reservation, and pending order/payment intent handoff.
- **Affected files**: `server/modules/checkout/**`, `server/modules/inventory/**`, `server/modules/order/**` foundation if needed, app context, route mount, tests.
- **Affected modules**: Checkout, Cart, Inventory, Promotion, Order, Payment.
- **Database impact**: Uses `Checkout`, `InventoryReservation`, `Order`; may require address fields or checkout selection fields if missing.
- **API impact**:
  - `POST /api/checkout`
  - `PATCH /api/checkout/:checkoutId`
  - `POST /api/checkout/:checkoutId/reserve`
  - `POST /api/checkout/:checkoutId/place-order`
  - payment intent call can be stubbed until Task 8.
- **Frontend impact**: Enables checkout page integration in the next task.
- **Test cases**:
  - Creates checkout from selected cart items.
  - Groups checkout items by shop.
  - Recalculates trusted totals.
  - Rejects missing address/shipping/payment method.
  - Reserves stock transactionally.
  - Reservation failure returns per-item errors.
  - Place order creates pending order only after reservation.
- **Acceptance criteria**:
  - Checkout never trusts client prices.
  - Reservation has expiry.
  - Pending order has item/address snapshots.
  - No payment success logic is implemented here.
- **Codex prompt**:
  ```text
  Implement Checkout backend from docs/02-domains/checkout.md, docs/checkout-flow.md, and docs/03-state-machines/order-payment-shipment.md. Add checkout draft/update/reserve/place-order APIs with trusted total calculation, shop grouping, inventory reservation, and pending order snapshot creation. Add transaction and validation tests.
  ```

## Task 8. Checkout UI

- **Goal**: Implement single-page mobile checkout connected to checkout APIs.
- **Affected files**: `app/features/checkout/**`, `app/checkout/page.tsx`, `app/features/cart/**` integration, tests.
- **Affected modules**: Checkout frontend, Cart frontend, Order frontend.
- **Database impact**: None.
- **API impact**: Consumes checkout APIs from Task 7.
- **Frontend impact**: Address selector, shipping per shop, coupon selector, payment method selector, checkout summary, reservation timer, sticky Place Order CTA.
- **Test cases**:
  - Missing address blocks place order.
  - Per-shop shipping selection updates totals.
  - Coupon ineligible reason renders.
  - Reservation failure shows item-level errors.
  - Sticky CTA does not overlap content.
- **Acceptance criteria**:
  - Single-page mobile checkout.
  - Uses TanStack Query mutations and invalidations.
  - Shows backend validation errors before payment.
  - Does not infer payment success.
- **Codex prompt**:
  ```text
  Build the mobile checkout UI from docs/05-frontend/mobile-wireframes.md, components.md, page-specs.md, and frontend-architecture.md. Connect to checkout APIs with Eden/TanStack Query. Implement address, shop shipping, coupon, payment method, totals, reservation timer, sticky CTA, and loading/error states. Do not implement payment webhook logic.
  ```

## Task 9. Payment Webhook Module

- **Goal**: Implement payment intent records and provider webhook handling with idempotent success/failure transitions.
- **Affected files**: `server/modules/payment/**`, `server/modules/inventory/**`, `server/modules/shipping/**` foundation if needed, app context, route mount, env docs/tests.
- **Affected modules**: Payment, Checkout, Inventory, Order, Shipment.
- **Database impact**: Uses `Payment`, `PaymentEvent`, `InventoryReservation`, `Order`, `Shipment`.
- **API impact**:
  - `POST /api/payments/:orderId/intent`
  - `POST /api/payments/webhook`
  - `GET /api/orders/:orderId/payment-status`
- **Frontend impact**: Payment return page can poll trusted status.
- **Test cases**:
  - Creates payment intent for payable pending order.
  - Rejects invalid webhook signature.
  - Processes success webhook once.
  - Duplicate success webhook is no-op.
  - Success marks order paid, commits stock, creates shipments by shop.
  - Failure releases reservation and marks payment failed/canceled.
- **Acceptance criteria**:
  - Browser return cannot mark success.
  - Webhook event id is unique/idempotent.
  - Stock and shipment side effects happen transactionally.
- **Codex prompt**:
  ```text
  Implement Payment module from docs/02-domains/payment.md and docs/03-state-machines/order-payment-shipment.md. Add payment intent creation, signed webhook verification, provider event idempotency, trusted payment status API, stock commit/release, and shipment creation by shop after success. Add tests for duplicate webhook, invalid signature, success, and failure.
  ```

## Task 10. Order Backend and Buyer UI

- **Goal**: Implement buyer order list/detail and payment return page using trusted order/payment/shipment state.
- **Affected files**: `server/modules/order/**`, `app/features/order/**`, `app/orders/**`, `app/payment/return/page.tsx`, tests.
- **Affected modules**: Order, Payment, Shipment, Review, Return.
- **Database impact**: Uses `Order`, `OrderItem`, `Payment`, `Shipment`, `ShipmentItem`, `Review`, `ReturnRequest`.
- **API impact**:
  - `GET /api/orders`
  - `GET /api/orders/:orderId`
  - `GET /api/orders/:orderId/payment-status`
- **Frontend impact**: Orders page, order detail/tracking, payment pending/result.
- **Test cases**:
  - Buyer only sees own orders.
  - Order detail includes item/address snapshots.
  - Order detail groups shipments by shop.
  - Payment return polls and shows pending until backend status changes.
  - UI handles pending, paid, partially fulfilled, fulfilled, canceled, refunded.
- **Acceptance criteria**:
  - Payment success is never inferred from URL.
  - Order and shipment statuses are displayed separately.
  - Historical snapshots render instead of live product fields.
- **Codex prompt**:
  ```text
  Implement Order backend APIs and buyer order UI from docs/02-domains/order.md, docs/05-frontend/page-specs.md, and docs/03-state-machines/order-payment-shipment.md. Add order list/detail with snapshots and shipment cards, plus payment return polling against trusted payment status. Add ownership and UI state tests.
  ```

## Task 11. Shipment Module

- **Goal**: Implement seller shipment queues, shipment processing, tracking updates, and buyer tracking integration.
- **Affected files**: `server/modules/shipping/**`, `server/modules/seller/**` if shipment routes are grouped there, `app/features/seller/**`, `app/features/order/**`, tests.
- **Affected modules**: Shipping, Seller, Order, Notification.
- **Database impact**: Uses `Shipment`, `ShipmentItem`, `OrderItem`; no schema change expected.
- **API impact**:
  - `GET /api/seller/shipments`
  - `POST /api/seller/shipments/:shipmentId/ship`
  - `POST /api/shipping/webhook`
- **Frontend impact**: Seller order processing and buyer shipment tracker.
- **Test cases**:
  - Seller sees only own shop shipments.
  - Mark shipped requires carrier/tracking.
  - Shipment status updates to shipped.
  - Shipping webhook updates delivered status idempotently.
  - Order status updates when all shipments are delivered.
- **Acceptance criteria**:
  - Shipment processing is shop-scoped.
  - Shipment item quantities are respected.
  - Buyer order detail shows per-shop tracking.
- **Codex prompt**:
  ```text
  Implement Shipping/Shipment module from docs/02-domains/shipping.md and fulfillment-flow.md. Add seller shipment queue, mark-shipped API, shipping webhook idempotency, and buyer tracking integration. Enforce seller ownership and add tests for tracking, delivery, and order status updates.
  ```

## Task 12. Seller Center Foundation

- **Goal**: Build seller onboarding/status plus dashboard, product management, inventory management, and order processing UI around existing seller APIs.
- **Affected files**: `app/seller/**`, `app/features/seller/**`, `app/features/catalog/**`, `app/features/inventory/**`, tests.
- **Affected modules**: Seller, Catalog, Inventory, Shipping.
- **Database impact**: None unless missing seller/shop metadata is discovered.
- **API impact**: Consumes seller APIs implemented in earlier tasks.
- **Frontend impact**: Seller Center pages, mobile tabs/cards, desktop management layouts.
- **Test cases**:
  - Seller dashboard renders pending shipments and low stock.
  - Product list handles draft/active/archived/rejected.
  - Inventory editor shows on-hand/reserved/available.
  - Shipment processing form validates tracking.
  - User without active shop cannot access operational seller UI.
  - Pending/rejected application can access status but not seller operations.
- **Acceptance criteria**:
  - Seller operational pages are active-shop protected.
  - Seller onboarding/status pages work for authenticated buyer accounts.
  - Seller UI never exposes another shop resources.
  - Mobile views use cards; desktop can use tables.
- **Codex prompt**:
  ```text
  Implement Seller Center UI from docs/02-domains/seller.md, docs/05-frontend/components.md, page-specs.md, and frontend-architecture.md. Build dashboard, products, inventory, and shipment processing pages using existing seller APIs. Use shadcn/ui, Tailwind, TanStack Query, mobile-first layouts, and tests for role/empty/loading/error states.
  ```

## Task 13. Admin Foundation

- **Goal**: Build admin dashboard and management pages for users, shops, product moderation, orders, refunds, commissions, and reports.
- **Affected files**: `server/modules/admin/**`, `app/admin/**`, `app/features/admin/**`, user/admin feature files, tests.
- **Affected modules**: Admin, User, Seller, Catalog, Order, Payment, Shipping, Refund.
- **Database impact**: Uses existing marketplace models; may add audit fields later if required.
- **API impact**:
  - `GET /api/admin/dashboard`
  - `GET /api/admin/users`
  - `GET /api/admin/shops`
  - `PATCH /api/admin/shops/:shopId/status`
  - `GET /api/admin/products/moderation`
  - `PATCH /api/admin/products/:productId/moderation`
  - `GET /api/admin/orders`
  - `GET /api/admin/reports`
  - `POST /api/admin/returns/:returnId/decision`
- **Frontend impact**: Admin full-screen management UI and mobile card fallback.
- **Test cases**:
  - Admin-only route protection.
  - User list separates customers and system users.
  - Shop status update requires admin.
  - Product moderation approve/reject works.
  - Order monitoring filters payment/shipment exceptions.
  - Non-admin cannot access admin APIs/UI.
- **Acceptance criteria**:
  - Admin pages are protected with admin role.
  - Management lists have loading, empty, error states.
  - Exception-first dashboard supports operational work.
  - Admin mutations use stable error handling and reason fields where needed.
- **Codex prompt**:
  ```text
  Implement Admin backend APIs and UI from docs/02-domains/admin.md, docs/04-security/auth-permissions.md, docs/05-frontend/page-specs.md, and docs/06-backend/api-contracts.md. Build dashboard, users, shops, moderation, orders, refunds, commissions, and reports incrementally. Enforce admin role, use shadcn data tables/cards, add tests for protection and core mutations.
  ```

## Task 14. Final Integration and Production Readiness Pass

- **Goal**: Verify cross-domain flows, documentation, tests, and production readiness after core domains are implemented.
- **Affected files**: docs, tests, seed/mock scripts, CI/build config if present.
- **Affected modules**: All.
- **Database impact**: No new schema unless gaps are discovered.
- **API impact**: Stabilizes contracts and error codes.
- **Frontend impact**: Stabilizes navigation, loading/error states, and mobile layout.
- **Test cases**:
  - Full buyer journey: browse -> cart -> checkout -> payment webhook -> order tracking.
  - Multi-shop order creates multiple shipments.
  - Seller processes own shipment.
  - Admin monitors order/refund exceptions.
  - Payment duplicate webhook does not duplicate side effects.
- **Acceptance criteria**:
  - `bunx tsc --noEmit` passes.
  - `bun run test` passes.
  - Docs match implemented APIs and routes.
  - Critical flows are covered by integration or E2E tests.
- **Codex prompt**:
  ```text
  Perform a final marketplace integration pass. Read AGENTS.md and all docs. Verify buyer, seller, admin, checkout, payment webhook, shipment, and authorization flows. Add missing integration/E2E tests, update docs where implementation differs, run typecheck/build/tests, and fix only issues directly related to marketplace readiness.
  ```

## Implementation Guardrails

- Keep each PR small and focused on one task.
- Do not implement later domains inside earlier tasks except minimal stubs required for integration.
- Do not trust client-provided prices, stock, payment status, or ownership.
- Do not mark payment success outside verified webhook handling.
- Keep seller and admin authorization server-enforced.
- Prefer backend service tests for business rules and frontend tests for critical rendering/interaction states.
- Update docs whenever route contracts, status transitions, or architecture conventions change.
