# Finance numeric audit notes

Source review on 2026-10-04, baseline `ed2093b`. This document records the initial source findings and independent expected values. The verification addendum below records the subsequent authorized fixes and executions. The existing-coverage table describes source assertions, not executions of every listed suite.

Throughput checkpoint is n/a for this read-only investigation. The output groups numeric rules by domain so the parent task can assign runtime checks independently. `.chief/_rules` contains only `.gitkeep` files.

## Numeric formulas and independent examples

All monetary examples below use integer minor units unless the example explicitly says baht. One coin equals 100 minor units, or THB 1.

| Flow | Source and current rule | Literal expected example |
|---|---|---|
| Fixed coupon | `server/modules/promotion/promotion.service.ts`, `calculateDiscount`. Clamp the fixed amount to zero through the eligible subtotal. Shop coupons use only their shop subtotal. | Subtotal 2,000 and fixed coupon 700 produces discount 700 and merchandise 1,300. A fixed coupon 2,001 against 2,000 produces discount 2,000. |
| Percentage coupon | Same function. Floor eligible subtotal times basis points divided by 10,000, apply max discount, then clamp to subtotal. | Subtotal 1,999 at 1,500 bps produces 299, leaving 1,700. A max discount 200 reduces that discount to 200. |
| Free shipping | `validateCouponForsubtotal`. Merchandise discount is zero. Shop coupon returns its shop ID; platform coupon returns all selected shop IDs. | Shop A shipping 350 and shop B shipping 500, with shop A free shipping, leaves shipping 500. |
| Flash sale price | `bahtToMinorUnits` accepts positive amounts with at most two decimals, then multiplies baht by 100. | THB 0.29 must persist 29. THB 1.15 must persist 115. THB 0, negative values, and THB 1.001 must reject. |
| Flash quota | `assertFlashSaleItemUpdatePayload` prohibits stock limit below sold plus active reservations. | Sold 3 plus reserved 2 permits limit 5, rejects limit 4. Per-user limit zero or fractional must reject. |
| Payment amount | `server/modules/payment/payment.service.ts`, `handleWebhook`. Provider amount must equal stored Payment amount before state settlement. | Payment 6,350 rejects webhook 6,349. Correct amount settles once even with duplicate event delivery. |
| Payment stock | `server/modules/payment/payment.repository.ts`, `applyPaymentStateTransition`. Paid commits active reservations and decrements both on-hand and reserved. Failure or expiry releases reservations without decreasing on-hand. | On-hand 10 and reserved 6 becomes on-hand 4 and reserved 0 on success. Failure leaves on-hand 10 and reserved 0. |
| Paid coin spend | Same repository, `settleBuyerCoins`. Pending spend becomes USED, pendingBalance decreases and lifetimeSpent increases. | Balance 90 and pendingBalance 10 after checkout becomes balance 90, pendingBalance 0, lifetimeSpent increased by 10 after payment. Failure restores balance 100 and pendingBalance 0. |
| Cashback | Same function. Floor merchandise after all discounts divided by 10,000 minor units. Credit lifetimeEarned, settle existing coin debt first, then record available cashback. | Net merchandise 49,999 earns 4 coins. Net merchandise 50,000 earns 5. Debt 3 consumes 3 of the 5, leaving 2 spendable coins. Shipping does not earn cashback. |
| Coin reversal | `server/modules/promotion/buyer-coin.transitions.ts`, `reverseBuyerCoinsForRefund`. Use cumulative successful refund proportion and subtract prior restored or reversed coins. | 200 spent and 50 cashback against cash total 1,000, followed by cash refund 500, restores 100 coins and reverses 25. A repeated completion adds no entries. |
| Reversal rounding | Same function. Cumulative integer targets avoid per-refund rounding loss. | Original 3 coins and cash total 1,000. Refund totals 333, 667, 1,000 yield cumulative targets 0, 2, 3 and incremental adjustments 0, 2, 1. |
| Cashback debt | Same function. Deduct available wallet balance first and record any shortfall as debt. | Reversal 3 with available balance 1 leaves balance 0 and increases debt by 2. A later cashback 5 settles debt 2 and leaves 3 spendable. |
| Item refund | `server/modules/refund/refund-amount.service.ts`, `calculateReturnRefund`. Allocate shop subtotal minus discount across order items in stable ID order. Exclude shipping. | Item A 4,000, B 6,000, shop discount 2,000. Full A return refunds 3,200. Full B return refunds 4,800. Their total is 8,000. |
| Item rounding | `allocateRefundAmount`. Cumulative weighted integer targets preserve all minor units across items. | A and B each 100, total discount 1. Stable IDs A then B receive refundable amounts 99 and 100, totaling 199. |
| Order-wide refund | `server/modules/refund/refund.repository.ts`, `completeRefundSuccess`. Allocate to shop grand totals and debit wallets while holding order and wallet locks. | Shop totals 100 and 200, refund 100, produces debits 33 and 67. Cumulative successful refunds cannot exceed Payment.amount. |
| Seller commission | `server/modules/commission/commission.service.ts`. Floor gross times bps divided by 10,000. Net equals gross minus commission. | Gross 10,001 and 1,000 bps produces commission 1,000, net 9,001. Zero gross produces zeros. Rates outside integer 0 through 10,000 reject. |
| Seller earnings | `server/modules/wallet/wallet.service.ts`, `createEarningsForCompletedOrder`. Current gross is each shop's sum of undiscounted OrderItem.lineTotal. Credit gross and separately debit platform commission. | Current behavior for item totals 10,000 at 1,000 bps credits 10,000, debits 1,000, and leaves 9,000. Discount and shipping reconciliation remain a policy gap below. |
| Wallet balance | `server/modules/wallet/wallet.repository.ts`, `sumLedger`. Sum entries in the wallet's currency. | Credits 10,000, commission -1,000, refund -2,500, reserve -3,000 leave available balance 3,500. |
| Payout | `server/modules/payout/payout.service.ts`. Lock wallet, reject amount exceeding ledger balance, insert negative reserve. Rejecting releases the reserve. Mark-paid inserts zero because the reserve already removed funds. | Available 9,000 and withdrawal 6,000 leave 3,000. Rejection returns 9,000. Approval then payment leaves 3,000. Two simultaneous 6,000 requests against 10,000 permit one and leave 4,000. |
| Affiliate commission | `server/modules/affiliate/affiliate.service.ts`. Net eligible merchandise is summed item line totals minus order discount, excluding shipping. Floor times commission bps divided by 10,000. | Eligible merchandise 9,000 at 500 bps produces 450. Eligible merchandise 1,999 at 500 bps produces 99. Zero eligibility produces no commission. |

