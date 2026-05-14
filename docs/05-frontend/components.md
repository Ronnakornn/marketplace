# Marketplace Frontend Components

This document defines reusable frontend components for the mobile-first ecommerce marketplace. It is documentation only; do not create React code from this file without a separate implementation task.

Component principles:
- Compatible with Next.js App Router, Tailwind CSS, and shadcn/ui primitives.
- Mobile-first for 360-430px screens before tablet/desktop.
- Optimized for marketplace conversion: fast discovery, clear price/status, sticky CTAs, low-friction checkout.
- Frontend types should be inferred from Eden Treaty where available; do not duplicate backend response types manually.
- Use shadcn/ui primitives such as `Button`, `Card`, `Badge`, `Input`, `Sheet`, `Dialog`, `Tabs`, `Table`, `Skeleton`, `Separator`, `Checkbox`, `RadioGroup`, `Select`, `Textarea`, and `Toast` patterns where appropriate.

## MVP Priority Legend

- **P0**: Required for MVP browse, product detail, cart, checkout, payment tracking, seller order processing, or admin monitoring.
- **P1**: Important soon after MVP.
- **P2**: Useful enhancement after core flows are stable.

## Layout Components

### `MarketplacePageShell`

- **Purpose**: Provides buyer page structure with safe-area padding, max-width behavior, optional sticky header, optional bottom nav, and bottom padding for fixed CTAs.
- **Used in pages**: `/`, `/search`, `/categories`, `/categories/:slug`, `/deals`, `/products/:productId`, `/cart`, `/orders`, `/orders/:orderId`, `/account`.
- **Props/data needed**: `children`, `headerSlot`, `bottomNavSlot`, `stickyCtaSlot`, `showBottomNav`, `contentClassName`, current route.
- **Loading state**: Pass-through; child sections render their own skeletons.
- **Empty state**: Pass-through; child pages decide empty content.
- **Mobile behavior**: Adds bottom padding equal to fixed navigation or sticky CTA height; constrains content width on larger screens.
- **Interactions**: None directly; coordinates layout slots.
- **MVP priority**: P0.

### `SellerPageShell`

- **Purpose**: Provides seller dashboard layout with shop header, seller navigation, and responsive management content area.
- **Used in pages**: `/seller`, `/seller/products`, `/seller/inventory`, `/seller/orders`, `/seller/orders/:shipmentId`, `/seller/shipping`, `/seller/finance`, `/seller/promotions`, `/seller/chat`.
- **Props/data needed**: `shop`, `navigationItems`, `activeRoute`, `children`, `actionSlot`, `alerts`.
- **Loading state**: Shop header skeleton and content skeleton.
- **Empty state**: Empty shop setup prompt when seller has no active shop.
- **Mobile behavior**: Uses top header plus bottom or tab navigation; desktop can use sidebar.
- **Interactions**: Navigate seller sections, open shop status alert details.
- **MVP priority**: P0.

### `AdminPageShell`

- **Purpose**: Provides admin operational layout with full-screen management workspace, admin navigation, and dense content support.
- **Used in pages**: `/admin`, `/admin/users`, `/admin/shops`, `/admin/products`, `/admin/orders`, `/admin/refunds`, `/admin/commissions`, `/admin/reports`.
- **Props/data needed**: `navigationItems`, `activeRoute`, `children`, `pageTitle`, `toolbarSlot`, `metricSlot`.
- **Loading state**: Header and table/card skeletons.
- **Empty state**: Page-level no-data message with operational next action.
- **Mobile behavior**: Admin nav collapses into drawer or compact tabs; tables become cards.
- **Interactions**: Open navigation drawer, trigger toolbar filters/actions.
- **MVP priority**: P0.

### `SectionHeader`

- **Purpose**: Standardizes compact section titles with optional timer, action link, or count.
- **Used in pages**: Home, search results, category feed, product detail recommendations, seller dashboard, admin dashboard.
- **Props/data needed**: `title`, `subtitle`, `count`, `actionLabel`, `actionHref`, `timer`, `icon`.
- **Loading state**: Text skeleton line.
- **Empty state**: Usually hidden when section content is empty unless action is still useful.
- **Mobile behavior**: Single-line title with optional small action on right; wraps subtitle below.
- **Interactions**: Tap action link, countdown display if provided.
- **MVP priority**: P0.

