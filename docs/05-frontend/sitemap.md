# Marketplace Sitemap

This sitemap expands the marketplace user flow into implementation-ready route groups for a mobile-first Shopee/Lazada-style marketplace.

Core navigation goals:
- Make product discovery reachable in one tap from mobile.
- Keep cart, checkout, and order tracking short and clear.
- Separate buyer, seller, admin, and callback surfaces.
- Preserve multi-vendor rules: cart and checkout grouped by shop, one order split into shipments by shop, payment success confirmed only by webhook.

## Route Map

```mermaid
flowchart TD
  Root[/ Marketplace Home] --> Search[/search]
  Root --> Categories[/categories]
  Root --> Deals[/deals]
  Root --> Cart[/cart]
  Root --> Account[/account]

  Search --> SearchResults[/search?q=keyword]
  Categories --> CategoryFeed[/categories/:slug]
  Deals --> ProductList[Product feed]
  SearchResults --> ProductDetail[/products/:productId]
  CategoryFeed --> ProductDetail
  ProductList --> ProductDetail

  ProductDetail --> Cart
  ProductDetail --> Checkout[/checkout]
  Cart --> Checkout
  Checkout --> PaymentReturn[/payment/return]
  PaymentReturn --> OrderDetail[/orders/:orderId]

  Account --> Orders[/orders]
  Orders --> OrderDetail
  OrderDetail --> Review[/orders/:orderId/review]
  OrderDetail --> ReturnNew[/orders/:orderId/returns/new]
  Account --> Addresses[/account/addresses]
  Account --> Chat[/chat]
  Chat --> ChatThread[/chat/:threadId]

  SellerLogin[/seller/login] --> SellerRegister[/seller/register]
  SellerRegister --> SellerStatus[/seller/status]
  SellerStatus --> SellerDashboard[/seller]
  SellerDashboard --> SellerProducts[/seller/products]
  SellerProducts --> SellerProductNew[/seller/products/new]
  SellerProducts --> SellerProductEdit[/seller/products/:productId]
  SellerDashboard --> SellerInventory[/seller/inventory]
  SellerDashboard --> SellerOrders[/seller/orders]
  SellerOrders --> SellerShipment[/seller/orders/:shipmentId]
  SellerDashboard --> SellerShipping[/seller/shipping]
  SellerDashboard --> SellerFinance[/seller/finance]
  SellerDashboard --> SellerPromotions[/seller/promotions]
  SellerDashboard --> SellerChat[/seller/chat]

  AdminDashboard[/admin] --> AdminUsers[/admin/users]
  AdminDashboard --> AdminShops[/admin/shops]
  AdminDashboard --> AdminProducts[/admin/products]
  AdminDashboard --> AdminOrders[/admin/orders]
  AdminDashboard --> AdminRefunds[/admin/refunds]
  AdminDashboard --> AdminCommissions[/admin/commissions]
  AdminDashboard --> AdminReports[/admin/reports]

  PaymentGateway[Payment Gateway] --> PaymentWebhook[/api/payments/webhook]
  ShippingProvider[Shipping Provider] --> ShippingWebhook[/api/shipping/webhook]
```

## Buyer Routes

| Route | Auth | Purpose | Primary CTA | Top Search | Bottom Nav |
| --- | --- | --- | --- | --- | --- |
| `/` | Public | Marketplace home feed with flash sale, categories, recommendations | Open product | Sticky compact | Visible |
| `/search` | Public | Search entry with recent and trending keywords | Search | Focused input | Hidden while typing |
| `/search?q=<keyword>` | Public | Search results with filter and sort | Open product | Sticky compact | Visible |
| `/categories` | Public | Category index | Open category | Sticky compact | Visible |
| `/categories/:slug` | Public | Category product feed | Open product | Sticky compact | Visible |
| `/deals` | Public | Flash sale and campaign feed | Open deal product | Sticky compact | Visible |
| `/products/:productId` | Public | Product detail with variants, reviews, shop card | Add to Cart / Buy Now | Compact back/search | Hidden behind sticky CTA |
| `/cart` | Buyer | Cart grouped by shop | Checkout selected | Optional compact | Visible |
| `/checkout` | Buyer | Single-page checkout | Place order | Hidden | Hidden behind checkout CTA |
| `/payment/return` | Buyer | Payment pending/result after gateway return | View order / Retry payment | Hidden | Hidden |
| `/orders` | Buyer | Buyer order list | Track order | Optional compact | Visible |
| `/orders/:orderId` | Buyer | Order detail with per-shop shipment tracking | Track / Review / Return | Hidden | Visible |
| `/orders/:orderId/review` | Buyer | Review purchased items | Submit review | Hidden | Hidden |
| `/orders/:orderId/returns/new` | Buyer | Return/refund request | Submit request | Hidden | Hidden |
| `/account` | Buyer | Buyer account hub | View orders | Hidden | Visible |
| `/account/addresses` | Buyer | Address book | Add address | Hidden | Hidden |
| `/chat` | Buyer | Buyer chat inbox | Open thread | Hidden | Visible |
| `/chat/:threadId` | Buyer | Buyer/seller chat thread | Send message | Hidden | Hidden |

