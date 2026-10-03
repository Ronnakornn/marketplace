---
status: accepted
---

# Discount funding and refundable commission

The business owner accepted the recommendation on 2026-10-04 with
"ตามแนะนำ". Shop coupons are funded by the Shop. Marketplace coupons and
redeemed Buyer Coins are funded by the marketplace. Scope and funding are
recorded separately at purchase.

Platform Commission uses merchandise after Shop-funded discounts, excluding
shipping and tax. Store the original rate and fee at checkout. Refunds reverse
the original fee attributable to returned merchandise. Cumulative reversals
cannot exceed the original fee. Returning all merchandise reverses all its fee.

Shipping belongs to the Shop under ADR-0004. A marketplace-funded free-shipping
promotion reimburses the Shop; a Shop-funded waiver reduces its entitlement.
Cancellation before dispatch refunds buyer-paid shipping. Seller-fault returns
refund buyer-paid shipping. Change-of-mind returns after correct delivery retain
the original shipping charge. A buyer's free-text allegation does not establish
seller fault; the approved refund must identify the shipping component.

Persist funding, shipping entitlement, merchandise entitlement, and commission
independently of Buyer Cash Payment. Refund cash, restored coins, subsidy
reversal, seller entitlement reversal, and commission reversal are distinct.
An unpaid seller entitlement is reduced before crediting earnings. When a
reversal follows a payout, a negative seller ledger balance is Seller Debt and
future earnings offset it before any new payout. Recheck funds before approval
and recording payment of an outstanding payout.

Old orders lacking snapshots keep their original policy. Do not infer historical
funding from mutable coupon records or apply today's rate retrospectively.
Historical inconsistencies require reconciliation, not invented backfills.

The example accepted with the recommendation has merchandise 100,000 cents,
Shop discount 10,000, marketplace discount 5,000, coins 2,000, shipping 4,000,
and commission 1,000 bps. Buyer cash is 87,000, commission is 9,000, and Shop
entitlement after commission is 85,000 before carrier costs. Marketplace margin
is 2,000 before payment fees and other costs.

This decision defines policy. Implementation and verification progress are
tracked in ../settlement-implementation-plan.md.