## Navigation Components

### `MobileBottomNavigation`

- **Purpose**: Fixed buyer navigation for high-frequency marketplace routes.
- **Used in pages**: `/`, `/search?q=...`, `/categories`, `/categories/:slug`, `/deals`, `/cart`, `/orders`, `/account`, `/chat`.
- **Props/data needed**: `items` with label/icon/href/badge count, `activeRoute`, cart count, unread count.
- **Loading state**: Badge skeleton or hidden badges until counts load.
- **Empty state**: No badges; nav remains visible.
- **Mobile behavior**: Fixed bottom, safe-area aware, 5 items max: Home, Categories, Deals, Cart, Account.
- **Interactions**: Navigate routes; badge tap follows item href.
- **MVP priority**: P0.

### `SearchBar`

- **Purpose**: High-conversion search entry for browse pages and search results.
- **Used in pages**: `/`, `/search`, `/search?q=...`, `/categories`, `/categories/:slug`, `/deals`.
- **Props/data needed**: `value`, `placeholder`, `suggestions`, `recentSearches`, `trendingKeywords`, `isFocused`, submit handler.
- **Loading state**: Suggestion list skeleton while fetching.
- **Empty state**: Shows trending keywords, recent searches, and category shortcuts when no query.
- **Mobile behavior**: Sticky top on feed pages; full-screen focused search experience on `/search`.
- **Interactions**: Type query, clear query, submit, choose suggestion, choose recent/trending keyword.
- **MVP priority**: P0.

### `FilterSortBar`

- **Purpose**: One-tap sort and filter entry for product feeds.
- **Used in pages**: `/search?q=...`, `/categories/:slug`, `/deals`.
- **Props/data needed**: active sort, active filters count, available sort options, filter summary.
- **Loading state**: Disabled chips or skeleton chips.
- **Empty state**: Still visible for empty filtered results so buyers can clear filters.
- **Mobile behavior**: Sticky below search/header; filter opens a bottom sheet.
- **Interactions**: Change sort, open filter sheet, clear filters.
- **MVP priority**: P0.

### `FilterBottomSheet`

- **Purpose**: Mobile filter UI for category, price, rating, shop, and shipping options.
- **Used in pages**: Search results, category product list, deals.
- **Props/data needed**: filter groups, selected filters, price range, rating, shop ids, shipping flags, apply/reset handlers.
- **Loading state**: Option skeleton rows.
- **Empty state**: Hide empty filter groups; show reset option if filters are active.
- **Mobile behavior**: shadcn `Sheet` from bottom; sticky Apply button inside sheet.
- **Interactions**: Select filters, reset, apply, close.
- **MVP priority**: P0.

### `StickyBuyBar`

- **Purpose**: Product detail fixed conversion bar with Add to Cart and Buy Now.
- **Used in pages**: `/products/:productId`.
- **Props/data needed**: selected variant, quantity, stock state, price, loading states, disabled reason, cart count.
- **Loading state**: Disabled buttons with skeleton price or spinner.
- **Empty state**: Not applicable; hidden only if product cannot render.
- **Mobile behavior**: Fixed bottom above safe area; replaces bottom navigation; two-button layout.
- **Interactions**: Add to cart, Buy Now, open variant picker when selection is missing, show mini cart confirmation.
- **MVP priority**: P0.

### `StickyCheckoutBar`

- **Purpose**: Fixed checkout/cart action bar with selected total and primary CTA.
- **Used in pages**: `/cart`, `/checkout`.
- **Props/data needed**: total cents, currency, selected count, disabled reason, isSubmitting, primary label.
- **Loading state**: Total skeleton and disabled CTA.
- **Empty state**: Disabled CTA with zero selected items.
- **Mobile behavior**: Fixed bottom; checkout page hides bottom nav; cart may stack above bottom nav only if space allows.
- **Interactions**: Checkout selected, place order, show disabled reason.
- **MVP priority**: P0.

