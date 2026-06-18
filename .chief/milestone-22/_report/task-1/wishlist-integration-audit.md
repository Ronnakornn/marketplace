# Wishlist Integration Audit

## Scope

Audited the existing buyer wishlist/favorite, cart, product card, product detail, and auth flows for milestone-22 task-1. No product code was changed.

## Current Wishlist Route

- Route: `app/[locale]/(buyer)/wishlist/page.tsx`
- Page component: `app/features/buyer/components/WishlistPage.tsx`
- Current behavior:
  - Renders `WishlistPage` directly.
  - Uses React Query key `["buyer-favorites"]`.
  - Calls `fetchFavoriteProducts()`.
  - Shows loading, error with retry, empty, and populated states.
  - Populated state is a simple article list with shop name, title, price, heart icon, and a "view product" link.
- Gap:
  - The route does not currently call `requireUser()`. Nearby buyer routes such as cart do this in the route file.
  - Unauthenticated users can reach the client wishlist page and then receive the protected API failure from `/api/me/favorites` instead of an immediate login redirect with return path.

## Favorite API Integration

Frontend helpers live in `app/features/buyer/api.ts`.

- `fetchFavoriteProducts()`
  - `GET /api/me/favorites`
  - Query key used by wishlist and invalidated by product favorite mutations: `["buyer-favorites"]`
- `fetchFavoriteStatus(productId)`
  - `GET /api/me/favorites/:productId`
  - Returns `Boolean(response.favorited)`.
  - Query key on product surfaces: `["buyer-favorite-status", productId]`
- `addFavoriteProduct(productId)`
  - `PUT /api/me/favorites/:productId`
- `removeFavoriteProduct(productId)`
  - `DELETE /api/me/favorites/:productId`

Backend routes live in `server/modules/user/user.routes.ts`.

- All favorite routes use `{ withAuth: true }`.
- `productId` route param is validated as UUID.
- User identity comes from `authContext!.user.id`; callers cannot pass another user id.

Backend service/repository behavior:

- `UserService.listFavoriteProducts(userId)` maps repository records through `toFavoriteProduct()`.
- `UserService.getFavoriteStatus(userId, productId)` returns `{ favorited: boolean }`.
- `UserService.addFavoriteProduct(userId, productId)` returns `{ favorited: true }`.
- `UserService.removeFavoriteProduct(userId, productId)` returns `{ favorited: false }`.
- `PrismaUserRepository.addFavoriteProduct()` uses `upsert` on unique `(userId, productId)`, making add idempotent.
- `PrismaUserRepository.removeFavoriteProduct()` uses `deleteMany({ userId, productId })`, making remove idempotent.
- `PrismaUserRepository.listFavoriteProducts()` includes product, shop, and active variants, ordered by favorite creation descending.

Favorite list response shape currently normalized by `BuyerFavoriteProduct`:

- `id`
- `productId`
- `title`
- `price`
- `currency`
- `shop: { id, name, slug }`
- `createdAt`

Important gap for later UI tasks:

- Favorite list data does not include product image, product status, shop status, variant id, variant stock, rating, sold count, badges, brand, or shop location.
- `toFavoriteProduct()` picks `favorite.product.variants[0]`, filtered to active variants in the repository. If no active variant exists, price falls back to `0` and currency falls back to `USD`.
- The wishlist page cannot safely implement add-to-cart or disabled availability states from the current favorite list payload alone unless it fetches richer product data or the favorite response is extended in a later task.

## Product Card Behavior

File: `app/features/product/components/ProductCard.tsx`

Rendering:

- Uses `BuyerProduct` from `app/features/product/queries.ts`.
- Renders image from `product.images[0]` through `resolveUploadedImageUrl()`.
- Renders title, brand, price or price range, original price, sold count/unavailable label, rating, shop location, shop name, badges, discount label, and out-of-stock overlay.
- Uses `product.stock <= 0` to show unavailable/out-of-stock state.
- Uses variant-level `stock > 0` to identify purchasable variants.

Favorite behavior:

- Reads session with `useSession()`.
- Allows favorite state only when `session?.user.role === "USER"`.
- Fetches favorite status with `["buyer-favorite-status", product.id]`, enabled only for buyer sessions.
- Mutates add/remove using the existing favorite helpers.
- On success invalidates:
  - `["buyer-favorite-status", product.id]`
  - `["buyer-favorites"]`
- Unauthenticated and non-buyer users see the favorite button disabled with title/aria text instead of being redirected.

Quick add behavior:

- Finds a `quickAddVariant` only when:
  - product has no options,
  - exactly one variant has stock,
  - that variant has no option values.
- Calls `addCartItem(quickAddVariant.id, 1)`.
- On success invalidates `["buyer-cart"]`.
- Uses `showAddToCartSuccess()` and `showAddToCartError()` from `app/features/product/cart-handoff.ts`.
- Keeps the user on the current surface and offers "View cart" in the toast.

## Product Detail Behavior

File: `app/features/product/components/ProductDetailPage.tsx`

