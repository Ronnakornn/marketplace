# Auth and Authorization Matrix

This document defines marketplace roles, permissions, and authorization rules.

## User Types

- Guest
- Buyer
- Seller
- Admin
- Payment Gateway
- Shipping Provider

## Authentication Rules

- Guest can browse public buyer routes.
- Buyer auth is required for cart persistence, checkout, orders, reviews, returns/refunds, chat, and account.
- Seller auth and seller role are required for seller routes.
- Admin role is required for admin routes.
- Provider webhooks use signature verification, not user sessions.

## Route Protection

| Area | Auth Requirement |
| --- | --- |
| Home/search/category/product detail | Public |
| Cart | Buyer |
| Checkout | Buyer |
| Payment return | Buyer |
| Orders/reviews/returns/account/chat | Buyer |
| Seller dashboard/products/inventory/orders | Seller |
| Admin users/shops/products/orders/refunds/reports | Admin |
| Payment webhook | Provider signature |
| Shipping webhook | Provider signature |

## Permission Matrix

| Capability | Guest | Buyer | Seller | Admin | Provider |
| --- | --- | --- | --- | --- | --- |
| Browse products | Yes | Yes | Yes | Yes | No |
| View product detail | Yes | Yes | Yes | Yes | No |
| Add to cart | Login required for persistence | Yes | No | No | No |
| Checkout | No | Yes | No | No | No |
| Pay order | No | Own orders | No | No | Gateway processes |
| View buyer orders | No | Own orders | No | All orders | No |
| Review product | No | Purchased eligible items | No | Moderate if supported | No |
| Request return/refund | No | Own eligible items | No | Review/escalate | No |
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
- Show `403` permission error when authenticated user lacks role/ownership.
- Never trust frontend role checks as authorization.

## Acceptance Checklist

- Protected backend routes use auth macros.
- Seller routes validate shop ownership.
- Buyer routes validate resource ownership.
- Admin routes validate admin role.
- Webhook routes validate provider signatures.
