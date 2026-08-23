# Domain Context

Glossary of the project's ubiquitous language. Terms only — no implementation
details, no specs, no decisions. Decisions belong in `docs/adr/`.

## Commerce

### Product Draft

A seller-owned product listing that is not visible to buyers and is still being prepared for publication.
_Avoid_: Pending product, unapproved product

### Published Product

A seller-owned product listing made publicly available by its seller without pre-publication admin approval. It remains subject to marketplace moderation.
_Avoid_: Approved product

### Product Suspension

An admin decision that removes a Published Product from sale until an admin restores it. Suspension is reactive moderation, not pre-publication approval.
_Avoid_: Product rejection, pending review

### Checkout Quote

An estimate of the amount payable for one [[Cart]] at a point in time.
Comprises subtotal, discount, shipping, tax, and grand total. Produced by the
server, never by the client — see ADR-0001.

A Quote is **not a promise**. The amount actually charged when an Order is
created may differ if conditions change in between — a coupon reaching its
usage limit, stock running out. Producing a Quote writes nothing and reserves
no stock.

A coupon that cannot be applied does not invalidate a Quote; the Quote is
returned with the coupon marked as not applied, and the amount reflects that.
This is the opposite of Order creation, where an unusable coupon stops the
whole operation.

### Cart

A buyer's collection of items awaiting purchase. A Cart knows its items and
their prices. It does not know about coupons or shipping — the same Cart
yields different amounts under different [[Checkout Quote]]s.

### Guest Cart

A browser-local collection of variant quantities before sign-in. It is merged
into the buyer's Cart after sign-in and is not a server-side cart.

### Unavailable Cart Item

A Cart Item whose product, shop, or stock no longer permits purchase. It
remains visible and removable but cannot be selected for Checkout.

### Checkout Selection

The subset of Cart Items a buyer explicitly chooses to purchase in one
Checkout. Items outside a Checkout Selection remain in the Cart.

### Buyer Order Cancellation

A buyer's cancellation of an entire unpaid Order before payment completes.
It releases the checkout's inventory reservation and does not restore items
to the Cart. Paid or fulfilled Orders use the Return and Refund flow.

### Return Approval

A seller decision accepting a buyer's Return Request and authorizing the next
return or refund step. Return Approval is not Refund Completion.

### Payout Rejection

A decision declining a seller's Payout Request. A Payout Rejection includes a
reason the requester can act on and is not a failed transfer.

## Seller Operations

### Shop Owner

The user who owns a Shop and exclusively controls its settings, finance, and staff.
_Avoid_: Admin staff, super seller

### Shop Staff Member

An existing platform user assigned to one Shop with an accepted operational preset.
_Avoid_: Shop owner, global seller

### Staff Invitation

A pending assignment from a Shop Owner to an existing platform user; it becomes a Shop Staff Member only when accepted.
_Avoid_: Email invite, external invite

### Staff Preset

A fixed set of operational permissions for one Shop: Manager, Fulfillment, or Support.
_Avoid_: Custom role, policy graph
