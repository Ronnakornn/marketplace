# Backend Issue 003: Active Shop Authorization

## Impact

Seller operations must no longer use `withRole: 'SELLER'` or `role === 'SELLER'`. Access depends on active shop ownership and later shop staff permissions.

## Tasks

- Search backend for `SELLER` role checks and remove/replace them.
- Centralize active shop resolution for seller operations.
- Apply active shop guard to products, variants, inventory, shipments, returns, promotions, wallet, payouts, notifications, and seller chat.
- Ensure buyer APIs allow users who also own active shops.
- Prepare extension point for `ShopStaff` permissions.

## Acceptance Criteria

- User with active owned shop can use seller APIs while `User.role` remains `USER`.
- Pending/rejected/suspended/banned/vacation shops cannot use operational seller APIs.
- Cross-shop access remains blocked.
- Admin-only APIs still require `ADMIN`.
