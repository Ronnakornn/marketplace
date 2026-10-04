# Independent tax and partial-refund design review

Reviewed 2026-10-04 against root source observed at 46911a13f288d613427a50b531baa220caaa113a. This is an independent same-model-family review by an agent who authored neither candidate. It is source/design evidence. No tax implementation, test execution or production readiness is claimed.

## Verdict and scores

Use [Candidate A](D:/GitHub/marketplace/docs/test-evidence/2026-10-04-audit-completion/tax-partial-candidate-a.md) as the base. Graft [Candidate B](D:/GitHub/marketplace/docs/test-evidence/2026-10-04-audit-completion/tax-partial-candidate-b.md)'s included/added naming and strict complete-record presence checks. Inline snapshot columns fit the existing single-rate sale model. Four extra tax tables do not avoid modifying checkout, wallet, refunds and readers together. Defer overlapping quantity-range reservations and additional rounding modes.

Scores are reviewer judgments, 1 weak through 5 strong. They are not measured correctness probabilities.

| Criterion | A | B | Reason |
|---|---:|---:|---|
| Exactness | 4 | 3 | A distinguishes atomic net/tax pools and seller gross receipts from net commission. B does not specify how to prevent negative net partial deltas. |
| Minimality | 4 | 3 | A extends existing owners. B adds four relations while retaining the same cross-domain migrations. |
| Rollback and concurrency | 4 | 3 | A explicitly reserves pending quantities, shared cash and shipping rights. Both still need a Return lock-order repair. |
| Preservation of original facts | 5 | 4 | A freezes basis, rate, funding and commission with versioned historical validation. B is sound but less specific on funding components. |
| UI/API/DB testability | 4 | 3 | A supplies independent cash/net/tax literals and component identities. Both need a concrete quote-acceptance protocol. |
| Total | 21 | 16 | A is the better implementation base after the blockers below are incorporated. |

Owner decisions used here are configurable inclusive/exclusive tax with default zero, cumulative partial quantities, shop coupon before platform coupon, explicit fundingBasis/taxableShipping before a nonzero policy, and SELLER as the only initial tax custodian. Rates in examples are fixtures, not legal-rate claims.

## What the source establishes

- [Checkout evaluator](D:/GitHub/marketplace/server/modules/checkout/checkout-quote.evaluator.ts:120) hardcodes zero tax. [Commit](D:/GitHub/marketplace/server/modules/checkout/checkout.repository.ts:238) allocates the existing single coupon and coins, writes policy-one snapshots, and rejects nonzero tax. Coupon ties currently use a newly generated orderItemId in the sort, rather than a cart-row key known to the quote.
- [Snapshots](D:/GitHub/marketplace/prisma/schema.prisma:1851) already preserve original item funding and original shop commission. Extending these owners is coherent. Policy-one commissionBase equals seller gross merchandise after the seller coupon, which cannot remain true for inclusive tax.
- [Wallet recognition](D:/GitHub/marketplace/server/modules/wallet/wallet.service.ts:123) validates policy one, equates merchandise rights and commissionBase, rejects nonzero tax and computes original-fee reversal against that base. Tax work must migrate this path with checkout and refunds.
- [Refund state](D:/GitHub/marketplace/server/modules/refund/settlement-refund.service.ts:26) requires complete snapshots, exact full item quantity and original components. [Refund persistence](D:/GitHub/marketplace/server/modules/refund/refund.repository.ts:142) takes the Order lock; successful completion posts seller wallet and buyer coin effects in one transaction. The loader checks successful payment cash totals, while the proposed v2 contract must reserve cash for PENDING/PROCESSING too.
- [Return admission](D:/GitHub/marketplace/server/modules/return/return.service.ts:73) is transactional but does not lock the Order before its active-return read/create. It writes purchased quantity. [Approval](D:/GitHub/marketplace/server/modules/return/return.service.ts:144) updates Return first and then [refund creation](D:/GitHub/marketplace/server/modules/return/return.repository.ts:249) locks Order. Current refund completion does not close Return.
- [Coin restoration](D:/GitHub/marketplace/server/modules/promotion/buyer-coin.transitions.ts:87) restores cumulative funding cents divided by 100 and validates originalSpentCoins*100 against original funding cents. [Refund completion](D:/GitHub/marketplace/server/modules/refund/refund.repository.ts:244) currently passes the gross zero-tax coin component.
- [AffiliateCommission](D:/GitHub/marketplace/prisma/schema.prisma:2402) is an order-unique original award with no item basis or refund-linked reversal record. [Affiliate calculation](D:/GitHub/marketplace/server/modules/affiliate/affiliate.service.ts:216) uses merchandise subtotal minus discounts. Neither candidate can assume that partial affiliate reversal already exists.