## Findings that need regression tests

### Valid decimal flash sale prices can reject

Source evidence is `server/modules/promotion/promotion.service.ts:443`. The comparison `Math.round(value * 100) !== value * 100` compares floating point multiplication exactly. THB 0.29 and 1.15 have binary rounding errors when multiplied by 100. The intended two-decimal contract accepts both values.

Add public-service cases to `server/modules/promotion/promotion.service.test.ts` for `addFlashSaleItem` and `updateFlashSaleItem`. Assert literal persisted values 29 and 115 through a stateful repository or real database. Exercise the corresponding API routes because `salePriceBaht` uses TypeBox `multipleOf: 0.01`. Existing cases cover whole-baht prices and regular-price ceilings, but not valid decimal prices.

### Concurrent final deliveries can duplicate seller credits

Source evidence is `server/modules/wallet/wallet.service.ts:78`, `server/modules/wallet/wallet.repository.ts`, `prisma/schema.prisma:1859`, and `server/modules/shipment/shipment.service.ts:249`. Earnings use a check-then-insert without an order or wallet lock. The ledger has an index on order and type but no unique earning key. Shipment delivery commits its order lock before invoking the earnings service. Two final delivery calls can both reach the earnings service after all shops are delivered and both see no credit.

This is a concurrency inference from the source, not a reproduced runtime result. Add a barrier-based real-database test to `server/modules/refund/commerce-concurrency.integration.test.ts`. Deliver two shops concurrently and assert exactly one order_earning entry and one commission_fee entry per shop. Also run two direct `createEarningsForCompletedOrder` calls concurrently. The current single-shop lifecycle test does not exercise this race.

### Coupon creation accepts fractional minor units and basis points

Source evidence is `server/modules/promotion/promotion.routes.ts:29` through `:36` and `normalizeCouponPayload` in `promotion.service.ts`. `discountValueCents`, `minOrderCents`, `maxDiscountCents`, usage counts, and bps use `t.Number` without an integer restriction. The service forwards the values. Prisma stores these fields as BigInt or Int.

This is a boundary gap from source review. The database adapter response for fractional inputs remains untested. API tests must reject 1.5 minor units, 12.5 bps, and usageLimit 1.5 before persistence, with a structured validation response instead of an internal server error. Test missing required discount values and invalid date ranges separately. Existing coupon tests mainly exercise application of valid fixtures.

### Seller percent-coupon form submits a zero rate

Source evidence is `app/features/seller/components/SellerManagePages.tsx:713`. The form reads `data.get("percent")` and defaults to zero, but the rendered form contains an amount input and no percent input. Selecting percent therefore submits `discountPercentBps: 0`. This is a source-confirmed mismatch, with UI reproduction still pending.

Add a component or browser regression that selects percent, enters 15%, creates the coupon, and checks API and database bps 1,500. This flow currently lacks a user input for the percentage.

