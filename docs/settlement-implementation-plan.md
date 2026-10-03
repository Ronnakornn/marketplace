# Accepted settlement implementation

## Workflow

- [x] Read the Principles section of the poteto-mode skill.
- [x] Phase A: Frame.
- [x] Phase B: Design the workflow.
- [x] Phase C: Run the loop.
- [x] Phase D: Keep the audit trail.
- [x] Phase E: Verify and hand back.

## Predicate and scope

New orders preserve checkout funding and original commission. Buyer payment
reconciles with Shop entitlement, commission and marketplace promotion expense.
Completed refunds reverse each component once, bounded by its original amount,
regardless of retries, concurrency or whether earnings already exist. Shipping
refunds follow dispatch state and approved reason. Negative retained seller funds
block payout approval/payment and future credits offset debt. Legacy orders are
not silently repriced or backfilled.

Affected domains are Checkout, Promotion, Order, Commission, Wallet, Refund,
Return and Payout. Tables include ShopOrder, OrderItem, Refund and its settlement
allocations, WalletLedgerEntry, SellerPayout and BuyerCoinLedger. Schema changes
are additive and migrations are tested only against a disposable local database.

High rigor is required because buyer cash is no longer equal to seller reversals.
The main risks are losing promotion funding, changing historical commission,
debiting unearned revenue, subsidized zero-cash items, ambiguous free-text return
reasons, repeated rounding, and payout/refund races.

## Units

1. Trace existing flows and compare two snapshot/refund designs. Record synthesis.
2. Add schema and an additive migration, regenerate client/validators, then
   implement checkout snapshots and their literal expected-value tests.
3. Credit snapshot-based earnings and apply cumulative component reversals under
   the Order lock. Verify paid, unearned, returned, subsidized and shipping cases.
4. Recheck outstanding payout funding under its Wallet lock. Verify debt recovery.
5. Verify UI/API/DB amounts, concurrency, rollback and replay on disposable local
   infrastructure. Run typecheck, required tests and source review. Record skips
   separately and commit verified units.

The throughput checkpoint is two read-only design artifacts followed by separate
implementation ownership for checkout/earnings, refund/return and payout. The
root owns schema, synthesis, integration verification, docs and the final diff.
The canonical trail remains numeric-audit-decisions.tsv.

## Completed behavior

Additive snapshots and explicit refund plans implement ADR-0005 for new orders.
Whole-item refunds preserve original funding and fee, including zero cash.
Paid pre-shipment cancellation restores stock and recomputes remaining delivery
eligibility. Admin completion retries recover remaining earnings without applying
the new policy to legacy orders. Outstanding payout funding is checked again.

Actual browser checks compare saved refund cash and final seller balance with API
and PostgreSQL. Final counts, red runs, infrastructure limits and cleanup are
recorded in test-evidence/2026-10-04-settlement-policy/README.md.

Final gates: 1,374 Vitest cases passed with PostgreSQL/Redis enabled and no skips;
four Chromium finance flows passed; standalone typecheck and production build
exited 0. Task PostgreSQL and Redis stopped, dedicated browser ports closed, and
test data retained. External provider/bank execution and the remaining numeric
audit gaps are not certified by this increment.
