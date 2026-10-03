# Candidate A: sale snapshots and component refunds

This is a design for the policies accepted in the current session. It does not describe implemented settlement behavior. No schema or application source changes belong to this candidate.

## Usage and ownership

Checkout computes and persists `snapshotSale(quote, commissionBps)` in its existing order transaction. Wallet earnings call `recognizeShopSale(shopOrderId)`. Refund completion calls `planSettlementRefund(snapshot, successfulAllocations, intent)`, then commits the plan after the existing approval and cash-payment checks. Return and admin cancellation supply a typed intent containing item quantities and the shipping cause. An amount alone cannot identify refunded merchandise or subsidy rights.

Current flow is `CheckoutQuoteEvaluator.evaluate` to `PrismaCheckoutRepository.commitCheckout`, then payment settlement to shipments. `WalletService.createEarningsForCompletedOrder` currently credits item line totals and uses the current commission rate. `PrismaReturnRepository.createPendingRefundForReturn` uses net cash merchandise. `PrismaRefundRepository.completeRefundSuccess` debits cash allocations and reverses coins by cash ratio. `PayoutService.createSellerPayout` reserves ledger balance, while approval and payment currently do not recheck coverage. Checkout owns sale snapshots, Refund owns refund rights, Wallet owns posting and debt, and Payout owns withdrawal reservations. Preserve the current whole-order earnings eligibility for this increment.

## Additive records and types

Use separate models so existing ShopOrder and OrderItem scalar fixtures remain valid. All money fields are PostgreSQL BIGINT. No mutable Coupon or current CommissionService lookup occurs after checkout.

```ts
type SalePolicy = 'SETTLEMENT_V1'
type ShippingCause = 'PRE_SHIPMENT_CANCEL' | 'SELLER_FAULT' | 'CHANGE_OF_MIND'
type SettlementRefundIntent = {
	items: readonly { orderItemId: string; quantity: number }[]
	shops: readonly { shopOrderId: string; shippingCause: ShippingCause }[]
}
type SaleSnapshot =
	| { kind: 'legacy'; orderId: string }
	| { kind: 'v1'; shops: readonly ShopSaleSnapshot[] }
```

Proposed `ShopSaleSnapshot`, unique by shopOrderId, has policyVersion, currency, commissionBase, commissionBps, originalCommission, originalShipping, buyerShipping, sellerShippingWaiver, platformShippingSubsidy, coinValueMinor, and the original coin-redemption ledger reference. Freeze coinValueMinor at checkout; the referenced original SPENT amount supplies immutable original coin units. Validate that the order-wide coinDiscount sum equals those units multiplied by coinValueMinor. Add a separate operational recognition timestamp on this record. `originalShipping = buyerShipping + sellerShippingWaiver + platformShippingSubsidy`. The seller receives buyerShipping plus platformShippingSubsidy. Tax stays zero in v1, and neither shipping nor tax enters commissionBase.

Proposed `ItemSaleSnapshot`, unique by orderItemId and related to ShopSaleSnapshot, has originalQuantity, grossMerchandise, sellerCouponDiscount, platformCouponDiscount, coinDiscount, and immutable promotion provenance. Store applied coupon IDs and code text without deletion-dependent truth. Derive sellerMerchandise as gross minus sellerCouponDiscount. Derive buyerMerchandise as sellerMerchandise minus platformCouponDiscount minus coinDiscount. Item totals must reconcile with ShopOrder and Order snapshots when inserted. Store commissionBase and originalCommission once at shop level, with `originalCommission = floor(commissionBase * commissionBps / 10000)`.

Proposed `RefundItemAllocation`, unique by refundId and orderItemId, stores refunded quantity and cashMerchandise, platformCouponReversal, and coinFundingReversal deltas. Proposed `RefundShopAllocation`, unique by refundId and shopOrderId, stores buyerShippingRefund, platformShippingReversal, commissionReversal, shippingCause, and the immutable approval evidence. Refund SUCCESS and these allocation rows commit together. Pending intents cannot consume successful rights.

Add typed wallet components for cash merchandise, platform coupon subsidy, coin redemption funding, shipping cash, shipping subsidy, commission, and their reversals. Each entry has a unique settlement posting key derived from its sale or refund allocation ID and component. Zero-valued components need no entry. Successful allocation rows are the rights history even when no wallet entries are posted yet. `Refund.amount` remains the cash total only. No cash amount or cash ledger sum represents seller entitlement.

## Checkout and cumulative refund algorithm