## Policy and implementation gaps

Seller earnings credit undiscounted merchandise and omit shipping, but refunds debit net item amounts or ShopOrder.grandTotal. For a 10,000 item total, 2,000 discount, 500 shipping, and 10% commission, current earnings leave 9,000 while buyer cash paid is 8,500. A full order-wide cash refund debits 8,500 and leaves 500 in seller funds. A net merchandise return refunds 8,000 and leaves 1,000. These are literal consequences of the two formulas. Whether coupons are funded by seller or platform, whether seller receives shipping, and whether commission returns on refund need a contract before changing the formula.

Affiliate creation blocks already-refunded orders, but existing commission rows are not adjusted by the refund completion path. `server/modules/affiliate/affiliate.repository.ts`, `getStats`, still counts and sums every non-VOID commission. A 9,000 net order at 5% records 450, and a later full refund currently leaves that 450 in stats. `docs/PRODUCTION_READINESS.md` explicitly disables affiliate settlement in production until a complete workflow exists. Mark refund-linked affiliate settlement as unsupported, not verified.

`calculateReturnRefund` floors the item share times returned quantity independently. For a 199 refundable item with quantity two, separate one-unit returns each produce 99 rather than preserving the final minor unit. The current public ReturnService always returns the full line quantity, so the separate-unit scenario is not reachable through that API today. Keep it listed as unsupported partial-unit return behavior, and add cumulative quantity context before exposing partial units.

`server/lib/prisma.ts` globally converts every bigint to number without a safe-integer check. Money above 9,007,199,254,740,991 loses precision before business logic receives it. Several services accept Number.isInteger rather than Number.isSafeInteger, and percentage multiplication can exceed exact integer precision even when gross itself is safe. Boundary maxima are not documented for every money flow. Test real response serialization and reject or preserve oversized amounts consistently before claiming BigInt safety.

Refund provider callbacks and external reconciliation are not implemented in the inspected flow. Completion uses manual external references and two administrators. Late paid events after expiration are rejected for stock safety; that does not prove external paid money has been refunded.

## Existing coverage and runtime status

| Test file | Current assertions | Remaining checks |
|---|---|---|
| `server/modules/promotion/promotion.service.test.ts` | Fixed 700, percentage 300, maximum discount, seller scope, exhausted limits, free shipping, flash quotas, coins response. | Decimal baht, fractional boundary rejection, minimum equality, end-time equality, real UI coupon creation. |
| `server/modules/payment/payment.test.ts` | Amount mismatch, terminal conflicts, duplicate events, failure and expiry, mock trusted amount, rollback propagation. | Execute with database. Include currency reconciliation for a real provider once the provider contract carries currency. |
| `server/modules/payment/payment.repository.test.ts` | Cashback 2 from 20,000; debt split 2 available and 3 debt from 50,000; spend and quota effects. | Real wallet totals, thresholds 9,999 and 10,000, concurrent paid orders sharing buyer coin debt. |
| `server/modules/refund/refund-amount.service.test.ts` | Net refund 8,000, stable shares 99 and 100, shop isolation, invalid quantity. | Zero net refund end-to-end and unsupported partial-unit rounding. |
| `server/modules/refund/refund.repository.test.ts` | Seller debit, order-wide split, over-refund rejection, same-admin rejection, rollback propagation. | Real multi-shop cumulative refunds and payout race. |
| `server/modules/promotion/buyer-coin.transitions.test.ts` | Half restore 100 and reverse 25, cumulative 667 target, debt, duplicate skip. | Stateful database balances through several separate refunds and another concurrent order. |
| `server/modules/wallet/wallet.service.test.ts` | Wallet response, ownership, credit 10,000 and fee -1,000, refund debit -2,500. | Concurrent earnings, discounted and shipping reconciliation, actual committed balance. Its rollback test injects a rejected transaction before work begins. |
| `server/modules/payout/payout.service.test.ts` | Reserve, insufficient balance, rejection, two-admin completion, invalid transitions. | Fractions, safe-integer maximum, real concurrent reject/pay and refund/request. |
| `server/modules/affiliate/affiliate.service.test.ts` | Eligible 9,000 and commission 450, duplicate existing row, self-referral, disabled/refunded exclusion. | Decimal floor 99, later refund adjustment, actual concurrent creation and stats. |
| `server/modules/refund/commerce-concurrency.integration.test.ts` | Source includes duplicate refund, rollback, payment amount and duplicate events, expiry, reserve race, payout race, lifecycle. | Run only on isolated test database. Add final-delivery duplicate-credit and coin shared-wallet races. |
| `e2e/finance-lifecycle.spec.ts` | UI, API, DB refund 3,200 and wallet 6,800. Payout 6,000 and remaining 4,000. | Fixture starts with a manually seeded 10,000 earning, so it does not prove real earning or commission computation. |
| `e2e/commerce-edge-flows.spec.ts` | Failed or expired checkout restores 100 coins, pending zero, coupon RELEASED. | Run and retain current evidence. Include decimal and minimum boundary totals. |

