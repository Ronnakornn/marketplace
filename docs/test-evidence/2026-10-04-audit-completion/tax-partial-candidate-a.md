# Candidate A: tax columns on frozen sale and refund snapshots

Read-only design, 2026-10-04, grounded at root `7cc6d0b`. Owned artifact only. Plan: ground current callers → sketch usage and invariants → compare with Candidate B; implementation is outside this task.

## Problem and traced model

`CheckoutQuoteEvaluator.evaluate()` prices server cart rows, validates/locks the coupon and buyer coin wallet at commit, then `calculateTotals()` emits `taxTotal: 0` and `grandTotal = subtotal − discountTotal + shippingTotal`. `PrismaCheckoutRepository.commitCheckout()` allocates shop coupon first, platform coupon next, coins last, then freezes `ShopSaleSnapshot` and `ItemSaleSnapshot` alongside inventory/order creation. It currently supports a single coupon, not the accepted two-coupon stack. Its reconciliation explicitly rejects any nonzero tax. It captures commission from `CommissionService.calculate(0).commissionBps`.

Current economics: `G = grossMerchandise`, `D = sellerCouponDiscount`, `S = G−D`, `P = platformCouponDiscount`, `C = coinDiscount`, `B = buyerMerchandise = S−P−C`. Shop `commissionBase = ΣS`, `originalCommission = floor(commissionBase × commissionBps / 10000)`. Platform coupons and coins fund the seller and remain in commission base. Shipping remains excluded from commission. Seller gross rights are `ΣS + buyerShipping + platformShippingSubsidy`.

`loadRefundSettlementState()` reads after Order lock, reserves SUCCESS/PENDING/PROCESSING allocations and rejects nonzero shop tax. `createSettlementRefundPlan()` requires exactly original quantity and prior reserved quantity zero. `completeSettlementRefundPlan()` computes original fee credit at successful completion, using successful merchandise reversals. `refund.repository.ts` debits seller gross components, credits original commission and reverses buyer coins in the same locked transaction. This is an appropriate place for cumulative success accounting.

`WalletService` separately validates snapshots on recognition: it equates gross merchandise rights with commissionBase and rejects tax. Tax work must update that path too: seller gross earning and tax-exclusive commission base become different values. Updating checkout/refund alone cannot work.

`ReturnService.createReturn()` always stores original full quantity, checks active REQUESTED/APPROVED/RECEIVED returns and has no lock around that read/create. Approval's `createPendingRefundForReturn()` does take the Order lock. Successful refund currently does not itself close the active Return lifecycle. Add the lock to request admission and atomically complete the Return on successful refund, otherwise sequential partial requests stay blocked. Keep ownership, delivered-only admission and payment proof.

`SystemSetting` already stores keyed JSON; AdminService validates generic value shape and audits metadata, not the actual tax policy values. Tax needs a dedicated parsed `checkout.tax` policy and audited before/after policy values. No global setting may reprice an existing sale/refund.

## Usage: callers first

```ts
// Admin write: parse once at the boundary; nonzero policy requires an explicit basis.
await adminSettings.writeTaxPolicy(actor, {
  ratePpm: 70000, mode: 'INCLUSIVE',
  fundingBase: 'SELLER_AFTER_SHOP_COUPON', taxableShipping: false,
  rounding: 'LINE_HALF_UP', exclusiveTaxFunding: 'BUYER',
}); // 7% is a test/operator example, never an installed default.

// Estimate and commit use the same pure economics calculator. Commit reads policy
// within its transaction and persists the accepted policy and calculated components.
const accepted = await evaluator.evaluate(txRepo, input);
await txRepo.commitCheckout({ ...input, acceptedQuote: accepted.acceptedQuote });

// Caller specifies quantities/causes, never cash/tax/commission amounts.
const pending = await refunds.createPlannedRefund(orderId, {
  items: [{ orderItemId, quantity: 1 }], shipping: [],
});
await refunds.complete(refundId, providerProof); // replays return same success
```

## Shape and equations

Keep one pure `sale-economics.ts` owner for discount allocation, tax decomposition and identities; extend existing snapshot/plan models rather than adding a tax table. Repositories hide SQL locks/persistence. Existing evaluator and refund public methods remain the callers' surface; do not create public load/compute/save coordination APIs. This hides allocation and historical validation rather than adding pass-through methods.

