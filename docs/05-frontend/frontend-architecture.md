# Frontend Architecture

This document defines the frontend architecture for the mobile-first marketplace UI. It complements:
- [User Flow](./user-flow.md)
- [Sitemap](./sitemap.md)
- [Mobile-First Wireframes](./mobile-wireframes.md)
- [Components](./components.md)

The frontend uses Next.js App Router, feature-based modules, TanStack Query, Tailwind CSS, and shadcn/ui. The UI must stay optimized for marketplace conversion: fast discovery, sticky CTAs, quick checkout, clear order status, and mobile-first layouts.

## Core Rules

- Keep routes in the Next.js App Router under `app/`.
- Keep domain feature code under `app/features/<domain>/`.
- Keep reusable app chrome and shared non-domain components under `app/components/`.
- Keep shadcn/ui primitives under `app/components/ui/`.
- Keep API calls same-origin through `/api/*`; Next.js rewrites proxy requests to the Elysia API.
- Use Eden Treaty and TanStack Query for typed server state.
- Do not duplicate backend response types on the frontend.
- Do not put marketplace business rules or trusted calculations in UI components.

## Routing Structure

Routes live under `app/` and should stay thin. A route should assemble feature components, enforce route-level layout, and pass route/search params into feature hooks or server helpers.

Recommended buyer routes:

```txt
app/
  page.tsx                         # Marketplace home
  search/page.tsx                  # Search entry/results
  categories/page.tsx              # Category index
  categories/[slug]/page.tsx       # Category product feed
  deals/page.tsx                   # Campaign/deals feed
  products/[productId]/page.tsx    # Product detail
  cart/page.tsx                    # Cart grouped by shop
  checkout/page.tsx                # Single-page checkout
  payment/return/page.tsx          # Payment pending/result
  orders/page.tsx                  # Buyer orders
  orders/[orderId]/page.tsx        # Order tracking
  account/page.tsx                 # Buyer account
```

Recommended seller routes:

```txt
app/
  seller/page.tsx
  seller/products/page.tsx
  seller/products/new/page.tsx
  seller/products/[productId]/page.tsx
  seller/inventory/page.tsx
  seller/orders/page.tsx
  seller/orders/[shipmentId]/page.tsx
  seller/shipping/page.tsx
  seller/finance/page.tsx
  seller/promotions/page.tsx
  seller/chat/page.tsx
```

Recommended admin routes:

```txt
app/
  admin/page.tsx
  admin/users/page.tsx
  admin/shops/page.tsx
  admin/products/page.tsx
  admin/orders/page.tsx
  admin/refunds/page.tsx
  admin/commissions/page.tsx
  admin/reports/page.tsx
```

Current routes may be implemented incrementally. New pages should follow the sitemap and wireframes before adding page-specific abstractions.

## Feature Folder Structure

Feature modules should group domain UI, hooks, query definitions, and presentation helpers. Keep each feature small and focused.

Recommended feature shape:

```txt
app/features/<domain>/
  components/
  hooks/
  queries/
  types/
  utils/
  index.ts
```

Folder rules:
- `components/`: domain-specific React components.
- `hooks/`: domain hooks that compose TanStack Query, URL params, or local UI state.
- `queries/`: query keys and query option helpers when a feature has multiple data dependencies.
- `types/`: UI-only types only; do not recreate backend DTOs.
- `utils/`: presentation helpers such as money formatting or UI mapping when not shared globally.
- `index.ts`: public exports for page-level imports.

Recommended domains:

```txt
app/features/
  marketplace/   # Home, search, categories, product feed, product detail UI
  cart/          # Cart grouped by shop
  checkout/      # Checkout, address, shipping, coupon, payment method UI
  order/         # Orders, shipment tracking, reviews, returns/refunds
  seller/        # Seller dashboard, products, inventory, shipments
  admin/         # Admin dashboard and management pages
  auth/          # Login/signup/session UI
  user/          # User/account/admin-user management UI
  catalog/       # Catalog management and product admin UI
```