## Product Components

### `ProductCard`

- **Purpose**: Compact product tile optimized for product feeds and high click-through.
- **Used in pages**: Home, search results, category feed, deals, product recommendations.
- **Props/data needed**: product id/slug, title, image, price cents, currency, discount percent, rating, sold count, shop name, free shipping flag, stock hint, campaign badge.
- **Loading state**: Fixed-ratio image skeleton and text/price skeletons.
- **Empty state**: Not used alone; grid handles empty state.
- **Mobile behavior**: Two-column grid card, fixed image aspect ratio, title max two lines, price always visible.
- **Interactions**: Tap opens detail; optional quick add opens variant picker or adds default variant when safe.
- **MVP priority**: P0.

### `ProductGrid`

- **Purpose**: Responsive product feed wrapper with infinite-scroll trigger.
- **Used in pages**: Home recommendations, search results, category feed, deals, related products.
- **Props/data needed**: product list, loading flag, error, hasNextPage, fetchNextPage, empty message, grid density.
- **Loading state**: Product card skeleton rows.
- **Empty state**: EmptyState with category/search suggestions and clear-filter action.
- **Mobile behavior**: Two columns on mobile, wider grid on tablet/desktop; stable card dimensions.
- **Interactions**: Infinite scroll via intersection observer, retry fetch, open product.
- **MVP priority**: P0.

### `FlashSaleCarousel`

- **Purpose**: Urgency-driven horizontal product row with countdown and campaign pricing.
- **Used in pages**: Home, deals.
- **Props/data needed**: campaign title, end time, products, discount badge, sold progress, action href.
- **Loading state**: Horizontal skeleton cards and timer skeleton.
- **Empty state**: Hide section if no active campaign; optionally show upcoming deals P2.
- **Mobile behavior**: Horizontal swipe with partial next card visible.
- **Interactions**: Open product, view all deals.
- **MVP priority**: P0 for home merchandising.

### `CategoryGrid`

- **Purpose**: Icon-first category entry for quick mobile browsing.
- **Used in pages**: Home, `/categories`, empty search state.
- **Props/data needed**: category id/slug, label, icon/image, product count, sort order.
- **Loading state**: Icon circle and label skeletons.
- **Empty state**: Hide or show popular categories fallback.
- **Mobile behavior**: 4 columns on mobile home; category index can use 4-5 columns depending width.
- **Interactions**: Tap category route, horizontal/vertical expansion if more categories.
- **MVP priority**: P0.

### `ProductImageCarousel`

- **Purpose**: Product media viewer for detail pages.
- **Used in pages**: Product detail.
- **Props/data needed**: image urls, alt text, active image index, product title, campaign badge.
- **Loading state**: Fixed-ratio image skeleton.
- **Empty state**: Placeholder product image.
- **Mobile behavior**: Full-width square or 4:5 image area with swipe gestures and pagination dots.
- **Interactions**: Swipe images, tap to open gallery, share/favorite action can sit in page header.
- **MVP priority**: P0.

### `VariantSelector`

- **Purpose**: Select product variant options before cart or checkout actions.
- **Used in pages**: Product detail, quick add sheet.
- **Props/data needed**: variants, option groups, selected options, stock per variant, price per variant.
- **Loading state**: Option chip skeletons.
- **Empty state**: Hidden if product has no variants.
- **Mobile behavior**: Inline summary plus bottom sheet for selection when triggered by CTA.
- **Interactions**: Select option, adjust quantity, show out-of-stock disabled options, confirm.
- **MVP priority**: P0.

### `ShopCard`

- **Purpose**: Shows seller/shop trust context on product detail and order surfaces.
- **Used in pages**: Product detail, order detail, chat context.
- **Props/data needed**: shop id/name, logo, rating, follower count, response time, product count, status, chat href.
- **Loading state**: Logo/name metric skeletons.
- **Empty state**: Minimal shop name fallback.
- **Mobile behavior**: Compact card with View Shop and Chat actions.
- **Interactions**: Open shop, chat seller.
- **MVP priority**: P1.

## Cart Components

### `ShopGroupedCart`

