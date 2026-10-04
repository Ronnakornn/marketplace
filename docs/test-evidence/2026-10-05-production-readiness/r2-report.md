# R2 rollout and original-version compatibility

PASS: six new actual-PostgreSQL service cases, zero skipped in the focused run. One capability-reporting defect was reproduced and fixed. Existing 1,745 tests and browser proofs are baseline, not new R2 results.

Proof: [tests log](r2-tests.log), [machine report](r2-tests.json), [pre-fix failure](r2-red.log), [implementation plan](r2-plan.md). Exclusive database: local `marketplace_test_readiness_tax`, supplied through `ROLLOUT_TEST_DATABASE_URL`; CI must provision a separate `marketplace_test_rollout`. No production or external provider calls.

| New transition | Independent expectations and result | Evidence level |
| --- | --- | --- |
| Same instance after environment flag change | Existing evaluator still quotes cash10,700 / reported tax700. Policy GET/PUT must report its captured enabled capability. Fresh instances report false and reject new v2 with503. PASS after fix. | 4: real services / PostgreSQL |
| Existing v2, disabled replacement, refund before delivery | Original cash21,400 = NET20,000 + TAX1,400, original commission2,000. New policy0 / current commission20% cannot change original rights. Refund cash10,700 = NET10,000 + TAX700; commission reversal1,000. Recognition posts10,700 and fee−1,000, wallet9,700. PASS. | 4 |
| Existing v2, disabled replacement, refund after delivery | Recognition posts21,400 and original fee−2,000; refund posts−10,700 and original commission reversal+1,000; wallet9,700. PASS. | 4 |
| Replay after rollback | Identical paid webhook, SUCCESS refund, and earning recognition leave entire wallet and coin ledger rows unchanged. Cashback original+2, reversal−1; remaining balance/lifetime earned1, pending/debt0. PASS. | 4 |
| Existing and newly created v1 | Both paid/recognized/refunded by disabled instance: cash10,000, original fee1,000 despite wallet commission20%; wallet9,000 then0. No v2 acceptance required. PASS (two cases). | 4 |
| Old v2 acceptance across restart and policy downgrade | Disabled nonzero policy rejects503. After explicit policy0, named coupon still requires v2 and rejects503; old acceptance rejects409. CartACTIVE, item10,700/Q1, stock10/reserved0, coins5/pending0, coupon right unconsumed, no checkout/order/payment/snapshots/reservations/coin ledger. Refreshed legacy quote cash10,500 succeeds as v1 with stock reservation1, coupon reservation1, coins4/pending1. PASS. | 4 |

The defect: `TaxPolicyService` reread environment on GET/PUT while `CheckoutQuoteEvaluator` captured it at construction. [Red run](r2-red.log) proves the existing checkout admitted the v2 quote while management reported disabled. The narrow fix captures the same startup capability in `TaxPolicyService`; policy values/revisions continue to come from the database dynamically. Constructor compatibility and returned DTO shape are unchanged. No dynamic rollout feature was added.

Intermediate first/second runs corrected test assertions to actual public fields (`status`, cartACTIVE, policyVersion on ShopSaleSnapshot), coupon redemption counters and the established net lifetime-earned/reversal ledger contract. They are not additional application defects. Final literal expectations do not import tax, commission or refund calculation functions.

Typecheck: final `bunx tsc --noEmit` exits0 for the integrated repository; see
[r2-typecheck.log](r2-typecheck.log) and [command outcome](r2-check-summary.json).
Earlier attempts observed active R1/R3 fixture edits outside this scope; these
were resolved by their owners before the final check.

## Blast radius and release constraints

- Startup/composition snapshot, not live environment mutation: change flag, restart/replace every API instance, and remove enabled old instances from routing before claiming new v2 admission is stopped. Boolean flag has no cohort routing. Admin capability is instance-local.
- A disabled instance with a stored nonzero policy deliberately blocks new checkout; it does not silently replace that policy or invent a legal tax rate. The zero-rate downgrade in the test is an explicit fixture operation, not an operator policy recommendation.
- Existing v2 original snapshots still govern payment, earning, NET/TAX refunds, cashback and original commission. Disabling admission must retain these processors and their schema. Do not delete financial history or roll code back before v2 support once v2 sales exist.
- Existing v1 remains readable/processable and zero-tax legacy creation is compatible. New named coupon slots remain v2 and require the opt-in capability even at rate0.
- Verified: real service replacement and real transactions on one current binary/schema. UNPROVEN here: OS process restart, two deployed artifacts of different revisions, downgrade migrations, Linux/staging routing, production data, provider signatures/bank records. R5 must prove deployed restart/recovery; R4 owns external records. No browser rerun because no UI source changed.
- Current pg adapter emits a deprecated concurrent-query warning during successful transactions; R2 does not establish compatibility with a future pg9 upgrade.

Principles applied: prove-it-works, test-behavior-not-implementation, fix-root-causes, with blast-radius evidence levels and narrow source ownership.
