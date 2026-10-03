# Fulfillment Flow

```mermaid
flowchart TD
  A[Payment webhook marks order PAID] --> B[Group order items by shop]
  B --> C[Create shipment for each shop]
  C --> D[Create shipment items<br/>for that shop's order items]
  D --> E[Notify each shop<br/>new shipment ready]

  E --> F[Shop opens fulfillment queue]
  F --> G{Can fulfill all items?}
  G -- No --> G1[Contact buyer or marketplace support]
  G1 --> G2{Cancel, refund, or partial fulfill?}
  G2 -- Cancel/refund --> G3[Create refund request]
  G3 --> G4[Refund provider via payment API]
  G4 --> G5[Wait for refund webhook]
  G5 --> G6[Mark refund completed<br/>update order item status]
  G2 -- Partial fulfill --> H

  G -- Yes --> H[Pack items]
  H --> I[Buy or enter shipping label]
  I --> J[Add carrier and tracking number]
  J --> K[Mark shipment SHIPPED]
  K --> L[Notify buyer with tracking]
  L --> M[Carrier updates delivery status]
  M --> N{Delivered?}
  N -- No --> N1[Keep shipment in transit]
  N1 --> M
  N -- Yes --> O[Mark shipment DELIVERED]
  O --> P[Update shipment item statuses]
  P --> Q{All shipments delivered?}
  Q -- No --> R[Order remains partially fulfilled]
  Q -- Yes --> S[Mark order FULFILLED]
  S --> T[Open review window]

  T --> U{Buyer requests return?}
  U -- No --> V[Order lifecycle complete]
  U -- Yes --> W[Create return request]
  W --> X[Shop/admin reviews return]
  X --> Y{Approved?}
  Y -- No --> Y1[Reject return<br/>notify buyer]
  Y -- Yes --> Z[Buyer ships return]
  Z --> AA[Shop receives return]
  AA --> AB[Inspect return items]
  AB --> AC{Refund due?}
  AC -- No --> V
  AC -- Yes --> AD[Create refund]
  AD --> AE[Refund provider via payment API]
  AE --> AF[Refund webhook confirms]
  AF --> AG[Mark return REFUNDED<br/>notify buyer]
```

Rules:
- Shipments are split by `shopId`; a multi-vendor order has multiple shop-owned shipments.
- Shipment items allocate quantities from order items, allowing partial fulfillment.
- Packing, shipping, and delivery lock the parent order before changing shipment state, serializing concurrent updates from different shops. After shipping or delivery, the parent is `DELIVERED` when every shipment is delivered, `SHIPPED` when every shipment is shipped or delivered, and `PARTIALLY_FULFILLED` otherwise.
- Refund completion should follow payment provider confirmation, preferably webhook-backed.
- Return approvals and refund amounts are separate decisions from shipment delivery.
- Item refunds use the shop-order subtotal minus its snapshotted coupon/coin discounts. Discounts are allocated across that shop's items in stable ID order, retaining every minor unit; item refunds exclude shipping charges.
- Both admin refund endpoints (`/status` and the legacy `/process`) use the same approval policy: record the processing administrator, then require a different completing administrator and an external refund reference. Legacy processing records without an administrator must be marked processing again before completion.
- Refund completion locks the order, checks the remaining paid amount, and atomically records seller wallet debits and buyer coin adjustments. Retrying completion does not debit again. A return debits its shop; an order-wide refund is allocated across shop-order totals.