- **Purpose**: Renders cart items grouped by shop with shop-level selection, vouchers, subtotal, and errors.
- **Used in pages**: `/cart`.
- **Props/data needed**: shop groups, selected item ids, shop vouchers, item availability, estimated shipping, totals.
- **Loading state**: Shop group skeletons with item row placeholders.
- **Empty state**: Empty cart module with continue shopping CTA.
- **Mobile behavior**: Full-width stacked shop groups; sticky checkout bar handles total.
- **Interactions**: Select shop, select item, remove item, update quantity, apply shop voucher.
- **MVP priority**: P0.

### `CartItem`

- **Purpose**: Displays a cart line item with variant snapshot, quantity controls, price, and availability warnings.
- **Used in pages**: Cart, checkout item summary.
- **Props/data needed**: item id, product title, image, variant label, quantity, unit price cents, subtotal cents, selected state, stock state, error message.
- **Loading state**: Image/text/price skeleton row.
- **Empty state**: Not used alone.
- **Mobile behavior**: Image left, content right, quantity and price anchored near bottom; disabled visual for unavailable items.
- **Interactions**: Select item, increment/decrement quantity, remove item, open product detail.
- **MVP priority**: P0.

### `QuantityStepper`

- **Purpose**: Consistent quantity adjustment control.
- **Used in pages**: Product detail variant picker, cart, checkout review when editable.
- **Props/data needed**: value, min, max, disabled, stock hint, change handler.
- **Loading state**: Disabled skeleton control.
- **Empty state**: Not applicable.
- **Mobile behavior**: Minimum 44px tap targets; prevents layout shift.
- **Interactions**: Increment, decrement, direct numeric input if supported.
- **MVP priority**: P0.

## Checkout Components

### `AddressSelector`

- **Purpose**: Lets buyer choose or add a shipping address and shows the address snapshot candidate.
- **Used in pages**: `/checkout`, `/account/addresses`.
- **Props/data needed**: addresses, selected address id, recipient, phone, address lines, default flag, validation errors.
- **Loading state**: Address card skeleton.
- **Empty state**: Add address CTA blocks checkout progress.
- **Mobile behavior**: Selected address as compact card; list opens in bottom sheet or full page.
- **Interactions**: Select address, add/edit address, mark default.
- **MVP priority**: P0.

### `ShippingMethodSelector`

- **Purpose**: Selects shipping method per shop during checkout.
- **Used in pages**: `/checkout`.
- **Props/data needed**: shop id/name, methods, selected method, fee cents, ETA, disabled reason.
- **Loading state**: Method row skeletons per shop.
- **Empty state**: Show no shipping method error for the shop.
- **Mobile behavior**: Per-shop compact selector; bottom sheet for method list.
- **Interactions**: Open selector, choose method, recalculate totals.
- **MVP priority**: P0.

### `CouponSelector`

- **Purpose**: Applies platform or shop coupons/vouchers with clear savings feedback.
- **Used in pages**: Cart, checkout, promotion entry surfaces.
- **Props/data needed**: available coupons, applied coupons, coupon code input, eligibility messages, savings cents.
- **Loading state**: Coupon row skeletons.
- **Empty state**: No available coupons message; manual code entry can remain.
- **Mobile behavior**: Voucher chips inline; full list in bottom sheet.
- **Interactions**: Apply coupon, remove coupon, enter code, show ineligible reason.
- **MVP priority**: P0.

### `CheckoutSummary`

- **Purpose**: Displays trusted order totals and reservation/payment readiness.
- **Used in pages**: `/checkout`, payment return, order detail summary.
- **Props/data needed**: items subtotal, shipping total, discount total, tax if any, grand total, currency, reservation expiry, price change warnings.
- **Loading state**: Totals skeleton rows.
- **Empty state**: Not applicable; checkout should not exist without items.
- **Mobile behavior**: Compact stacked totals; sticky checkout bar repeats grand total.
- **Interactions**: Expand details, show price change acknowledgement if needed.
- **MVP priority**: P0.

### `PaymentMethodSelector`

