# Auth and Authorization Matrix

This document defines marketplace roles, permissions, and authorization rules.

## User Types

- Guest
- Buyer
- Seller identity (authenticated user with seller profile and active owned shop)
- Admin
- Payment Gateway
- Shipping Provider

`User.role` is reserved for platform-level access only: `USER` and `ADMIN`.
Seller authorization must not depend on a user role. A seller is a user who owns an `ACTIVE` shop, optionally through an active shop staff membership when staff access is implemented.

## Authentication Rules

- Guest can browse public buyer routes.
- Buyer auth is required for cart persistence, checkout, orders, reviews, returns/refunds, chat, and account.
- Verified email is required for trusted protected marketplace flows and admin access.
- Suspended users are blocked at the auth boundary.
- Seller onboarding/status requires authentication.
- Seller operations require authentication plus an `ACTIVE` shop where `Shop.ownerId` equals the authenticated user id.
- Admin role is required for admin routes.
- Provider webhooks use signature verification, not user sessions.
- Phone OTP auth supports login for users with `phoneVerified = true`, pending signup for verified new phones, and authenticated profile phone linking.
- Phone signup still requires email, name, and password before user creation; phone-only users are not supported.
- Local phone OTP delivery uses a deterministic dev/mock provider. A production SMS adapter is out of scope and must be configured before production phone OTP delivery.

## Route Protection

| Area | Auth Requirement |
| --- | --- |
| Home/search/category/product detail | Public |
| Cart | Authenticated user |
| Checkout | Verified authenticated user |
| Payment return | Buyer |
| Orders/reviews/returns/account/chat | Authenticated user |
| Seller onboarding/status | Authenticated user |
| Seller dashboard/products/inventory/orders | Active shop owner |
| Admin users/shops/products/orders/refunds/reports | Verified admin |
| Payment webhook | Provider signature |
| Shipping webhook | Provider signature |

## Permission Matrix

| Capability | Guest | Buyer user | Active shop owner | Admin | Provider |
| --- | --- | --- | --- | --- | --- |
| Browse products | Yes | Yes | Yes | Yes | No |
| View product detail | Yes | Yes | Yes | Yes | No |
| Add to cart | Login required for persistence | Yes | Yes | No | No |
| Checkout | No | Yes | Yes | No | No |
| Pay order | No | Own orders | No | No | Gateway processes |
| View buyer orders | No | Own orders | Own orders | All orders | No |
| Review product | No | Purchased eligible items | Purchased eligible items | Moderate if supported | No |
| Request return/refund | No | Own eligible items | Own eligible items | Review/escalate | No |
| Manage products | No | No | Own shop | Moderate all | No |
| Manage inventory | No | No | Own shop variants | Inspect all | No |
| Process shipments | No | No | Own shop shipments | Inspect all | Shipping updates |
| Manage users | No | Own account | Own account | All users | No |
| Manage shops | No | No | Own shop limited | All shops | No |
| Mark payment success | No | No | No | No | Payment webhook only |

## Ownership Rules

Buyer ownership:
- cart belongs to buyer
- checkout belongs to buyer
- order belongs to buyer
- return/refund request belongs to buyer order
- chat thread must include buyer

Seller ownership:
- seller onboarding application belongs to authenticated user
- seller operational access requires an active shop owned by authenticated user
- shop staff access requires active `ShopStaff` membership and explicit permissions when enabled
- seller product must belong to seller shop
- seller inventory must belong to seller shop variant
- seller shipment must belong to seller shop
- seller promotion must belong to seller shop
- seller chat thread must include seller shop

Admin access:
- admin can inspect all operational resources
- admin mutations should record reason/audit metadata where applicable

## Provider Rules

Payment Gateway:
- must send signed webhook
- event must be idempotent
- only verified webhook can mark payment succeeded

Shipping Provider:
- must send signed callback where supported
- tracking updates must map to a known shipment
- duplicate tracking events must be idempotent

## Frontend Rules

- Hide actions the user cannot perform.
- Still enforce permissions on the backend.
- Redirect unauthenticated users to login with return path.
- Show `403` permission error when authenticated user lacks required role, active shop, or ownership.
- Never trust frontend role checks as authorization.

## Acceptance Checklist

- Protected backend routes use auth macros.
- Seller routes validate active shop ownership.
- Buyer routes validate resource ownership.
- Admin routes validate admin role.
- Webhook routes validate provider signatures.