## Implementation blockers to resolve in the typed contract

1. **Keep coin restoration in gross original funding cents.** A's v2 coinFundingReversal is net. Passing that field alone into the existing coin transition rejects or under-restores inclusive-tax coins. Pass cumulative reversed coin net+tax and original coin net+tax. Validate gross original funding against spentCoins*100. Keep merchant debit, commission numerator and buyer cash as separate amounts. Freeze the cashback-eligible merchandise basis too; added tax and shipping must not accidentally enter existing merchandise reward math.

2. **Make Order the first mutation lock for every Return path.** Updating Return COMPLETED inside refund success adds an Order→Return lock dependency. Existing approval has Return→Order. Inferred risk is a cycle during stale duplicate approval and refund completion. Admission, approval, rejection/cancellation and refund completion must first lock Order, reread current Return state and use a checked transition. Keep shop wallets sorted and shared buyer wallet locking consistent. Do not only add a lock to admission.

3. **Separate added tax from reported included tax throughout the public contract.** Retain taxTotal as added tax in Checkout/Order/ShopOrder equations. Report includedTaxTotal and addedTaxTotal explicitly; reportedTaxTotal is their sum. Inclusive tax never adds cash a second time. Wallet gross earning includes collected tax for SELLER, while original commission uses merchandise net rights and excludes shipping. No platform withholding/remittance path is enabled.

4. **Use one complete, parsed and frozen policy.** Nonzero config must explicitly provide fundingBasis, taxableShipping, mode, rate, rounding and custodian. Only LINE_HALF_UP and SELLER initially. Missing config maps to zero; malformed stored config fails closed. Persist revision and audit old/new policy values. If shipping is taxable, state explicitly that its consideration is buyer shipping plus platform subsidy after seller waiver, as A proposes. Name this fixed shipping basis in the frozen policy rather than allowing the merchandise fundingBasis to appear to govern shipping silently. A buyer-basis merchandise policy with subsidized taxable shipping needs a dedicated literal test.

5. **Keep quote and commit allocation stable and require accepted-quote equality.** Use immutable cartItem.id for deterministic allocation ties in both callers; newly generated order item IDs cannot choose cents. One economics owner computes both. Commit rereads current config and pricing under the existing transaction, checks the accepted quote fingerprint/revision, and returns QUOTE_CHANGED with a replacement quote before creating a payable order if the accepted amount/policy changed. No old client total becomes a trusted price. Nonzero-tax callers must send explicit quote acceptance; backwards compatibility is safe only for the reviewed zero-tax path.

6. **Freeze and reverse affiliate facts, not current settings or order cash.** For v2, preserve the original per-item eligible merchandise net basis after the applicable merchandise discounts, together with the original order award/rate/attribution. Tax and shipping are excluded. Compute completion-time cumulative credit against the original award and original eligible net basis. A refund-linked unique reversal effect is needed. Preserve the original award as history; reports/payout eligibility use original minus reversals. Already-paid awards need an explicit recoverable debit/debt representation or fail-closed processing. Do not manufacture an item mapping for unsnapshotted historical awards. The existing buyer-merchandise basis should remain the v1 behavior; seller commission's funding basis is a separate contract.

7. **Model failure and Return terminal state together.** SUCCESS atomically changes the originating Return to COMPLETED and consumes quantities once. A provider timeout stays PROCESSING and retains its reservation. A confirmed terminal FAILED consumes no rights. The smallest proposed failure path atomically marks its Return CANCELLED and permits a fresh request under the Order lock; do not reopen that failed refund after another plan reserves the interval. If retaining same-request retry instead, define and enforce that alternative under the same lock. Both behaviors cannot be implicit. RefundStatus currently has FAILED but no CANCELLED, so do not write an unsupported enum.