- **Purpose**: Selects payment method before payment intent creation.
- **Used in pages**: `/checkout`.
- **Props/data needed**: methods, selected method, availability, fees if any.
- **Loading state**: Method skeleton rows.
- **Empty state**: No available payment method error.
- **Mobile behavior**: Radio list inside checkout section or bottom sheet.
- **Interactions**: Select method, show unavailable reason.
- **MVP priority**: P0.

### `ReservationTimer`

- **Purpose**: Makes stock reservation expiry visible after checkout reservation succeeds.
- **Used in pages**: `/checkout`, payment pending if reservation remains relevant.
- **Props/data needed**: reservation expiry timestamp, current status, expired handler.
- **Loading state**: Hidden until reservation exists.
- **Empty state**: Hidden before stock reservation.
- **Mobile behavior**: Compact warning row near totals and CTA.
- **Interactions**: Expiry event disables payment progression or returns buyer to cart.
- **MVP priority**: P0.

## Order Components

### `OrderStatusBadge`

- **Purpose**: Standard status badge for orders, payments, shipments, returns, and refunds.
- **Used in pages**: Orders list, order detail, payment return, seller orders, admin orders/refunds.
- **Props/data needed**: status type, status value, label override, severity.
- **Loading state**: Badge skeleton.
- **Empty state**: Unknown status fallback.
- **Mobile behavior**: Short labels; avoid wrapping in dense cards.
- **Interactions**: Optional tooltip or status explanation.
- **MVP priority**: P0.

### `OrderCard`

- **Purpose**: Buyer order list item summarizing order status, shops, items, payment, and next action.
- **Used in pages**: `/orders`, `/account`.
- **Props/data needed**: order id, order number, status, payment status, shop summaries, thumbnails, total cents, shipment summary, next action.
- **Loading state**: Card skeleton.
- **Empty state**: Orders page handles no orders.
- **Mobile behavior**: Stacked card; one primary action visible.
- **Interactions**: Open order detail, track shipment, retry payment.
- **MVP priority**: P0.

### `ShipmentTracker`

- **Purpose**: Shows per-shop shipment status and tracking timeline.
- **Used in pages**: `/orders/:orderId`, seller shipment detail, admin order monitoring.
- **Props/data needed**: shipment id, shop, carrier, tracking number, status, timeline events, shipment items.
- **Loading state**: Timeline skeleton.
- **Empty state**: Waiting for seller shipment message.
- **Mobile behavior**: One card per shop shipment; timeline collapsed by default when many events.
- **Interactions**: Expand timeline, copy tracking number, open carrier tracking link.
- **MVP priority**: P0.

### `OrderTimeline`

- **Purpose**: Generic vertical timeline for payment, shipment, return, and refund events.
- **Used in pages**: Order detail, payment return, return/refund detail, admin order detail.
- **Props/data needed**: events with timestamp, label, description, status/severity.
- **Loading state**: Timeline skeleton rows.
- **Empty state**: No events yet message.
- **Mobile behavior**: Compact vertical list; latest event emphasized.
- **Interactions**: Expand event details when available.
- **MVP priority**: P1.

### `ReturnRequestForm`

- **Purpose**: Captures return/refund request data for eligible order items.
- **Used in pages**: `/orders/:orderId/returns/new`.
- **Props/data needed**: eligible items, selected item ids, quantities, reasons, evidence files, notes, refund estimate.
- **Loading state**: Eligible item skeletons.
- **Empty state**: No eligible items explanation.
- **Mobile behavior**: Single-column form with sticky Submit Request CTA.
- **Interactions**: Select items, choose reason, upload evidence, submit request.
- **MVP priority**: P1.

## Seller Components

### `SellerOrdersTable`

- **Purpose**: Seller shipment/order queue for processing paid shop-owned shipments.
- **Used in pages**: `/seller/orders`.
- **Props/data needed**: shipments, statuses, buyer summary, item count, created date, SLA deadline, tracking state.
- **Loading state**: Table row skeletons on desktop; card skeletons on mobile.
- **Empty state**: No pending shipments with link to products/dashboard.
- **Mobile behavior**: Converts table rows to cards with primary Process action.
- **Interactions**: Filter by status, open shipment detail, mark ready if supported.
- **MVP priority**: P0.