```ts
type FrozenTaxPolicy = Readonly<{
  version: 2; ratePpm: number; // integer 0..1_000_000, denominator 1_000_000
  mode: 'INCLUSIVE' | 'EXCLUSIVE';
  fundingBase: 'BUYER_AFTER_ALL_DISCOUNTS' | 'SELLER_AFTER_SHOP_COUPON';
  taxableShipping: boolean;
  rounding: 'LINE_HALF_UP'; // one supported rule, frozen algorithm version
  exclusiveTaxFunding: 'BUYER';
}>;
type NetTax = Readonly<{ net: bigint; tax: bigint }>;
type FrozenItemRights = Readonly<{
  originalQuantity: number;
  buyer: NetTax; platformCoupon: NetTax; coins: NetTax;
}>;
function calculateSaleEconomics(input: PricedSale, policy: FrozenTaxPolicy): AcceptedSale;
function planOriginalRefund(state: LockedOriginalSale, intent: QuantityIntent): RefundPlan;
function completeOriginalRefund(state: LockedOriginalSale, saved: RefundPlan): RefundPlan;
```

At rate zero, preserve all existing totals/rights exactly. Missing setting maps to zero EXCLUSIVE, buyer basis, shipping false. Malformed existing setting rejects checkout, rather than silently choosing zero. A nonzero setting must explicitly provide mode, basis, shipping treatment and funding rule; save it as one JSON policy to prevent torn independent settings. During commit read it with all economics inputs in the transaction, freeze its value/revision; quote is an estimate, commit is authoritative and may return a changed total for explicit confirmation. Never silently charge beyond accepted checkout amount.

