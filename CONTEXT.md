# Domain Context

Glossary of the project's ubiquitous language. Terms only — no implementation
details, no specs, no decisions. Decisions belong in `docs/adr/`.

## Commerce

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

### Checkout Selection

The subset of Cart Items a buyer explicitly chooses to purchase in one
Checkout. Items outside a Checkout Selection remain in the Cart.