### `ShipmentProcessingCard`

- **Purpose**: Seller shipment detail card for pack, tracking input, and mark shipped flow.
- **Used in pages**: `/seller/orders/:shipmentId`.
- **Props/data needed**: shipment, order summary, items, quantities, carrier options, tracking number, validation errors.
- **Loading state**: Shipment and item checklist skeletons.
- **Empty state**: Shipment not found or no actionable items.
- **Mobile behavior**: Stacked item checklist with sticky Mark Shipped CTA.
- **Interactions**: Check packed items, enter carrier/tracking, submit mark shipped.
- **MVP priority**: P0.

### `SellerProductList`

- **Purpose**: Seller product management list with status, stock, and edit actions.
- **Used in pages**: `/seller/products`.
- **Props/data needed**: products, status filters, search query, pagination/cursor, stock summary, moderation status.
- **Loading state**: Product row/card skeletons.
- **Empty state**: Create first product CTA.
- **Mobile behavior**: Cards instead of dense table; status tabs stay reachable.
- **Interactions**: Search, filter status, open edit, create product.
- **MVP priority**: P0.

### `InventoryEditor`

- **Purpose**: Fast stock update UI with reserved stock visibility.
- **Used in pages**: `/seller/inventory`, seller product edit variants.
- **Props/data needed**: variants, quantity on hand, reserved quantity, reorder level, save state, validation errors.
- **Loading state**: Inventory row skeletons.
- **Empty state**: No variants message.
- **Mobile behavior**: Variant cards with numeric inputs and save affordance.
- **Interactions**: Update stock, save changes, show reserved-stock conflict warning.
- **MVP priority**: P1.

### `DashboardStatsCard`

- **Purpose**: Reusable KPI card for seller/admin dashboards.
- **Used in pages**: `/seller`, `/admin`.
- **Props/data needed**: title, value, delta, severity, icon, href, supporting text.
- **Loading state**: Value and label skeleton.
- **Empty state**: Zero value with neutral text.
- **Mobile behavior**: Two-column grid on mobile where possible; full-width for critical exceptions.
- **Interactions**: Tap to drill into relevant queue or report.
- **MVP priority**: P0.

## Admin Components

### `ManagementDataTable`

- **Purpose**: Dense management table with mobile card fallback for admin and seller operations.
- **Used in pages**: Admin users, shops, products, orders, refunds, commissions, reports; seller products/orders.
- **Props/data needed**: columns, rows, row actions, filters, sort, pagination/cursor, selection state.
- **Loading state**: Row skeletons.
- **Empty state**: No matching records with clear filters action.
- **Mobile behavior**: Converts rows to cards; keeps primary action visible.
- **Interactions**: Sort, filter, select rows, open row detail, run row actions.
- **MVP priority**: P0.
- **Implementation rule**: Use the shadcn/ui Radix Data Table pattern from `https://ui.shadcn.com/docs/components/radix/data-table`. This means composing a feature-owned data table from shadcn `Table` primitives plus `@tanstack/react-table`; do not use array `map` alone for admin tables that need filtering, sorting, row actions, selection, pagination, or column visibility.
- **Required table pieces**: `columns.tsx` or colocated `ColumnDef<TData>[]`, `useReactTable`, `getCoreRowModel`, `flexRender`, and shadcn `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`.
- **Admin table features**: include row actions through shadcn `DropdownMenu` or a clear primary action button, text filtering with `Input`, sorting through TanStack `SortingState`, pagination controls with shadcn `Button`, and selected-row state when bulk actions exist.
- **Placement**: keep reusable generic table wrappers in `app/components/` only if two or more screens share the same behavior; otherwise keep columns and table logic in the owning feature folder.

### `AdminCatalogDataTable`

- **Purpose**: Product operations table for `/admin/catalog`.
- **Used in pages**: `/admin/catalog`.
- **Props/data needed**: products, shop summary, variant count, status, derived variant price, search/filter state, edit href.
- **Loading state**: KPI and table skeletons.
- **Empty state**: No products or no matching search results.
- **Mobile behavior**: Table can compress horizontally first; card fallback may be added when admin mobile usage becomes common.
- **Interactions**: Search, sort with TanStack Table, open dedicated edit page.
- **MVP priority**: P0.