Tax on base `X` is `halfUp(X×r/1_000_000)` for EXCLUSIVE and `halfUp(X×r/(1_000_000+r))` for INCLUSIVE, computed using BigInt rational arithmetic. LINE_HALF_UP means each order-item extended line, plus one shipping line per shop, rounded to minor unit then summed. No per-unit multiplication of rounded tax. Stripe documents both line and invoice rounding; this candidate chooses and freezes line rounding as a product algorithm, not a legal assertion. [Stripe tax rates](https://docs.stripe.com/tax/tax-rates)

Basis is either `B` or `S`. Shop-funded coupon always reduces seller consideration first. Platform coupon/coins remain seller funding economically; the operator must choose whether they reduce taxable base. These sources do not establish the marketplace's legal funding classification. Stripe's ordinary discounts example applies discounts before tax; it cannot settle third-party consideration treatment here. [Stripe discounts](https://docs.stripe.com/tax/tax-rates#discounts)

INCLUSIVE: tax is already inside applicable gross components, and grandTotal remains `subtotal−discountTotal+shippingTotal`. For seller basis, allocate the rounded tax across B/P/C with deterministic largest remainder and stable cart-row order. For buyer basis, the entire item tax is inside B; P/C carry no tax. Net rights are each gross component minus its included tax. CommissionBase is the sum of merchandise net rights, before platform/coin funding deductions; seller gross rights remain the sum of net plus tax, including shipping. EXCLUSIVE: B/P/C are merchandise net rights; tax is charged to buyer, stored as buyer tax, and added once to grandTotal. This fixes the funding contract to BUYER for added tax; other funding modes require an explicit future policy, not an inferred split.

Shipping has a separate flag and component: taxable shipping uses actual seller shipping consideration (buyer + platform subsidy), after any seller waiver. Inclusive shipping tax splits between buyer/platform funded portions; exclusive shipping tax is funded by buyer. Taxable platform shipping subsidy therefore can create buyer tax despite a zero cash shipping fee under exclusive mode; show this in quote. Shipping refund tax follows the frozen shipping refund entitlement/cause, never merchandise quantity alone. Shipping never enters merchandise commission base.

Preserve `Order/Checkout/ShopOrder.taxTotal` as **added tax** for compatible grandTotal equations; add `reportedTaxTotal` for included + added tax disclosure/reporting. Nonzero inclusive tax otherwise risks double charging. APIs disclose mode and reported tax as exact strings. At zero both fields are zero. Frozen snapshots, not current settings, define all refunds.

## Explicit Prisma column sketch

- `ShopSaleSnapshot`: policyVersion 2; taxRatePpm, taxMode, taxFundingBase, taxableShipping, taxRounding, taxPolicyRevision; `sellerGrossMerchandise`, `sellerGrossShipping` distinct from existing tax-exclusive commissionBase; shipping buyer/platform net and tax columns; reportedMerchandiseTax and reportedShippingTax aggregate columns. Existing shipping gross columns remain auditable and must equal corresponding net+tax. No tax rate is backfilled into old sales.
- `ItemSaleSnapshot`: buyerMerchandiseNet, buyerMerchandiseTax, platformCouponNet, platformCouponTax, coinFundingNet, coinFundingTax; existing gross/discount/buyerMerchandise columns retain original advertised component values. Inclusive buyer gross equals B; exclusive buyer gross equals B + added tax. Distinct shopCouponId/code and platformCouponId/code capture accepted stacking, instead of the existing single ambiguous couponId/code.
- `RefundItemAllocation`: cashMerchandise is v2 buyer **net** reversal; buyerTaxRefund, platformCouponTaxReversal, coinTaxReversal; existing platformCouponReversal/coinFundingReversal are corresponding net funding reversals. Add successfulQuantityBefore to prove the frozen cumulative interval. Versioned validation prevents mixing v1 gross fields with v2 net fields.
- `RefundShopAllocation`: buyerShippingRefund net, buyerShippingTaxRefund, platformShippingReversal net, platformShippingTaxReversal, existing commissionReversal. `Refund.amount = Σbuyer net + buyer tax + buyer shipping net + buyer shipping tax`; included tax is a subset of original cash, exclusive tax is the original added cash. Funding reversal is seller debit, never extra buyer cash.

Snapshot identities must reconcile item→shop→order→payment, gross net+tax, aggregate included/added taxes, original commission and cash/provider bounds. Seller wallet recognition uses gross rights; fee uses net commissionBase. Tax ownership/remittance is separate from commission: this candidate preserves seller ownership of gross receipts including collected tax. Platform remittance/withholding would require its own tax ledger and an accepted policy before activation.

## Partial quantities and concurrency

Use one active PENDING/PROCESSING refund per orderItem, plus one active Return request as today. Under Order lock, reject any new plan touching an item with a different active refund or active Return; permit requests for different items. Existing Order-level lock briefly serializes mutations but does not prohibit different-item refunds remaining pending/concurrently processing. Also reserve shared shipping rights and original payment cash capacity including pending/processing plans, even on different items.

For each **atomic original net/tax component** A, original quantity Q and successful quantity q, cumulative entitlement is `floor(A×q/Q)`. New request k stores `floor(A×(q+k)/Q) − successfulComponentConsumed`. Refund cash is derived by adding buyer net and tax deltas. Do not independently round a gross cash component and a tax component and subtract: that can produce negative net deltas. Splitting authoritative net/tax pools first guarantees nonnegative deltas, full exhaustion and rounding rights fixed by the original sale. No current rate, price, coupon, commission setting, goodwill or replacement coupon participates.

Validate history's successful amounts exactly against cumulative targets, and active plans against their saved q interval. Failed/cancelled plans consume nothing and release refund item rights; the originating Return must allow retry of the same request or a terminal cancellation before a new Return request can pass its active guard; because no later pending plan can share that item, its failure cannot invalidate someone else's frozen cents. At retry exclude the plan itself, revalidate interval and preserve idempotency. PROCESSING retries retain one claim owner/provider proof. SUCCESS atomically updates return COMPLETED, posts wallet/coin/affiliate effects once and keeps immutable allocations. A retry after SUCCESS must not create another effect.

Commission credits stay completion-time deltas: `target = floor(originalCommission × cumulativeSuccessfullyReversedNetMerchandise / originalNetCommissionBase)` minus successful prior credits, across all shop items. This allows two different-item refunds to finish in either order and exhaust the original fee exactly. Never use gross tax-bearing merchandise as numerator. Affiliate reversal must follow the original attributable item net merchandise rights/quantity and successful cumulative target, not whole-order cash or shipping/tax. Current refund source has no affiliate reversal call: add it explicitly to the completion transaction with a refund-linked unique effect, and freeze attribution/original affiliate award first.

Request quantity must be positive integer within remaining Q; reject duplicate item IDs and ownership mismatch. Omitted quantity preserves older caller full-item intent only when full quantity remains; it must not silently become remaining quantity. PRE_SHIPMENT_CANCEL keeps its all-shop-items/full-remaining proof and inventory release invariant; ordinary delivered partial returns do not release paid committed inventory automatically. Physical returned-stock receipt policy is separate.

## Independent literal examples

All amounts below are literal minor units; expected test fixtures must not import production calculators.

| Scenario | Expected |
| --- | --- |
| Default zero: G=10000, shop coupon=1000, P=1000, C=500, shipping=400 | S=9000, B=7500, tax=0, grand=7900, commission at10%=900 |
| Inclusive7%, seller basis: G=10700, no discounts | tax=700, net base=10000, cash=10700, original commission at10%=1000 |
| Exclusive7%, seller basis: net=10000 | added/reported tax=700, cash=10700, fee=1000 |
| Inclusive7%, S=10700, P=1070, C=0 | B=9630, total tax700; buyer tax630 and platform tax70; commission base10000, cash9630 |
| Same funding but buyer basis | total tax630, buyer net9000, platform net1070; commission base10070; cash9630; fee at10%=1007 |
| Exclusive7%, S=10000,P=1000, buyer tax payer | seller basis: B9000 + tax700 = cash9700; buyer basis: B9000 + tax630 =9630 |
| Inclusive7%, buyer shipping1070 taxable, no subsidy | shipping tax70, net1000; commission ignores shipping; qualifying full shipping refund cash1070 |
| Two 5-cent lines, exclusive10% LINE_HALF_UP | tax1 +1 =2; invoice rounding would be1, intentionally different |
| Q3, buyer net94, tax7; sequential quantity1/1/1 | cash33/33/35; tax2/2/3; net31/31/32; aggregate cash101, tax7, net94 |
| Same original, first pending1 fails | no consumed rights; next successful1 receives original cash33 and tax2 |
| Inclusive buyer gross23, tax2, Q25, transition successful quantity12→13 | independent gross targets11→11 and tax0→1 imply net−1 (invalid); authoritative net21 targets10→10 plus tax0→1 yields cash1 and net0 |
| Original fee1 on net base3; three successful net1 returns | fee credits0/0/1; total exactly1 |

Inclusive7/107 extraction is illustrated by Thailand Revenue Department for an inclusive7% amount, not a choice of the applicable rate for this marketplace. [Revenue Department example](https://vrtweb2.rd.go.th/15.html)

## Compatibility, tradeoffs and next step

Migration through Prisma only: add enums/columns with zero/null legacy defaults, generate client, write v2 on new checkout, route validation by policyVersion. Existing v1 snapshots imply zero tax and retain full-refund compatibility; cumulative partial quantities can be enabled on v1 only using their original zero-tax components with exact historical validation. Unsnapshotted legacy sales keep reviewed allocation/manual reconciliation; incomplete snapshots fail closed. Do not reinterpret unknown old amounts with today's rate. Reconciliation tooling must explicitly construct zero-tax v1 or fully evidenced v2, never infer tax from a grand total.

Costs: approximately 6 core models plus tax config parsing, checkout quote/commit, wallet recognition, refund planner/loader/completion, Return admission/lifecycle, affiliate completion and API/UI disclosures. Inline columns give typed Prisma data and fewer joins; repeated frozen policy fields on each shop trade space for self-contained validation. Multiple concurrent rates per item would outgrow this shape and favor separate component records (Candidate B); one configured rate/mode per sale fits A. Current tax assumptions are repeated across three services; shared pure economics identities should replace that repetition rather than adding a parallel validator facade.

Failure proof before ship: separate inclusive/exclusive goldens; shop+platform coupon stack; taxable/non-taxable shipping and subsidies; rates/settings change after sale; safe-bound payment and exact lifetime reports; historical corrupt tax identities; sequential partial exhaustion; same-item race rejects one; different-item completion order; failed pending releases interval; duplicate provider completion; rollbacks after every side effect; coin remainders and merchandise-only affiliate credits. UI/API/DB must reconcile reported vs added tax explicitly.

Unresolved policy requiring operator configuration: whether platform coupon/coins reduce taxable consideration, shipping taxability, and tax custodian/remittance responsibility. Default zero is safe; code cannot infer these legal facts from cited examples. Candidate synthesis remains with root. First implementation unit: pure tax/net decomposition plus frozen schema and literal golden tests before wiring checkout.

Principles read and applied: model-the-domain changed refunds into atomic net/tax pools; boundary-discipline confines policy parsing to admin/checkout boundaries; type-system-discipline separates gross receipt rights from net commission base and versioned snapshots. Red-flag screen: no pass-through public methods, no caller-owned tax stages, no mutable config lookup during refund, no layer organized solely by execution phase.

## Comparison with independently written Candidate B

Candidate B uses four tax relations instead of A's columns and preserves the same added-tax equation. Both still must migrate wallet/refund economics and version original history, so separate records do not isolate the behavioral change. Recommend A as the base for the current single configured rate: existing snapshots already own original funding rights, and original tax is a decomposition of those rights. Graft B's clear included-versus-added tax naming and strict whole-record presence checks. Choose B instead if multiple simultaneous rates/jurisdictions per line are a near-term requirement; repeated inline groups would then expose tax representation across callers.

Both candidates should use the smaller one-active-refund-per-item rule for the first increment. A explicitly freezes atomic **net and tax** pools before cumulative allocation; this avoids a negative partial net reversal that can occur when independently rounded gross/tax cumulative targets are subtracted. It also fixes seller gross earning versus commissionBase separation. B's rateBps and configurable floor/half-up are narrower precision and a larger behavior matrix; PPM gives exact percentage-to-four-decimal support, while one frozen LINE_HALF_UP rule keeps this increment reviewable. Supporting another rounding rule later requires a versioned validated policy, not rewriting old snapshots.

True policy decisions remain operator values, not a vote between architecture candidates: taxable shipping, third-party taxable basis, and tax remittance ownership. No nonzero policy is installed by either design. Default zero can ship with the plumbing and preserve existing behavior.
