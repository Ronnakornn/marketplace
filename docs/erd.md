# Marketplace ERD

```mermaid
erDiagram
  USER {
    string id PK
    string email UK
    string name
    string role
    datetime createdAt
    datetime updatedAt
  }

  SHOP {
    string id PK
    string ownerId FK
    string name
    string slug UK
    string status
    datetime createdAt
    datetime updatedAt
  }

  PRODUCT {
    string id PK
    string shopId FK
    string categoryId FK
    string title
    string slug
    string status
    datetime createdAt
    datetime updatedAt
  }

  CATEGORY {
    string id PK
    string name
    string slug UK
    int sortOrder
    boolean isActive
    datetime createdAt
    datetime updatedAt
  }

  PRODUCT_VARIANT {
    string id PK
    string productId FK
    string sku UK
    string title
    decimal price
    string currency
    datetime createdAt
    datetime updatedAt
  }

  INVENTORY {
    string id PK
    string variantId FK
    int quantityOnHand
    int quantityReserved
    int reorderLevel
    datetime updatedAt
  }

  INVENTORY_RESERVATION {
    string id PK
    string checkoutId FK
    string variantId FK
    int quantity
    string status
    datetime expiresAt
    datetime createdAt
  }

  CART {
    string id PK
    string userId FK
    string status
    datetime createdAt
    datetime updatedAt
  }

  CART_ITEM {
    string id PK
    string cartId FK
    string variantId FK
    int quantity
    datetime createdAt
    datetime updatedAt
  }

  CHECKOUT {
    string id PK
    string cartId FK
    string userId FK
    string status
    decimal subtotal
    decimal discountTotal
    decimal shippingTotal
    decimal taxTotal
    decimal grandTotal
    datetime expiresAt
    datetime createdAt
  }

  ORDER {
    string id PK
    string checkoutId FK
    string userId FK
    string orderNumber UK
    string status
    string paymentStatus
    decimal grandTotal
    datetime createdAt
    datetime updatedAt
  }

  ORDER_ITEM {
    string id PK
    string orderId FK
    string shopId FK
    string variantId FK
    string productTitle
    string variantTitle
    int quantity
    decimal unitPrice
    decimal lineTotal
    string fulfillmentStatus
  }

  PAYMENT {
    string id PK
    string orderId FK
    string provider
    string providerIntentId UK
    string status
    decimal amount
    string currency
    datetime createdAt
    datetime updatedAt
  }

  PAYMENT_EVENT {
    string id PK
    string paymentId FK
    string providerEventId UK
    string eventType
    json payload
    datetime receivedAt
  }

  SHIPMENT {
    string id PK
    string orderId FK
    string shopId FK
    string status
    string carrier
    string trackingNumber
    datetime shippedAt
    datetime deliveredAt
  }

  SHIPMENT_ITEM {
    string id PK
    string shipmentId FK
    string orderItemId FK
    int quantity
  }

  COUPON {
    string id PK
    string shopId FK
    string code UK
    string discountType
    decimal discountValue
    datetime startsAt
    datetime endsAt
  }

  COUPON_REDEMPTION {
    string id PK
    string couponId FK
    string userId FK
    string orderId FK
    datetime redeemedAt
  }

  REVIEW {
    string id PK
    string userId FK
    string productId FK
    string orderItemId FK
    int rating
    string body
    string status
    datetime createdAt
  }

  REFUND {
    string id PK
    string orderId FK
    string paymentId FK
    string status
    decimal amount
    string reason
    datetime createdAt
  }

  RETURN_REQUEST {
    string id PK
    string orderId FK
    string userId FK
    string status
    string reason
    datetime createdAt
  }

  RETURN_ITEM {
    string id PK
    string returnRequestId FK
    string orderItemId FK
    int quantity
    string condition
  }

  CHAT_THREAD {
    string id PK
    string buyerId FK
    string shopId FK
    string orderId FK
    datetime createdAt
  }

  CHAT_MESSAGE {
    string id PK
    string threadId FK
    string senderId FK
    string body
    datetime createdAt
  }

  NOTIFICATION {
    string id PK
    string userId FK
    string type
    string title
    string body
    string readAt
    datetime createdAt
  }

  USER ||--o{ SHOP : owns
  SHOP ||--o{ PRODUCT : sells
  PRODUCT ||--o{ PRODUCT_VARIANT : has
  PRODUCT_VARIANT ||--|| INVENTORY : tracks
  PRODUCT_VARIANT ||--o{ INVENTORY_RESERVATION : reserves
  USER ||--o{ CART : owns
  CART ||--o{ CART_ITEM : contains
  PRODUCT_VARIANT ||--o{ CART_ITEM : selected
  CART ||--o| CHECKOUT : becomes
  CHECKOUT ||--o{ INVENTORY_RESERVATION : holds
  CHECKOUT ||--o| ORDER : creates
  USER ||--o{ ORDER : places
  ORDER ||--o{ ORDER_ITEM : contains
  SHOP ||--o{ ORDER_ITEM : fulfills
  PRODUCT_VARIANT ||--o{ ORDER_ITEM : purchased
  ORDER ||--o{ PAYMENT : paid_by
  PAYMENT ||--o{ PAYMENT_EVENT : receives
  ORDER ||--o{ SHIPMENT : split_into
  SHOP ||--o{ SHIPMENT : ships
  SHIPMENT ||--o{ SHIPMENT_ITEM : contains
  ORDER_ITEM ||--o{ SHIPMENT_ITEM : allocated
  SHOP ||--o{ COUPON : offers
  COUPON ||--o{ COUPON_REDEMPTION : redeemed
  ORDER ||--o{ COUPON_REDEMPTION : applies
  USER ||--o{ REVIEW : writes
  PRODUCT ||--o{ REVIEW : receives
  ORDER_ITEM ||--o| REVIEW : verifies
  ORDER ||--o{ REFUND : refunded_by
  PAYMENT ||--o{ REFUND : returns_money
  ORDER ||--o{ RETURN_REQUEST : has
  RETURN_REQUEST ||--o{ RETURN_ITEM : includes
  ORDER_ITEM ||--o{ RETURN_ITEM : returned
  USER ||--o{ CHAT_THREAD : starts
  SHOP ||--o{ CHAT_THREAD : participates
  ORDER ||--o{ CHAT_THREAD : references
  CHAT_THREAD ||--o{ CHAT_MESSAGE : contains
  USER ||--o{ CHAT_MESSAGE : sends
  USER ||--o{ NOTIFICATION : receives
```

Notes:
- A single `ORDER` can contain `ORDER_ITEM` rows from many shops.
- Fulfillment is split by `SHIPMENT.shopId`, with `SHIPMENT_ITEM` allocating order item quantities.
- `INVENTORY_RESERVATION` holds stock during checkout and expires if checkout is abandoned.
- `PAYMENT.status = succeeded` must be set from verified `PAYMENT_EVENT` webhook data, not from browser redirect state.
