# Restore missing historical shop snapshots

The service adds missing `ShopOrder` rows to legacy orders from a manifest of
original facts. It does not recalculate funding from current coupons, prices,
commissions or shop settings. It creates no sale snapshots, refunds or ledger
entries. Existing shop rows must match the supplied evidence.

Each manifest identifies the order, an original evidence reference, and every
original shop. Amounts are canonical nonnegative decimal strings in minor units.
Each shop supplies currency, status, fulfillmentStatus, subtotal, discountTotal,
shippingTotal, taxTotal and grandTotal.

The service requires an active verified administrator and locks the order.
Shop subtotals must equal original item line totals. Every field must sum to the
order field. Item quantity times original unit price must equal its line total.
The shop equation is `subtotal - discountTotal + shippingTotal + taxTotal = grandTotal`.

Dry-run is the default. Apply records the administrator, original manifest,
reference, canonical SHA-256 digest and inserted shop IDs in the same transaction.
Retry and concurrent apply converge to one restoration and one audit. Audit
failure rolls back every inserted shop. New-policy orders and conflicting
existing rows are rejected.

The operator supplies provenance. The software does not establish an external
export's authenticity. Actual historical repair requires independently retained
evidence and a reviewed dry-run. Historical funding and paid legacy ledger values
cannot be reconstructed from mutable settings.

## Local runner

Set `DATABASE_URL` and `RECONCILIATION_ADMIN_ID`, then run:

```powershell
bun scripts/reconcile-historical-shop-orders.ts original-facts.json
bun scripts/reconcile-historical-shop-orders.ts original-facts.json --apply
```

Only localhost databases named `marketplace_test_*` or `marketplace_e2e_*` are
accepted. Production execution is outside this audit. The runner rejects a
production database name before connecting. No production data was modified.

## Executed evidence

`test-evidence/2026-10-04-audit-completion/reconciliation-tests.json` records 18
actual PostgreSQL cases and eight existing audit service cases. All 26 passed
with zero skips. The CLI ran in dry-run and explicit apply modes, and refused a
production-named invocation. A write above JavaScript's safe integer limit
retained its exact cents. `typecheck-reconciliation-result.json` records exit zero.

The first test run had an empty temporary-directory cleanup error. The test now
uses nonrecursive `rmdir` after removing its own manifest. That setup error was
not a product failure.