1. Allocate seller coupons only to their shop's merchandise. Allocate platform coupon and coin discounts separately over remaining eligible merchandise in stable shopId and itemId order. Conserve every source total, keep each cash component nonnegative, and snapshot the resulting per-item values. Extend the accepted quote to carry simultaneous shop and platform coupon selections; its current single coupon field cannot represent the example below. Classify free shipping by its payer and snapshot the fee before waiver. Platform funding is committed when the order becomes paid.
2. Under the existing Order lock, read snapshots and successful item and shop allocations across all payment attempts. For each item, reject returned quantity above originalQuantity. For every component original amount X and cumulative returned quantity q of original quantity Q, target `floor(X * q / Q)`. The new allocation is target minus prior actual allocation. Compute cash, platform coupon and coin components independently. Their sum is the actual seller merchandise reversal. This avoids independently rounded seller totals that disagree with their funding components.
3. For each shop, cumulative sellerMerchandiseReturned is the sum of those component targets. Commission target is `floor(originalCommission * sellerMerchandiseReturned / commissionBase)`, or zero when commissionBase is zero. Subtract prior actual commission reversals. Full merchandise return reverses the original fee exactly. These scalar cumulative targets are monotone; they do not use the non-monotone prefix distribution of successive cash refunds.
4. PRE_SHIPMENT_CANCEL requires locked shipment evidence that the affected shop has not shipped. It reverses the shop's remaining buyer shipping and platform shipping subsidy. SELLER_FAULT reverses the remaining shipping components once. CHANGE_OF_MIND retains them. Preserve seller waivers as history; there is no credited waived fee to debit. Carrier payment is the shop's expense and is outside marketplace cash refund entries.
5. Cash refund is the sum of cash merchandise and buyer shipping deltas. Check the actual successful payment's remaining cash cap. Restore spent coins from cumulative coinFundingReversal divided by the snapshotted coin value, subtracting prior actual restored units. Aggregate across items before rounding whole coins. Full merchandise reversal restores all redeemed coins even when shipping remains. Keep cashback as a separate reward rule with its original grant evidence; revised cashback eligibility is not implied by this settlement decision.

Existing amount-only order-wide administrative refunds must supply a merchandise and shipping intent for v1 before automatic subsidy or fee reversal. Do not infer merchandise progress from cash, which fails when goods cost zero cash.

## Recognition, zero cash, replay and debt

Before earning recognition, SUCCESS records reversed rights without debiting an uncredited seller wallet. Recognition later credits only remaining cash merchandise, coupon subsidy, coin funding, and shipping, then charges originalCommission minus successful commission reversals. Persist recognition even when all components are zero. After recognition, each refund posts its component debits and fee credit. Both paths leave the same seller balance. Use Order, sorted shop-wallet and buyer-coin locks; conditional status updates and unique posting keys make replay harmless. Any posting failure rolls back status and rights history.

A zero-cash merchandise refund still reverses subsidy rights and commission. Skip provider interaction and external cash receipt requirements only for zero cash; retain admin separation and internal settlement evidence. A zero-cash purchase uses a trusted server-only funding-confirmation transition to commit coins, subsidies and inventory, rather than pretending a provider webhook collected money.

Negative economic wallet balance is seller debt and future earnings offset it automatically. Do not duplicate it in a debt column. Ledger sum includes unpaid payout reservations, so `economicBalance = ledgerSum + activeReservedPayouts`; debt is `max(0, -economicBalance)`, and withdrawable is `max(0, ledgerSum)`. Lock wallet before payout at every state change. Approval and marking paid recheck that ledgerSum is nonnegative so all outstanding reservations remain covered. An unpaid reservation can be cancelled and released once. An already paid payout is never released to hide debt.

## Literal acceptance example

All amounts are minor units. Merchandise 100000, seller coupon 10000, platform coupon 5000, coins 2000 value, shipping 4000, tax zero, and commission 10% produce seller merchandise 90000 and fee 9000. Buyer pays `100000 - 10000 - 5000 - 2000 + 4000 = 87000`. Seller receives `83000 + 5000 + 2000 + 4000 - 9000 = 85000`. Funding reconciles as `87000 + 7000 = 85000 + 9000`.

Full merchandise refund with shipping retained refunds buyer cash 83000 and restores coins worth 2000. Seller entries are -83000 cash, -5000 coupon subsidy, -2000 coin funding, and +9000 commission, net -81000. Seller retains shipping 4000. Before earnings, record those same rights reversals and later credit only 4000. If seller already withdrew 85000, economic debt becomes 81000. For seller-fault shipping refund, additionally refund 4000 and debit seller 4000, leaving zero entitlement. No coupon value is refunded as cash.

## Legacy safety and next step

Missing snapshots mean legacy, never zero discounts or the current coupon policy. Existing ledger records remain unchanged. Automatic v1 earnings or component refunds for legacy orders require audited original funding and fee evidence; otherwise return an explicit LEGACY_SETTLEMENT_REVIEW_REQUIRED result. No guessed backfill or retrospective commission-rate substitution is allowed. Existing known wallet balances still support payout debt and reservation checks.

The current Prisma extension converts BIGINT to number. Settlement reads must preserve exact values through a scoped unextended client or decimal-text projections before arithmetic; new snapshots cannot pass through lossy number serialization. Existing numeric DTOs require safe-integer bounds, while new money DTOs can expose decimal strings.

The alternative is reconstructing settlement from current coupons and cash refund ratios. It uses fewer records but cannot prove historical funding, support zero cash goods, or reverse original fees, so reject it. Start with the separate snapshot and allocation models, regenerate Prisma and Prismabox, then one acceptance slice for the literal example and pre-earning refund. Follow with repeated returns, free shipping by payer, zero cash, changed fee rates, payout debt, concurrent replay and rollback. This design keeps domain algorithms in existing services and transactions in existing repositories, with no generic settlement engine.
