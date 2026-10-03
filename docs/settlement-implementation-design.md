# Settlement implementation design

## Problem and usage

Checkout captures the original funding and commission. Wallet recognition consumes
those facts and successful refund allocations. Refund completion consumes a saved
item/shipping plan; a cash amount alone cannot identify rights or subsidies.

`commitCheckout(acceptedQuote)` persists ShopSaleSnapshot and ItemSaleSnapshot.
`prepareRefundPlan(refundId, {items, shipping})` freezes a PENDING refund's scope
and cash amount before processing. `completeRefundSuccess` records successful
rights and posts only already recognized seller reversals. Recognition later
credits surviving rights for refunds completed before delivery.

## Shape and synthesis

Use candidate A's separate generated snapshot and allocation models. Both
candidates converged on item-level funding and shop-level original commission.
The review scored A higher for a small practical interface, and B higher for
capacity reservations and rollout. Graft B's saved explicit plans and reservation
of non-failed pending/processing quantities. Reject cash-ratio subsidy inference
and simultaneous-coupon expansion. The existing API still selects one coupon
plus coins; the combined policy example is an arithmetic fixture, not a claim of
dual-coupon UI support.

ShopSaleSnapshot records original shipping, its funding, commission base, original
rate and fee. ItemSaleSnapshot records immutable seller, platform and coin
discounts and buyer cash. RefundItemAllocation consumes item quantities and
funding components. RefundShopAllocation consumes shipping and original fee and
records whether its wallet effect has been posted. Snapshot recognizedAt remains
an operational marker and does not rewrite purchased prices or policy.

Commission reversal uses the original fee multiplied by cumulative reversed
merchandise rights, divided by the original commission base. Component targets
use cumulative quantities independently and sum to seller merchandise rights.
Full merchandise return restores every original coin and reverses the full fee,
even when shipping remains. Zero cash still requires two administrators and an
internal settlement reference; that reference is not evidence of a provider
transfer. Entirely free purchases retain the existing trusted payment lifecycle;
no new browser-controlled paid transition is introduced.

New-policy amount-only admin refunds require an explicit plan. Old orders with no
snapshots retain the validated legacy path. Partially missing new snapshots are a
conflict. No backfill guesses original funding or shipping from today's coupon or
shop settings. The global numeric serializer remains safe only within enforced
safe-integer sale bounds; this increment does not promise arbitrary legacy BigInt
serialization precision.

## Shipping and locks

An authorized administrator approves shipping cause before processing. Buyer
free text never authorizes it. PRE_SHIPMENT_CANCEL checks shipment evidence and
reverses buyer shipping and unused platform shipping subsidy. SELLER_FAULT returns
the original buyer shipping once per shop; it retains platform shipping subsidy
for the incurred carrier obligation. CHANGE_OF_MIND retains shipping. Multiple
seller-fault returns cannot refund the same shipping twice. Carrier claims,
goodwill refunds, coupon reissuance and affiliate policy need separate contracts.

Settlement writers lock Order, sorted Inventory rows when canceling, sorted
ShopWallets, then BuyerCoinWallet. Payout
writers consistently lock SellerPayout then ShopWallet and never subsequently
lock an Order. Ledger deficits block approval and recording payment of pending
payouts. Signed ledger plus reversible active reservations identifies economic
seller debt; future earnings offset that debt automatically. Manual bank transfer
authorization and unknown external outcomes remain operational reconciliation.
Local tests cannot prove control over an earlier external bank transfer.

## Tradeoffs and next step

The extra four tables preserve original facts without adding required scalar
fields to old entity fixtures. Keeping legacy policy allows existing orders to
complete, but their historical accounting is not certified under the new rules.
Whole-order earnings eligibility and full-line buyer return UI stay as they are.

Model the Domain changed storage from one discount total to owned funding
components. Sequence Work into Verifiable Units requires schema generation and
literal checks before integrating money writers. Prove It Works requires actual
PostgreSQL rows and service/API responses, with provider limits reported.

Review: [independent design scores](settlement-design-review.md).
Start with the additive migration and checkout/earning acceptance test, then
component refunds, shipping plans, payout debt and end-to-end verification.
