# Contract: Frontend UI

## Seller Pages

Required pages:

- `/seller/products`
- `/seller/products/new`
- `/seller/products/:productId`
- `/seller/inventory`

Required behavior:

- product list supports search and status filters
- create product saves a draft
- edit page manages content, category specs, media, variants, inventory, and review submission
- inventory page shows on-hand, reserved, available, reorder level, and low-stock state
- moderation result and rejection reason are visible to seller

## Admin Pages

Required pages:

- `/admin/products`
- `/admin/products/:productId`
- `/admin/categories`

Required behavior:

- moderation queue filters pending, active, rejected, suspended, and archived products
- admin can approve, reject, suspend, and restore products
- reject and suspend actions collect a reason
- admin can manage category hierarchy and category specs

## Frontend Rules

- Use Eden Treaty inferred types.
- Use TanStack Query for server state.
- Keep feature code under `app/features/catalog`, `app/features/product`, `app/features/seller`, or `app/features/admin`.
- Do not place business logic in shared UI components.
- Handle loading, empty, error, forbidden, and mutation pending states.