8. **Version the whole economics validator and inventory contract.** Policy one stays zero tax and old full refunds remain exact. Policy two requires every net/tax group and frozen policy; partially migrated records fail closed. Existing original gross snapshot fields remain original facts rather than being overwritten with net. Pre-shipment cancellation must prove full remaining monetary rights across all shop items and release still-committed physical inventory once. Ordinary delivered partial refunds do not automatically restock. Partial monetary quantity is not sufficient evidence of physically received or releasable stock.

## Actionable data shape

This is a caller/validator sketch, not compiled source. Rate and quantities are parsed/branded at boundaries; amounts stay bigint internally and exact decimal strings in JSON.

```ts
type NetTax = Readonly<{ net: bigint; tax: bigint }>;
type FundingBasis = 'BUYER_AFTER_ALL_DISCOUNTS' | 'SELLER_AFTER_SHOP_COUPON';
type FrozenTaxPolicyV2 = Readonly<{
  version: 2;
  revision: string;
  ratePpm: ValidatedTaxRatePpm;
  mode: 'INCLUSIVE' | 'EXCLUSIVE';
  fundingBasis: FundingBasis;
  taxableShipping: boolean;
  shippingBasis: 'SELLER_SHIPPING_AFTER_WAIVER';
  rounding: 'LINE_HALF_UP';
  exclusiveTaxFunding: 'BUYER';
  custodian: 'SELLER';
}>;
type FrozenItemV2 = Readonly<{
  orderItemId: string;
  originalQuantity: PositiveQuantity;
  buyer: NetTax;
  platformCoupon: NetTax;
  coins: NetTax;
  affiliateEligibleNet: bigint;
}>;
type PartialInterval = Readonly<{
  successfulQuantityBefore: NonnegativeQuantity;
  quantity: PositiveQuantity;
}>;
type ItemRefundV2 = Readonly<{
  orderItemId: string;
  interval: PartialInterval;
  buyer: NetTax;
  platformCoupon: NetTax;
  coins: NetTax;
}>;
type OriginalSale = FrozenSaleV1 | FrozenSaleV2;
```

Validate integer rate 0..1,000,000, item quantity within the PostgreSQL Int limit and original remaining quantity, duplicate IDs, complete per-order policy presence and every item→shop→order→payment identity. Enforce supported safe provider totals before converting to Number at a provider boundary. Do not persist a caller-entered refund amount.

For each original atomic net/tax pool, a request owns the interval from successful q to q+k. Its delta is the target at q+k minus successful consumed amount. Only one PENDING/PROCESSING refund and one active Return can hold that item; different items may remain active concurrently. Shared shipping and payment cash capacity includes SUCCESS/PENDING/PROCESSING. Pending plans store zero commission credit; successful completion computes cumulative original net-based credits under Order lock, so different-item completion order can change intermediate cents while final fee exhaustion stays exact.

The caller receives buyer cash as buyer net+tax plus qualifying shipping net+tax. Merchant debit additionally includes platform coupon and coin funding net+tax plus qualifying shipping funding. Commission credit uses reversed net merchandise; coin restoration uses reversed gross coin funding. These totals must not share one ambiguous amount field.

## Independent literals and required observable gates

Expectations below are design goldens, not executed tests. Test files must hardcode them without importing the production calculator to generate expected values.