### `AdminVariantEditor`

- **Purpose**: Create, update, and delete product variants from the admin product edit page.
- **Used in pages**: `/admin/catalog/:productId`.
- **Props/data needed**: product id, variants, SKU, title, price cents, currency, pending/error state.
- **Loading state**: Variant data table row skeletons inside product edit page.
- **Empty state**: No variants with Create Variant CTA.
- **Mobile behavior**: Keep columns compact with horizontal overflow first; variant rows may become compact stacked cards later if admin mobile usage requires it.
- **Interactions**: Sort variant columns, open row action menu, open create/edit dialog, validate positive price, delete variant, refresh product detail.
- **MVP priority**: P0.
- **Implementation rule**: Use shadcn `Table` primitives with `@tanstack/react-table` `ColumnDef`, `useReactTable`, `getCoreRowModel`, `getSortedRowModel`, and row actions through `DropdownMenu`. Do not manage variants as an ad hoc card/list map on the admin catalog edit page.

### `AdminUserSegmentedList`

- **Purpose**: Separates customer users from system users in admin user management.
- **Used in pages**: `/admin/users`.
- **Props/data needed**: active segment, customers, system users, search query, role/status filters.
- **Loading state**: Segment skeleton and user card/table skeletons.
- **Empty state**: Segment-specific empty text.
- **Mobile behavior**: shadcn `Tabs` or segmented control; user rows become cards.
- **Interactions**: Switch segment, search, filter, open user, update role/status.
- **MVP priority**: P0.

### `ModerationPanel`

- **Purpose**: Product/shop review panel for approve/reject decisions.
- **Used in pages**: `/admin/products`, `/admin/shops`.
- **Props/data needed**: entity details, submitted content, flags, decision options, reason input, audit history.
- **Loading state**: Detail skeleton.
- **Empty state**: No pending moderation items.
- **Mobile behavior**: Decision actions stay sticky at bottom for active review.
- **Interactions**: Approve, reject, request changes, enter reason.
- **MVP priority**: P1.

### `AdminOrderMonitorCard`

- **Purpose**: Compact order monitoring card highlighting payment, shipment, and refund exceptions.
- **Used in pages**: `/admin/orders`, `/admin`.
- **Props/data needed**: order id, order number, buyer, shops, order status, payment status, shipment status, exception reason, created date.
- **Loading state**: Card skeleton.
- **Empty state**: No exceptions message handled by parent.
- **Mobile behavior**: Card-first layout with status badges near top.
- **Interactions**: Open order detail, filter by exception type.
- **MVP priority**: P0.

## Shared Components

### `StatusBadge`

- **Purpose**: Generic status badge used across products, carts, checkout, payments, orders, shipments, returns, refunds, users, shops.
- **Used in pages**: Most buyer/seller/admin pages.
- **Props/data needed**: domain, status, label, severity, size.
- **Loading state**: Small skeleton pill.
- **Empty state**: Unknown/Not available label.
- **Mobile behavior**: Short text labels; consistent colors for severity.
- **Interactions**: Optional tooltip/explanation.
- **MVP priority**: P0.

### `SkeletonFeed`

- **Purpose**: Reusable skeleton patterns for feeds, cards, tables, and checkout totals.
- **Used in pages**: Home, search, category feed, product detail, cart, checkout, seller/admin pages.
- **Props/data needed**: variant, count, columns, showHeader.
- **Loading state**: It is the loading state.
- **Empty state**: Not applicable.
- **Mobile behavior**: Matches final layout dimensions to prevent layout shift.
- **Interactions**: None.
- **MVP priority**: P0.

### `EmptyState`

- **Purpose**: Standard no-data state with useful recovery action.
- **Used in pages**: Search, category, cart, orders, seller products/orders, admin lists.
- **Props/data needed**: title, description, icon, primary action, secondary action.
- **Loading state**: Not shown during loading.
- **Empty state**: It is the empty state.
- **Mobile behavior**: Compact, centered, avoids taking excessive height in feeds.
- **Interactions**: Primary/secondary CTA.
- **MVP priority**: P0.

