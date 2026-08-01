# Amounts are computed server-side only

The checkout screen once computed its own total from `cart.subtotal`. The server
charged `subtotal - discountTotal + shippingTotal + taxTotal`. Two formulas in
two processes drifted, and buyers were shown one amount and charged another —
flat shipping was silently absent from the display, and an applied coupon had no
visible effect until the order already existed.

We decided that money is computed on the server and nowhere else. The client
renders amounts it received and performs no arithmetic on them. `POST
/api/checkout/quote` exists solely so the screen can obtain an amount from the
same `calculateTotals` that `createCheckout` charges from. Formatting for display
is not arithmetic and stays on the client.

## Consequences

The checkout screen has a hard dependency on a network round-trip just to
display a total, and the place-order button stays disabled until that round-trip
succeeds. That cost is deliberate: the alternative — a shipping constant or a
subtotal calculation living in client code — is exactly the defect this decision
exists to prevent. If you find yourself adding `+ 500`, a fee constant, or a
reduce over item prices to any client file, that is this decision being
reversed by accident.

A quote is an estimate, not a promise; see the Checkout Quote entry in
`CONTEXT.md` for what that means and why an unusable coupon does not fail a
quote while it does fail order creation.
