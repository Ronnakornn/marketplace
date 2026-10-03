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

An estimate of the amount a buyer would pay for a Checkout Selection at a point
in time. The committed Order amount may differ when purchase conditions change.
_Avoid_: Guaranteed price, payment amount

### Cart

A buyer's collection of items awaiting purchase. A Checkout Selection identifies
which Cart Items the buyer wants to purchase together.

### Guest Cart

A browser-local collection of variant quantities and display snapshots before
sign-in. It is not a server-side cart; checkout requires sign-in and a future
merge/import flow must revalidate every item.

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

## Pricing and settlement

### Merchandise Subtotal

The sum of item prices multiplied by purchased quantities before checkout
coupon and coin discounts. Shipping charges and tax are separate amounts.
_Avoid_: Revenue, seller earnings, amount paid

### Shop Order

The portion of a buyer's Order belonging to one Shop, including that Shop's items
and checkout amounts.
_Avoid_: Shipment, seller payout

### Coupon Scope

The set of purchases eligible for a Coupon. Eligibility does not identify who
bears the cost of the discount.
_Avoid_: Discount funding

### Discount Funding

The responsibility of a Shop, the marketplace, or both for the economic cost of
a discount given to a buyer.
_Avoid_: Coupon scope, discount allocation

### Discount Allocation

The division of a buyer's discount among Shop Orders or items. Allocation alone
does not determine which party funds the discount.
_Avoid_: Discount funding

### Buyer Coins

The marketplace reward units that a buyer can redeem for a checkout discount.
_Avoid_: Cash, seller wallet balance

### Shipping Charge

The amount charged to a buyer for shipping a Shop Order and owed to its Shop.
The Shop is responsible for the carrier cost, which is a separate amount.
_Avoid_: Carrier cost, seller earnings

### Buyer Cash Payment

The money collected from a buyer for an Order after checkout discounts, including
shipping charges and tax.
_Avoid_: Merchandise subtotal, seller earnings

### Seller Earnings

The amount credited to a Shop for its sales after the applicable settlement
adjustments. Seller Earnings and Buyer Cash Payment are distinct amounts.
_Avoid_: Order total, sales revenue, payout

### Sale Snapshot

The original merchandise, discount funding, shipping entitlement, and commission
facts retained for a Shop Order and its items when purchased.
_Avoid_: Current coupon settings, current commission rate

### Unrecognized Seller Entitlement

A Shop's surviving sale entitlement before it becomes Seller Earnings. Successful
refunds reduce this entitlement before crediting it to the seller wallet.
_Avoid_: Withdrawable balance, seller debt

### Platform Commission

The fee the marketplace charges a Shop for a sale. Its calculation base and
refund treatment belong to the settlement policy.
_Avoid_: Affiliate commission, payment provider fee

### Affiliate Commission

The reward attributable to an affiliate for an eligible referred sale.
_Avoid_: Platform commission

### Settlement

The determination and recording of the amounts owed to each party in a sale or
refund.
_Avoid_: Payment success, seller payout

### Buyer Cash Refund

Money returned to a buyer against a previously collected payment. Coin
restoration and seller settlement reversal are separate adjustments.
_Avoid_: Return approval, seller debit

### Refund Plan

The approved scope of a refund: its original item quantities and shipping causes,
with the corresponding buyer cash and economic adjustments.
_Avoid_: Cash amount alone, return reason

### Shipping Subsidy

The marketplace-funded portion of a Shop's original shipping entitlement that
the buyer does not pay.
_Avoid_: Shop-funded shipping waiver, carrier cost

### Seller Settlement Reversal

An adjustment that reverses a Shop's economic entitlement for a refunded sale.
Its amount depends on discount funding, shipping entitlement, and fee treatment.
_Avoid_: Buyer cash refund

### Commission Reversal

An adjustment returning previously charged Platform Commission for a refunded
sale.
_Avoid_: Buyer cash refund, seller settlement reversal

### Seller Payout

A transfer of a Shop's available funds to its external bank account.
_Avoid_: Seller earnings, settlement

### Seller Debt

An amount a Shop owes the marketplace after debits exceed its retained funds.
_Avoid_: Buyer coin debt, payout failure

### Payout Reservation

Available seller funds held for an outstanding Payout Request. Rejection releases
the reservation; an active reservation is distinct from Seller Debt.
_Avoid_: Completed payout, economic loss

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
