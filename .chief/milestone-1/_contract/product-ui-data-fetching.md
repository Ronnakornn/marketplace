# Product UI Data Fetching Contract

## Audience Boundary Contract

- Product query helpers must be organized by audience or access level:
  - public/buyer product discovery and product detail
  - seller product management and seller-owned product context
  - admin product/catalog management
  - affiliate product target lookup where applicable
- Public/buyer query keys must never include or return private seller/admin/cart/checkout/order/payment data.
- Seller product reads must remain scoped to the authenticated seller's active shop access.
- Admin product reads must remain protected by admin access.
- Shared query-key helpers may be reused across audiences only when they cannot mix private and public data.

## Public Product Query Contract

- Public product query helpers must cover:
  - product list/discovery
  - product search
  - product detail
  - categories used by product discovery
  - shop product listings
- Public query keys must include every behavior-changing input:
  - locale
  - query text
  - category
  - shop
  - filters
  - sort
  - cursor/page/limit
- Public product list and search results must remain paginated.
- Public product detail and listing reads must preserve active-product visibility rules.
- Search may remain owned by the search backend module; this contract only requires UI product discovery consumers to use a consistent query layer.

## Eden and Type Contract

- Product UI code should infer API response types from Eden Treaty where the route type is available.
- Public/buyer product, category, product detail, and search fetching should migrate away from manual duplicated product response interfaces.
- A small adapter/normalizer is allowed only when:
  - the current endpoint shape is not yet directly usable by the UI, or
  - Eden route typing cannot represent an existing endpoint without a larger backend refactor.
- Any adapter must live near the product query layer, must be typed from API-derived input where practical, and must not become a second source of truth for backend DTOs.
- Do not manually duplicate Prisma-managed model types in frontend code.

## UI State Contract

- Buyer-facing product pages must not show demo or fallback products as real inventory in production paths.
- When product APIs return no data, the UI must show an explicit empty state.
- When product APIs are loading, the UI must show existing project loading/skeleton patterns.
- When product APIs fail, the UI must show an error state with a retry path where the page remains interactive.
- Removing demo fallback behavior must not redesign product cards or page layouts beyond the state handling needed for real data.

## Mutation Invalidation Contract

- Product mutation hooks must invalidate product queries through named helpers where practical.
- Seller mutations that create/update/archive products, variants, images, or inventory must invalidate affected seller product reads.
- Seller mutations that affect public visibility or buyer-visible product data must invalidate relevant public product discovery/detail query keys where practical.
- Admin product status/catalog mutations must invalidate affected admin product reads and relevant public product queries where public visibility can change.
- Invalidation should be precise when the affected product or audience is known, but broad product-list invalidation is allowed when filter coverage makes precise invalidation unreliable.
- Mutation invalidation must not expose seller/admin data into public query caches.

## API Compatibility Contract

- Existing backend module ownership should remain intact:
  - catalog owns catalog product/category/shop-product routes
  - search owns search product routes
  - seller/admin protection remains on existing protected routes
- Prefer frontend query-layer refactors before backend route changes.
- Backend route changes are allowed only when needed to:
  - expose route typing cleanly through Eden Treaty
  - preserve pagination/filter/sort contract
  - remove frontend-only response guessing
- Existing API response shapes should remain backward compatible unless all affected consumers are updated in the same task.
- Backend validation must continue to use existing TypeBox/Prismabox patterns when route validation changes are needed.

## Verification Contract

- Add focused tests for product query-key construction, including locale, query, category, filters, sort, cursor/page, and limit.
- Add focused tests for audience separation where practical, especially public vs seller/admin query keys.
- Add buyer UI tests that verify loading, error, and empty states without demo product fallback.
- Add focused tests for product mutation invalidation helpers where practical.
- Update existing product UI tests that mock old buyer fetch helpers to use the new query layer.
- Run focused product UI tests and affected seller/admin product tests.
- Run affected backend catalog/search tests if route typing or response contracts change.
- Run `bunx tsc --noEmit`.