- Fetches richer product detail with `publicProductDetailQueryOptions()` and `normalizePublicProduct()`.
- Uses the same favorite status key and invalidates `["buyer-favorite-status", productId]` plus `["buyer-favorites"]`.
- Purchase actions redirect unauthenticated users to `localePath("/login?next=<encoded product path>")`.
- Favorite button currently redirects unauthenticated users to `localePath("/login")` without a `next` path.
- Add-to-cart uses selected variant id and selected quantity, invalidates `["buyer-cart"]`, and uses the shared cart handoff toast.

## Cart Integration

Frontend helpers in `app/features/buyer/api.ts`:

- `fetchCart(locale?)`
  - `GET /api/cart?locale=<locale>`
  - Normalized into `BuyerCart`.
- `addCartItem(variantId, quantity)`
  - `POST /api/cart/items`
  - Body: `{ variantId, quantity }`
  - Returns normalized cart.
- `updateCartItem(itemId, quantity)`
  - `PATCH /api/cart/items/:itemId`
  - Body: `{ quantity }`
- `removeCartItem(itemId)`
  - `DELETE /api/cart/items/:itemId`

Current cart page:

- Route `app/[locale]/(buyer)/cart/page.tsx` calls `await requireUser()`.
- Component `app/features/cart/components/CartPage.tsx` uses query key `["buyer-cart", locale]`.
- Update/remove mutations invalidate `["buyer-cart", locale]`.

Product add-to-cart surfaces:

- Product card and product detail invalidate `["buyer-cart"]`.
- This broader invalidation should match all buyer-cart query variants, including locale-keyed cart queries.

Backend cart routes:

- File: `server/modules/cart/cart.routes.ts`
- Routes are protected with `{ withAuth: true }`.
- Add body is based on generated `CartItemPlainInputCreate` for `quantity`, plus explicit `variantId`, optional `sessionId`, and optional `source`.

Backend cart service:

- File: `server/modules/cart/cart.service.ts`
- Only buyer accounts can use cart APIs; admin actors receive `CART_FORBIDDEN`.
- Quantity must be a positive integer.
- Add/update validates:
  - variant exists,
  - product status is `ACTIVE`,
  - shop status is `ACTIVE`,
  - available quantity is enough.
- Available quantity is `inventory.quantityOnHand - inventory.quantityReserved`.
- Unit price and currency are read server-side from the variant. Client-provided price is not accepted.

## Product Availability Fields

Public product frontend shape from `BuyerProduct` in `app/features/product/queries.ts` includes:

- Product-level `stock`, derived from variant available stock.
- Variant-level `stock`, derived from `inventory.quantityOnHand - inventory.quantityReserved`.
- `variants[].id`, `title`, `sku`, `price`, `currency`, `stock`, and option values.
- Product `price`, `minPrice`, `maxPrice`, `currency`, `rating`, `soldCount`, `badges`, `images`, shop metadata, and brand metadata.

Database/source fields relevant to availability:

- `Product.status`
- `ProductVariant.status`
- `Inventory.quantityOnHand`
- `Inventory.quantityReserved`
- `Shop.status`

Favorite list availability gap:

- The current favorite list endpoint only includes active variants but does not expose stock, product status, shop status, image, or variant id.
- Existing cart API can enforce availability and pricing, but wishlist UI cannot pre-render accurate add-to-cart disabled states without richer data.

## Auth Flow

Server-side auth utility:

- `requireUser()` in `app/lib/auth-server.ts` redirects unauthenticated users to localized `/login` with `next=<current pathname>`.
- The current pathname is read from `x-pathname`.

Login behavior:

- `app/[locale]/login/page.tsx` resolves and sanitizes `next`.
- `LoginForm` pushes `resolveNextPath(nextPath)` after successful login.

Current buyer route pattern:

- Cart, chat, and notifications call `requireUser()` in the route page.
- Wishlist currently does not.

Favorite buttons:

- ProductCard disables favorite for unauthenticated/non-buyer sessions and does not redirect.
- ProductDetail redirects unauthenticated favorite clicks to localized `/login` without `next`.
- ProductDetail purchase actions do include product return path.

## Implementation Blockers To Address Before UI Work

- Wishlist login handoff is incomplete: add `requireUser()` to the wishlist route in a later task to match cart behavior and preserve return path.
- Wishlist add-to-cart requires a variant id. Current `BuyerFavoriteProduct` does not expose any variant id.
- Wishlist disabled availability states require at least product active state, shop active state, and available stock. Current favorite list response does not expose those fields.
- Wishlist product-card presentation requires image and trust signals. Current favorite list response does not expose image, rating, sold count, badges, brand, or shop location.

## Recommended Integration Direction For Later Tasks

- Keep `FavoriteProduct` and existing favorite routes as the canonical saved-product source.
- Reuse favorite mutation helpers and cache keys:
  - remove invalidates or updates `["buyer-favorites"]`;
  - product surfaces already invalidate `["buyer-favorites"]`.
- Reuse cart helper `addCartItem(variantId, quantity)` and shared `showAddToCartSuccess()` / `showAddToCartError()` feedback.
- Reuse ProductCard visual conventions, but do not pass current `BuyerFavoriteProduct` directly to `ProductCard` unless the data is enriched to satisfy `BuyerProduct`.
- Prefer extending the existing favorite list response or composing favorite ids with public product detail/list data in a later implementation task. The chosen approach should preserve favorite APIs and avoid a new wishlist model.