Existing features such as `admin`, `auth`, `catalog`, `home`, `marketplace`, and `user` should be kept stable while new marketplace domains are added incrementally.

## Shared Components

Shared components must be reusable without owning business logic.

Use `app/components/ui/` for shadcn/ui primitives:
- `Button`
- `Card`
- `Badge`
- `Input`
- `Sheet`
- `Dialog`
- `Tabs`
- `Table`
- `Skeleton`
- `Checkbox`
- `RadioGroup`
- `Select`
- `Toast/Sonner`

Use `app/components/` for app-level reusable UI:
- app shell
- header/footer
- theme toggle
- shared chrome
- generic empty/error/loading wrappers

Use feature folders for domain components:
- `ProductCard` belongs in marketplace/catalog domain.
- `CartItem` belongs in cart domain.
- `CheckoutSummary` belongs in checkout domain.
- `ShipmentTracker` belongs in order/shipping domain.
- `SellerOrdersTable` belongs in seller domain.
- `AdminOrderMonitorCard` belongs in admin domain.

Shared components should accept data as props and emit events through callbacks. They should not fetch data directly unless they are intentionally documented as a feature-level connected component.

## Server and Client Component Rules

Default to Server Components for:
- route pages that only compose static layout or server-readable params
- layouts
- metadata
- non-interactive content
- initial shell composition

Use Client Components for:
- TanStack Query hooks
- forms and mutations
- search input behavior
- filter/sort sheets
- drawers, dialogs, tabs, carousels, and menus
- sticky buy/checkout bars
- infinite scroll observers
- browser-only APIs
- optimistic UI
- polling payment/order status

Boundary rules:
- Put `"use client"` at the smallest useful component boundary.
- Do not mark an entire route as client-only just because one child is interactive.
- Keep server-only auth/session helpers out of Client Components.
- Keep business validation in backend APIs and show backend errors in the UI.

## API Integration Patterns

Browser requests should use same-origin `/api/*` routes. Next.js rewrites proxy these calls to the Elysia server.

Use Eden Treaty for API type inference wherever available:
- frontend hooks should infer response and mutation types from the API client
- do not duplicate backend response interfaces manually
- UI-only view models are allowed when they adapt server data for presentation

Use TanStack Query for server state:
- product feeds
- category lists
- cart state
- checkout draft and totals
- payment status polling
- orders and shipment tracking
- seller dashboards and shipment queues
- admin management lists

Keep query keys domain-scoped and stable:

```txt
catalog.products(filters)
catalog.product(productId)
cart.current()
checkout.detail(checkoutId)
orders.list(filters)
orders.detail(orderId)
seller.shipments(filters)
admin.orders(filters)
```

Mutation rules:
- Invalidate only related query keys after successful mutations.
- Use optimistic UI only for reversible, low-risk interactions such as cart selection or local quantity changes.
- Do not optimistically mark payment success, order paid, stock committed, shipment delivered, refund succeeded, or admin moderation final states.
- Show backend validation errors at the item/shop/section level when possible.

Payment rule:
- The payment return page must show pending until trusted backend status changes.
- Browser redirect parameters are not proof of success.
- Payment success must come from verified webhook-backed backend state.

## Loading and Error Handling

Use route-level `loading.tsx` when the entire route needs a shell-level fallback. Use component-level skeletons for sections inside already-mounted pages.

Required loading states:
- home feed skeleton
- product grid skeleton
- product detail skeleton
- cart shop group skeleton
- checkout totals skeleton
- payment pending state
- order tracking timeline skeleton
- seller table/card skeleton
- admin table/card skeleton

Required empty states:
- no search results
- empty category
- empty cart
- no orders
- no seller products
- no seller shipments
- no admin records for selected filters

