# Checkout Flow

```mermaid
flowchart TD
  A[Buyer opens cart] --> B[Validate cart items]
  B --> C{All products active<br/>and variants available?}
  C -- No --> C1[Show cart errors<br/>remove or update invalid items]
  C1 --> A
  C -- Yes --> D[Create checkout]

  D --> E[Calculate item totals<br/>by shop]
  E --> F[Apply coupons]
  F --> G[Add each selected shop's<br/>seller-defined shipping fee once]
  G --> G1[Calculate tax and grand total]
  G1 --> H[Reserve inventory in transaction]

  H --> I{Enough stock after<br/>existing reservations?}
  I -- No --> I1[Fail checkout reservation]
  I1 --> I2[Release any partial holds]
  I2 --> A

  I -- Yes --> J[Create active inventory reservations<br/>with expiry time]
  J --> K[Create payment intent<br/>with payment provider]
  K --> L[Create pending order<br/>from checkout snapshot]
  L --> M[Create order items<br/>preserving shop, product, variant, price]
  M --> N[Mark checkout PAYMENT_PENDING]
  N --> O[Redirect buyer to payment UI]

  O --> P[Buyer completes provider payment]
  P --> Q[Provider sends webhook]
  Q --> R[Verify webhook signature<br/>and idempotency key]

  R --> S{Payment succeeded?}
  S -- No --> S1[Record payment event]
  S1 --> S2[Mark payment/order failed if terminal]
  S2 --> S3[Release inventory reservations]
  S3 --> S4[Notify buyer]

  S -- Yes --> T[Record payment event]
  T --> U[Mark payment SUCCEEDED]
  U --> V[Mark order PAID]
  V --> W[Commit inventory reservations<br/>decrease on-hand, clear reserved]
  W --> X[Split fulfillment by shop]
  X --> Y[Create one shipment per shop]
  Y --> Z[Notify buyer and shops]
```

Rules:
- Stock is reserved before the buyer enters payment to prevent oversell.
- Reservations must expire and release automatically if checkout is abandoned.
- The browser return page can show pending status, but it must not mark payment successful.
- Payment success is accepted only from a verified provider webhook.
- Order items store shop and price snapshots because catalog data can change later.
- Manual shipping fees are configured by each seller in baht, stored in minor units, and charged once per selected shop.
