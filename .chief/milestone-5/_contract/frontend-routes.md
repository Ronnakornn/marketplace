# Contract: Frontend Routes

## Seller Routes

Required routes:

- `/seller/products`
- `/seller/products/new`
- `/seller/products/:productId`
- `/seller/inventory`

Rules:

- Seller routes use existing seller shell/navigation patterns.
- Unauthorized or non-seller users see the existing forbidden/redirect behavior.
- Product editor route uses a single editor experience with section navigation.
- New product route creates or prepares a draft before entering the editor.

## Admin Routes

Required routes:

- `/admin/products`
- `/admin/products/:productId`
- `/admin/categories`

Rules:

- Admin routes use existing admin shell/navigation patterns.
- Admin product pages consume milestone 4 admin moderation APIs.
- Category page manages category tree and spec definitions from milestone 4 APIs.

## Buyer Routes

Required route updates:

- `/products/:productId`

Rules:

- Buyer product detail remains the primary transaction surface.
- Homepage and full search redesign are out of scope.
- Product cards may receive small compatibility updates for primary image, price range, and stock state.