UI locations include seller finance and coupon forms in `app/features/seller/components/SellerManagePages.tsx`, buyer coin display in `app/features/promotion/components/BuyerCoinsPage.tsx`, affiliate stats in `app/features/affiliate/components/CreatorDashboardPage.tsx`, and flash sale creation in `app/features/admin/components/AdminFlashSaleManager.tsx`. Seller and flash money displays divide minor units by 100. Verify the literal text THB 0.29 against stored 29 minor units rather than deriving the expected text with the component formatter.

The Test Behavior, Not Implementation principle shaped the proposed assertions. Each scenario uses literal expected committed values rather than repeating the implementation's formula. Type System Discipline shaped the boundary inventory by distinguishing baht, minor units, basis points, coins, and unsafe number serialization.

## Verification addendum

The parent task authorized minimal fixes after the initial source audit. `docs/test-evidence/2026-10-04-numeric/finance-red.log` records 14 failing regressions and 29 passing existing cases before the fixes. Ten coupon cases accepted invalid fractional, negative, or oversized fields. Three valid baht values, 0.29, 1.15, and 19.99, rejected. Concurrent completed-order callbacks produced four earning entries for two shops, rather than the expected two.

`promotion.service.ts` now converts canonical two-decimal baht to safe integer minor units. Coupon monetary fields require nonnegative safe integers, basis points require integer 0 through 10,000, and usage counts require integer 1 through PostgreSQL Int maximum 2,147,483,647. Nullable optional fields retain their behavior.

`wallet.service.ts` now asks its transaction repository to lock the Order row before reading completed state or checking prior credits. `wallet.repository.ts` implements the row lock without a schema change. Competing callbacks for the same order serialize before either can observe a missing earning entry.

`docs/test-evidence/2026-10-04-numeric/finance-green.log` records 48 passing cases across promotion service, wallet service, and the new wallet concurrency database suite. The database suite uses local disposable database `marketplace_test_numeric` at port 55439. It verifies one credit and commission per shop under overlapping calls and a later replay. The literal final balances are 9,001 and 18,002 minor units.

These fixes leave seller gross, shipping, discount funding, commission refund policy, affiliate refund settlement, and oversized global Prisma serialization unchanged. Flash API schema acceptance and seller percentage UI verification belong to the parent task's separate checks. Make Operations Idempotent shaped the order-lock placement. Fix Root Causes required reproducing both rejection and duplicate credits before changing the implementation.

## Exact intermediate arithmetic addendum

The second authorized audit tested multiplication of individually safe amounts. `arithmetic-red.log` records six failing checks and 62 passing cases. Five failures lost or gained one minor unit through floating point intermediate multiplication. The remaining case showed that platform commission accepted an unsafe gross value.

The independent expected values are literal fixtures:

| Formula | Inputs | Exact expected value | Before fix |
|---|---|---|---|
| Platform commission | Gross 9,007,199,254,740,991, rate 10,000 bps | Commission 9,007,199,254,740,991 and net zero | Commission was one lower and net one. |
| Platform commission | Gross 9,007,199,254,740,969, rate 1,000 bps | Commission 900,719,925,474,096 and net 8,106,479,329,266,873 | Commission was one higher. |
| Percentage coupon | Subtotal 9,007,199,254,740,990, rate 9,999 bps | Discount 9,006,298,534,815,515 | Discount was one higher. |
| Affiliate commission | Eligible subtotal 9,007,199,254,740,991, rate 10,000 bps | Commission 9,007,199,254,740,991 | Commission was one lower. |
| Shop discount allocation | Total 9,007,199,254,740,991, platform discount 9,007,199,254,740,891, first shop weight 6,004,799,503,160,660 | Shop discounts 6,004,799,503,160,593 and 3,002,399,751,580,298. Net totals 67 and 33. | First shop discount was one higher, second was one lower. Parent sums alone did not reveal the defect. |

`CommissionService.calculate`, percentage coupons, affiliate commission, and checkout proportional shop allocation now multiply and divide BigInt intermediates before converting their bounded integer result to number. Platform commission also rejects unsafe gross inputs. The rates, floor policy, allocation order, and settlement policy remain unchanged.

`arithmetic-green.log` records 68 passing cases in commission, promotion, affiliate, checkout repository, and refund amount suites. The refund allocator already multiplies BigInt values and required no change. No database or browser execution occurred in this second audit. The parent task owns the final combined typecheck and broader verification.
