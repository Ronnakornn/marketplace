# Order, Payment, Shipment, Return, and Refund State Machines

This document defines allowed marketplace state transitions.

## Core Rules

- Payment success comes only from verified payment webhook.
- Checkout reserves stock before payment intent creation.
- Payment success commits reserved stock and creates shipments by shop.
- Payment failure, cancellation, or checkout expiry releases reserved stock.
- Shipments are split by shop.
- Refund completion should follow payment provider confirmation.

## Checkout State Machine

```mermaid
stateDiagram-v2
  [*] --> Open
  Open --> Reserved: reserve stock succeeds
  Open --> Canceled: buyer cancels
  Open --> Expired: draft expires
  Reserved --> PaymentPending: place order + create payment intent
  Reserved --> Expired: reservation expires
  Reserved --> Canceled: buyer cancels before payment
  PaymentPending --> Completed: payment webhook succeeds
  PaymentPending --> Canceled: payment webhook fails/cancels
  Expired --> [*]
  Canceled --> [*]
  Completed --> [*]
```

Invalid transitions:
- `Open` directly to `Completed`
- `PaymentPending` to `Completed` from browser redirect
- `Expired` back to `Reserved` without a new reservation

## Payment State Machine

```mermaid
stateDiagram-v2
  [*] --> RequiresAction
  RequiresAction --> Pending: payment intent created
  Pending --> Succeeded: verified webhook succeeded
  Pending --> Failed: verified webhook failed
  Pending --> Canceled: verified webhook canceled
  Succeeded --> Refunded: refund confirmed
  Failed --> [*]
  Canceled --> [*]
  Refunded --> [*]
```

Invalid transitions:
- `Pending` to `Succeeded` from client redirect
- duplicate webhook creating duplicate success side effects
- `Failed` to `Succeeded` without a new valid provider event model

## Order State Machine

```mermaid
stateDiagram-v2
  [*] --> PendingPayment
  PendingPayment --> Paid: payment webhook succeeded
  PendingPayment --> Canceled: payment failed/canceled/expired
  Paid --> PartiallyFulfilled: at least one shipment shipped/delivered
  Paid --> Fulfilled: all shipments delivered
  PartiallyFulfilled --> Fulfilled: all shipments delivered
  Paid --> Refunded: full refund completed
  PartiallyFulfilled --> Refunded: full refund completed
  Fulfilled --> Refunded: full refund completed
  Canceled --> [*]
  Refunded --> [*]
```

Order status is derived from payment and shipment/refund state. Avoid hand-setting order status in unrelated flows.

## Shipment State Machine

```mermaid
stateDiagram-v2
  [*] --> Pending
  Pending --> Ready: order paid + shipment created
  Ready --> Shipped: seller adds carrier/tracking
  Shipped --> Delivered: provider/manual delivery confirmation
  Pending --> Canceled: order canceled/refunded
  Ready --> Canceled: shipment canceled/refunded
  Delivered --> [*]
  Canceled --> [*]
```

Rules:
- Shipment belongs to one shop.
- Seller can only transition shipments for their shop.
- Shipment delivery can update order state when all shipments are delivered.

## Return State Machine

```mermaid
stateDiagram-v2
  [*] --> Requested
  Requested --> Approved: seller/admin approves
  Requested --> Rejected: seller/admin rejects
  Approved --> Received: returned item received
  Approved --> RefundPending: return not required
  Received --> RefundPending: refund created
  RefundPending --> Refunded: refund provider confirms
  Rejected --> [*]
  Refunded --> [*]
```

Rules:
- Buyer can request return/refund only for eligible order items.
- Approval may require seller or admin review.
- Refund completion should be provider-confirmed.

## Refund State Machine

```mermaid
stateDiagram-v2
  [*] --> Requested
  Requested --> Processing: refund sent to provider
  Processing --> Succeeded: provider confirms refund
  Processing --> Failed: provider rejects/fails
  Failed --> Processing: retry provider refund
  Succeeded --> [*]
```

## Idempotency Requirements

- Payment webhook idempotency key: provider event id.
- Shipping webhook idempotency key: provider event id or tracking event id.
- Refund provider confirmation idempotency key: provider refund event id.
- Duplicate events must return success or no-op after confirming the prior event was processed.

## Acceptance Checklist

- No client-only action can mark payment succeeded.
- Stock reservation, commit, and release are tied to state transitions.
- Shipments are created once per shop after payment success.
- Duplicate webhooks do not duplicate shipments or stock movement.
- Buyer, seller, and admin UIs display valid status labels only.