| Fixture | Literal expected outcomes |
|---|---|
| Zero-tax G10000, shop coupon1000, platform coupon1000, coins500, shipping400, fee10% | Buyer merchandise7500, paid7900, seller merchandise9000, original fee900, seller gross9400. Existing policy-one history stays unchanged. |
| Inclusive7%, G10700, no discounts/shipping, fee10%, affiliate5% of buyer net | Paid10700, reportedTax700, addedTax0, seller gross10700, commissionBase10000, fee1000, affiliate basis10000/award500. Full refund cash10700, seller debit10700, fee credit1000, affiliate credit500. |
| Exclusive7%, net10000, shipping0, same fees | Paid10700, added/reportedTax700, seller gross10700, commissionBase10000, fee1000, affiliate500. |
| Inclusive7% seller basis, S10700, platform1070 | Buyer cash9630, buyer tax630, platform tax70, seller gross10700, commission base10000, fee10%=1000. |
| Same amounts, buyer funding basis | Buyer cash9630, buyer tax630, platform tax0, seller gross10700, commission base10070, fee10%=1007. |
| Q3, buyer net94/tax7, sequential 1/1/1 | Net31/31/32, tax2/2/3, buyer cash33/33/35. Full101 and tax7 exhausted. First pending fails then next succeeds1 gives cash33/tax2. |
| Q25, original buyer gross23/net21/tax2, successful12→13 | Additional net0, tax1, cash1. Independent gross-floor minus tax-floor would incorrectly produce net−1. |
| Q3, original gross coin funding300/net280/tax20, original spent3 coins | Gross coin reversal99/100/101, cumulative99/199/300; restored-coin deltas0/1/2, total3. Passing net280 as original funding must be rejected, not accepted as a two-coin restoration. |
| Original fee1 on net base3; three successful net1 reversals | Fee credits0/0/1, exactly1 overall. Different-item completion order cannot exceed1. |
| Exclusive7%, buyer shipping0, platform shipping subsidy1000, taxable seller shipping basis | Buyer added shipping tax70, seller shipping gross1070/net1000. Untaxable flag instead gives added tax0/gross1000. Shipping never enters merchandise commission/affiliate bases. |
| Two extended lines5 each, exclusive10%, LINE_HALF_UP | Tax1+1=2 and buyer grand12, rather than invoice-level tax1/grand11. |

Before enabling a nonzero policy, execute all of these surfaces:

- Pure sale/refund tests verify the literals, malformed policy, component conservation, full exhaustion, changed tax/coupon/fee settings after purchase and corrupted historical snapshots.
- Actual PostgreSQL checkout tests persist shop+platform coupon stacking, tax snapshots, reservations, exact order/payment/provider totals and coupon/coin usage. Roll back failures during either coupon reservation and every persisted economics side effect.
- Actual PostgreSQL Return/refund races prove one accepted same-item request, different-item plans can coexist, both completion orders conserve the original fee, failed plans release their interval, duplicate SUCCESS produces one effect, and stale Return approval cannot deadlock or overwrite COMPLETED.
- Fault injection after wallet debit, fee credit, coin restore, affiliate reversal and Return completion proves one atomic rollback. Provider duplicate/cross-payment/cross-shop proof cannot create a second allocation or exceed payment cash.
- Browser/API/DB checks compare quote labels, explicit accepted payable total, included versus added tax, item quantity/remaining quantity, each partial refund cash, seller gross receipts/net fee and coin/affiliate ledgers. UI must display 107.00 paid with 7.00 included tax without adding 7.00 again in the inclusive fixture. A changed policy forces reacceptance rather than silent charging.

Existing nearby regression owners are checkout-concurrency.integration.test.ts, wallet/settlement-policy.integration.test.ts, refund/settlement-races.integration.test.ts, refund/shared-buyer-coins.integration.test.ts and affiliate.service.test.ts. Their existing assertions are useful placement evidence, not proof of the proposed tax/partial feature.

## Scope and implementation order

First land the typed pure economics owner and additive Prisma schema with literal tests and regenerated client. Then wire quote/commit plus both coupons and all policy-two recognition validators. Next add quantity admission and uniform Return/Order locking, atomic completion including coin gross restoration and immutable affiliate reversals. Finally migrate DTO/UI receipts and run actual DB/API/browser gates. Keep nonzero activation disabled until every path above is verified. Shipping funding classification and rate are explicit operator inputs; this review does not establish tax law.

Read principles that shaped the verdict: Laziness Protocol selected existing snapshot columns and one active same-item plan; Model the Domain required versioned net/tax rights and a Return/refund state machine; Test Behavior, Not Implementation required literal UI/API/DB outcomes rather than self-referential calculations. Leaf skill files were read in this session. Independent comment/source implementation review remains a later root gate.