### `ErrorRetry`

- **Purpose**: Standard recoverable error UI.
- **Used in pages**: All API-driven pages and sections.
- **Props/data needed**: title, message, retry handler, support action, severity.
- **Loading state**: Hidden while retrying or shows button spinner.
- **Empty state**: Not applicable.
- **Mobile behavior**: Inline for section errors; full-page only for route-breaking errors.
- **Interactions**: Retry, contact support/open chat where relevant.
- **MVP priority**: P0.

### `PriceText`

- **Purpose**: Consistent money formatting for integer cents.
- **Used in pages**: Product cards, product detail, cart, checkout, orders, seller/admin finance.
- **Props/data needed**: amount cents, currency, size, compare-at amount, discount display flag.
- **Loading state**: Price skeleton.
- **Empty state**: Dash or hidden depending context.
- **Mobile behavior**: Price stays prominent but must not overflow cards.
- **Interactions**: None.
- **MVP priority**: P0.

### `ConfirmActionDialog`

- **Purpose**: Confirms destructive or irreversible seller/admin actions.
- **Used in pages**: Seller product archive, seller mark shipped if needed, admin suspend user/shop, admin reject product/refund decisions.
- **Props/data needed**: title, description, confirm label, cancel label, severity, pending state.
- **Loading state**: Confirm button spinner.
- **Empty state**: Not applicable.
- **Mobile behavior**: shadcn `Dialog` or `AlertDialog`; full-width buttons on mobile.
- **Interactions**: Confirm, cancel.
- **MVP priority**: P1.

### `ToastMessage`

- **Purpose**: Lightweight feedback for add-to-cart, save, apply coupon, retry, and status updates.
- **Used in pages**: Product detail, cart, checkout, seller/admin forms.
- **Props/data needed**: type, title, description, action label, action handler.
- **Loading state**: Not applicable.
- **Empty state**: Not applicable.
- **Mobile behavior**: Appears above fixed bottom nav/CTA to avoid overlap.
- **Interactions**: Dismiss, optional action such as View Cart.
- **MVP priority**: P0.

## Component Placement Rules

- Buyer marketplace components should live under `app/features/marketplace/` unless shared across domains.
- Cart and checkout components should live under `app/features/cart/` and `app/features/checkout/` when those feature modules exist.
- Seller components should live under `app/features/seller/`.
- Admin components should live under `app/features/admin/`.
- Generic shadcn-compatible wrappers and primitives should live under `app/components/` or `app/components/ui/`.
- Avoid placing business rules in shared UI components; validation and trusted calculations must come from backend state.

## MVP Component Build Order

1. `MarketplacePageShell`, `MobileBottomNavigation`, `SearchBar`, `ProductCard`, `ProductGrid`, `CategoryGrid`, `FlashSaleCarousel`.
2. `ProductImageCarousel`, `VariantSelector`, `StickyBuyBar`, `PriceText`, `ToastMessage`.
3. `ShopGroupedCart`, `CartItem`, `QuantityStepper`, `StickyCheckoutBar`.
4. `AddressSelector`, `ShippingMethodSelector`, `CouponSelector`, `CheckoutSummary`, `PaymentMethodSelector`, `ReservationTimer`.
5. `OrderStatusBadge`, `OrderCard`, `ShipmentTracker`.
6. `SellerPageShell`, `SellerOrdersTable`, `ShipmentProcessingCard`, `DashboardStatsCard`.
7. `AdminPageShell`, `ManagementDataTable`, `AdminUserSegmentedList`, `AdminOrderMonitorCard`.

## Acceptance Checklist

- Each MVP buyer page can be assembled from documented components.
- Product detail, cart, and checkout have fixed CTA components with safe-area behavior.
- Cart and checkout components support shop grouping.
- Order tracking components support per-shop shipments.
- Seller order processing components are shipment-based.
- Admin management components support mobile card fallback.
- Loading, empty, and error states are defined for every data-driven component.
- Components stay compatible with Tailwind CSS and shadcn/ui primitives.
