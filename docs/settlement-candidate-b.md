# Settlement candidate B: item funding snapshots

Status: design only. The accepted policy supplied for this task supersedes the pending wording in `settlement-domain-model.md`. No application code or schema changes are included. Throughput checkpoint: source grounding, one alternative design, and rollout gates.

## Problem and ownership trace

Cash refunded to the buyer, entitlement reversed from the seller, and commission returned to the seller are different amounts. A fully marketplace-funded item can require the latter two changes with zero cash refund.

`CheckoutQuoteEvaluator.evaluate` passes coupon scope, coupon discount, coins, and waived shipping to `PrismaCheckoutRepository.commitCheckout`. That repository combines funding in `ShopOrder.discountTotal`; `OrderItem` keeps gross price only. `WalletService.createEarningsForCompletedOrder` credits gross item prices, applies the current commission rate, and omits shipping. `PrismaReturnRepository.createPendingRefundForReturn` reconstructs item refunds from shop totals. `PrismaRefundRepository.completeRefundSuccess` locks the Order and ShopWallets, but equates seller debits with cash refunds. `reverseBuyerCoinsForRefund` also derives coin restoration from cash and skips zero-cash adjustments. Payout requests lock ShopWallet; approval and paid marking only lock SellerPayout.

Checkout owns immutable funding facts. Return owns item scope and adjudicated cause. A pure settlement service owns monetary decisions. Existing repositories own atomic writes and locks. Payment owns verified cash completion. Wallet owns its ledger and payout eligibility. These observations come from the corresponding files under `server/modules/checkout`, `wallet`, `return`, `refund`, `promotion`, and `payout`, plus `prisma/schema.prisma`; they are not new runtime evidence.

## Usage first

```ts
const snapshot = settlement.snapshotSale(acceptedQuote, commissionPolicy)
const plan = settlement.planAdjustment(snapshot, committedHistory, {
	kind: 'return', returnRequestId, items: [{ orderItemId, quantity }], shippingDecision,
})
await settlement.applyConfirmedAdjustment(adjustmentId, confirmation)
await settlement.recognizeOrderEarnings(orderId)
```

The proposed planner returns cash instructions separately from seller entitlement reversal, subsidy reversal, original-fee credit, and coins to restore. A zero-cash plan uses an authorized internal confirmation, without inventing a provider transfer. Existing two-administrator controls still govern cash completion.

## Schema shape

Prefer separate models related to existing entities. Avoid new nullable scalar columns on `OrderItem` and `ShopOrder` that every existing generated-type fixture must then provide.

| Proposed model | Required facts and constraints |
|---|---|
| `ItemSettlementSnapshot` | Unique `orderItemId`; immutable seller coupon discount, platform coupon subsidy, coin-funded cents, buyer merchandise cash, currency, policy version, and source promotion identity. Gross and quantity derive from the immutable OrderItem. |
| `ShopSettlementSnapshot` | Unique `shopOrderId`; original commission base, rate, amount; shipping before waiver, buyer shipping cash, seller-funded waiver, platform shipping subsidy, and shipping entitlement. Include an explicit earnings-recognition marker so zero earnings still complete once. |
| `SettlementAdjustment` | Unique operation key; Order, optional unique Refund reference, cause, lifecycle status, and trusted shipping decision. Economic completion exists independently of positive cash. |
| `ItemSettlementAdjustment` | Item snapshot reference, cumulative quantity or explicit approved merchandise consumption, buyer cash returned, platform coupon reversal, and coin-funded reversal. |
| `ShopSettlementAdjustment` | Shop snapshot reference, shipping cash returned, shipping subsidy reversal, original commission reversal, and the associated wallet-posting references. |

Actual migration names remain a synthesis choice. Use unique ledger posting references on new adjustment records, rather than add mandatory scalars to existing ledger fixtures. Snapshot facts are immutable; the recognition marker is lifecycle state. Item facts are the source of truth for merchandise. Shop summaries are checked against them.

For each item, define `M = gross - sellerCouponDiscount`, `P = platformCouponSubsidy`, `C = coinFundedCents`, and `B = buyerMerchandiseCash`. Require `M = B + P + C`, with every amount nonnegative. Seller merchandise entitlement is `M`. Commission base is the shop sum of `M`; original fee is `floor(base * snapshottedRate / 10000)`. Shipping and tax are excluded.

Require `shippingBeforeWaiver = buyerShippingCash + sellerFundedWaiver + platformShippingSubsidy`. Shipping entitlement is `buyerShippingCash + platformShippingSubsidy`. A shop-funded waiver creates no compensation. All arithmetic uses integer minor units. Snapshot source ownership before coupons or shop settings can change. The current API supports one coupon plus coins. This candidate does not add simultaneous shop and platform coupons.

```ts
type AdjustmentIntent =
	| { kind: 'return'; returnRequestId: string; items: readonly ReturnedItem[]; shippingDecision: ShippingDecision }
	| { kind: 'preShipmentCancellation'; shopIds: readonly string[] }
	| { kind: 'admin'; approvedComponents: readonly ApprovedComponentReversal[] }
function snapshotSale(quote: AcceptedCheckoutQuote, policy: CommissionPolicy): SaleSnapshot // not implemented
function planAdjustment(sale: SaleSnapshot, history: AdjustmentHistory, intent: AdjustmentIntent): AdjustmentPlan // not implemented
```

These are internal domain signatures. Future entity projections derive from generated Prisma types. Callers do not coordinate allocation stages or select rounding algorithms. One pure planner hides funding, caps, and cumulative reversal behind a small interface.