## Seller Routes

| Route | Auth | Purpose | Primary CTA | Navigation |
| --- | --- | --- | --- | --- |
| `/seller/login` | Public | Seller login or redirect to shared auth | Login | Minimal |
| `/seller/register` | User | Shop onboarding, KYC, payout, pickup address, document upload | Submit for review | Seller onboarding |
| `/seller/status` | User | Pending/rejected seller application state | Edit / resubmit | Seller onboarding |
| `/seller` | Active shop owner | Seller dashboard with operational alerts | Process orders | Seller sidebar or mobile tabs |
| `/seller/products` | Active shop owner | Seller product list and status filters | Create product | Seller nav |
| `/seller/products/new` | Active shop owner | Create product and variants | Save draft / Submit | Step header |
| `/seller/products/:productId` | Active shop owner | Edit product, variants, content, status | Save changes | Step header |
| `/seller/inventory` | Active shop owner | Inventory and low-stock management | Update stock | Seller nav |
| `/seller/orders` | Active shop owner | Paid shipment queue by shop | Process shipment | Seller nav |
| `/seller/orders/:shipmentId` | Active shop owner | Pack shipment, add tracking, mark shipped | Mark shipped | Sticky action |
| `/seller/shipping` | Active shop owner | Shipping labels and tracking tools | Create label | Seller nav |
| `/seller/finance` | Active shop owner | Sales, fees, refunds, payout placeholder | Export report | Seller nav |
| `/seller/promotions` | Active shop owner | Coupons and campaigns | Create coupon | Seller nav |
| `/seller/chat` | Active shop owner | Seller chat inbox | Reply | Seller nav |

## Admin Routes

| Route | Auth | Purpose | Primary CTA | Navigation |
| --- | --- | --- | --- | --- |
| `/admin` | Admin | Admin dashboard with operational exceptions | Review exceptions | Admin sidebar |
| `/admin/users` | Admin | Customer and system user management | Update role/status | Admin sidebar |
| `/admin/shops` | Admin | Seller application review, shop approval, suspension | Approve / Reject / Suspend | Admin sidebar |
| `/admin/products` | Admin | Product policy monitoring | Suspend / Restore | Admin sidebar |
| `/admin/orders` | Admin | Order, payment, shipment monitoring | Inspect order | Admin sidebar |
| `/admin/refunds` | Admin | Refund and return escalation queue | Decide case | Admin sidebar |
| `/admin/commissions` | Admin | Commission configuration | Save rate | Admin sidebar |
| `/admin/reports` | Admin | Sales and operations reports | Export | Admin sidebar |

## System Callback Routes

| Route | Caller | Purpose | Frontend Display |
| --- | --- | --- | --- |
| `/api/payments/webhook` | Payment gateway | Verify signed events, update payment/order, commit or release reserved stock | None |
| `/api/shipping/webhook` | Shipping provider | Update shipment tracking and delivery status | None |

Payment rule: browser redirects and client status are never trusted as proof of success. The UI can show a pending state, but only the payment webhook can mark payment as succeeded.

## Mobile Navigation Model

Primary buyer bottom navigation:
- Home: `/`
- Categories: `/categories`
- Deals: `/deals`
- Cart: `/cart`
- Account: `/account`

High-conversion shortcuts:
- Search bar stays near the top on home, search results, category feeds, and deals.
- Product detail replaces bottom nav with a sticky Add to Cart / Buy Now bar.
- Cart and checkout use a sticky bottom summary CTA.
- Payment return uses a focused status page with no competing navigation.

## Implementation Notes

- Public browse routes must render useful content for guests.
- Buyer-only routes redirect unauthenticated users to login and return to the intended route after auth.
- Seller operational routes must enforce active shop ownership for products, inventory, shipments, promotions, finance, and chats.
- Buyer routes remain available to users who also own active shops.
- Admin routes must never be publicly exposed and must use admin role protection.
- Route-level UI should preserve bottom padding equal to fixed bottom navigation or sticky CTA height.
