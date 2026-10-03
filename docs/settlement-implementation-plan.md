# Accepted settlement implementation

## Workflow

- [x] Read the Principles section of the poteto-mode skill.
- [x] Phase A: Frame.
- [ ] Phase B: Design the workflow.
- [ ] Phase C: Run the loop.
- [ ] Phase D: Keep the audit trail.
- [ ] Phase E: Verify and hand back.

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