Required error states:
- section-level retry for feed/search failures
- item-level cart availability errors
- shop-level checkout shipping errors
- reservation failed state with return-to-cart action
- payment failed/canceled state with retry action
- admin/seller mutation failure with clear recovery action

Mobile fixed UI rules:
- Pages with fixed bottom nav or sticky CTA must include bottom padding.
- Product detail uses `StickyBuyBar` instead of bottom nav.
- Cart and checkout use sticky checkout summary/action bars.
- Payment return avoids competing navigation until status is clear.

## State Management Rules

Use TanStack Query for remote server state:
- API results
- mutation status
- cache invalidation
- polling
- background refetch

Use URL search params for shareable state:
- search keyword
- category slug
- sort
- filters
- pagination cursor when it must be shareable

Use local React state for transient UI:
- open/closed sheets and dialogs
- selected variant before add-to-cart
- selected filter draft before applying
- visible product batch for mock/incremental reveal
- active carousel slide
- form field draft before submit

Use form state for user input:
- address forms
- coupon entry
- return/refund request forms
- seller product editing
- seller tracking input
- admin decision reason fields

Avoid global client stores until there is a clear cross-route need. Cart, auth, order, payment, seller, and admin state should come from the server through typed hooks.

## Mobile-First UI Rules

- Design and test at 360px and 430px first.
- Use 44px minimum tap targets.
- Keep search reachable near the top of discovery pages.
- Keep primary CTAs visible on product detail, cart, checkout, payment pending, return request, and seller shipment processing.
- Use bottom sheets for filters, variant selection, address selection, shipping method selection, and coupons.
- Use two-column product grids on mobile and wider grids on larger screens.
- Avoid layout shift by matching skeleton dimensions to final cards.
- Keep text short in mobile cards and badges.

## Domain Architecture Notes

### Marketplace

Owns buyer discovery:
- home feed
- flash sale
- category grid
- product grid
- search/filter/sort UI
- product detail

Marketplace components may call catalog/search APIs through hooks, but price, stock, and availability must remain backend-controlled.

### Cart

Owns cart display and editing:
- shop grouping
- item selection
- quantity controls
- item availability warnings
- selected total

Cart does not reserve stock. Stock reservation happens during checkout.

### Checkout

Owns single-page checkout UI:
- address selection
- shop-grouped item review
- shipping per shop
- coupon selection
- payment method
- totals
- reservation timer

Checkout must show backend validation errors before payment. The UI must not trust client-calculated totals.

### Order

Owns buyer order lifecycle UI:
- order list
- order detail
- payment status display
- shipment tracking by shop
- review entry
- return/refund request

Order items and addresses must display snapshot data from the backend.

### Seller

Owns seller operations:
- dashboard
- product management
- inventory
- paid shipment queue
- shipment processing
- finance summaries
- promotions
- chat

Seller UI must be shipment-based for order processing because one buyer order can split across many shops.

### Admin

Owns operational management:
- users
- shops
- product moderation
- order monitoring
- refunds/returns
- commissions
- reports

Admin lists should use dense tables on desktop and card layouts on mobile.

## Documentation Maintenance

Update this document when:
- adding a new frontend domain
- changing routing conventions
- changing API integration patterns
- introducing a global state library
- changing how server/client component boundaries are handled
- adding a new reusable component category

Do not update this document for one-off page copy, styling tweaks, or component implementation details that do not change architecture.

## Acceptance Checklist

- Routes follow the App Router under `app/`.
- Feature code stays under `app/features/<domain>/`.
- shadcn/ui primitives stay under `app/components/ui/`.
- Shared app chrome stays under `app/components/`.
- Client Components are used only where interactivity or browser state is needed.
- API hooks use Eden Treaty and TanStack Query without duplicating backend types.
- Loading, empty, and error states are explicit.
- Mobile sticky CTA and bottom nav padding are handled by page shells.
- Payment success is never inferred from browser redirect state.