## Monotone reversal

Allocate seller discounts first, then marketplace coupon and coin funding across remaining item capacity in stable item order. Store those allocations once. Returns never reweight surviving items.

For an item component `X`, the cumulative reversal target for returned quantity `q` is `floor(X * q / originalQuantity)`. Subtract the actual previously committed reversal. Each component is monotone and reaches its exact original amount at full quantity. Define reversed merchandise basis as the sum of reversed cash and subsidies, preserving conservation at every adjustment. The existing whole-line return API needs no partial-unit UI change.

For each shop, the cumulative fee-reversal target is `floor(originalFee * cumulativeReversedMerchandiseBasis / originalCommissionBase)`. Zero base implies zero original fee and zero reversal. Subtract actual original-fee credits. This reaches full fee reversal exactly and makes results independent of how the same item scope is divided between adjustments. Do not reuse multi-shop prefix-floor allocations as cumulative targets; individual shares can decrease.

Coins restore against the snapshotted coin-funded component. Convert cumulative reversed coin-funded cents to whole original spent coins; carry rounding remainder across adjustments. This replaces the cash ratio. Cashback and affiliate reversal require separate rules.

Example: gross merchandise 100, platform coupon 100, buyer cash 0, original fee 10. Full return reverses seller entitlement 100 and fee 10. After recognition the wallet changes by -90. Before recognition the remaining earning is zero, with no seller debt. Shipping and tax are absent from this example.

## Admin cash refunds and legacy safety

A raw admin cash amount cannot identify merchandise, shipping, tax, or goodwill. For new-policy orders, save an explicit component plan whose buyer-cash total equals `Refund.amount`. Validate its caps under the Order lock. Freeze and reserve component capacity before external transfer, preventing a later return from consuming the same entitlement while cash is in flight. Zero-cash adjustments consume economic budgets without a provider refund.

An admin merchandise plan identifies item basis and its funding reversal. A later targeted return consumes only the remaining original scope. Goodwill requires an explicit payer and fee treatment before enablement; proportionally spreading cash across shops cannot answer that policy question.

Legacy Orders remain explicitly legacy. Do not infer funding from today's Coupon or original shipping from current settings. Keep their existing behavior only where history validates. Missing allocations, overdrawn positions, or incomplete migrations require reviewed repair. No backfill may label guessed facts as original snapshots. A completely free Order also requires an authoritative internal no-charge payment-confirmation path.

## Earnings and payout races

Keep the existing whole-Order completion gate initially. Under the Order lock, recognize remaining merchandise and shipping entitlement minus remaining original fee. Earlier adjustments reduce pending entitlement; they do not debit uncredited revenue. Later adjustments post seller reversals and fee credits once. The recognition marker covers a fully reversed sale with no earnings ledger entry.

Future revenue offsets seller debt through the signed ledger. Distinguish debt from outstanding payout holds: economic balance equals the ledger sum plus reversible reserved payouts. A negative available ledger can mean holds exceed the remaining entitlement. Suspend transfer eligibility and reconcile those holds before calling the whole shortfall seller debt.

All wallet writers take ShopWallet locks. Settlement locks Order, sorted ShopWallets, then BuyerCoinWallet. Payout transitions lock ShopWallet before SellerPayout and never subsequently lock an Order. Recheck funded eligibility under the wallet lock at approval and transfer authorization.

A `markAdminPayoutPaid` check cannot prevent an earlier manual bank transfer. Add durable transfer authorization or a sending state before money leaves, with an idempotent reference. A prior refund blocks authorization. A prior authorization establishes exposure; a subsequent refund creates debt recovered from future earnings. Unknown transfer outcomes remain held for reconciliation and never release automatically.

## Business edges and routine choices

The accepted shipping rules apply through a trusted shipping decision. Free-text buyer reasons cannot establish seller fault. Track a once-only shipping budget per shop obligation.

Remaining business edges are the shipping amount for a partial seller-fault return, marketplace shipping-subsidy clawback after the carrier was paid, goodwill funding, coupon reissuance, cashback, affiliate reversal, and nonzero tax liability. Disable ambiguous automatic paths until their rules are recorded. Do not reopen accepted discount funding, commission basis, shipping ownership, or debt recovery.

Separate snapshot tables, stable ordering, integer floors, unique operation keys, shared locks, whole-coin remainder, and migration order are routine engineering choices. They need no further permission round.

## Alternatives and recommendation

Shop-only snapshots make checkout writes smaller, but returns still need to reconstruct item funding and zero-cash entitlement. Persisting those reconstructed facts eventually converges to this design. Cash-ratio reversal cannot represent subsidized merchandise and is unsuitable.

Recommend item snapshots and append-only component adjustments. Avoid a second mutable wallet balance or an event-sourcing platform. Foundation Thinking places funding on the purchased item and separates cash from economic completion. Sequence Work into Verifiable Units puts snapshot facts and literal arithmetic tests before money writers.

Roll out behind a policy gate. First migrate snapshots and verify conservation in the pure planner. Then connect full-line returns, zero-cash completion, and earnings recognition. Add shared wallet locking and durable payout authorization before activation. Required PostgreSQL evidence includes duplicate completion, subsidized zero-cash returns, mixed admin and item scopes, pre-earning refunds, recognition versus refund, refund versus payout authorization, and corrupt-history rollback.

Synthesis is pending comparison with candidate A. No implementation or runtime verification is claimed.
