# Cumulative refund allocation fix

## Bug fix workflow

- [x] Reproduce it yourself on the matching surface via the control skill.
- [x] Binary-search the cause.
- [x] Plan the fix.
- [x] Verify on the same surface.
- [x] Stage the commits so the failing repro lands before the fix in git history. Red reproduction is committed in `fa3c4f8` before the fix.
- [x] Run Opening a PR. Skip because no PR was requested; this task remains local.

## Architect phases

- [x] Ground.
- [x] Sketch.
- [x] Agree. No human checkpoint requested for this arithmetic fix.
- [x] Implement.
- [x] Scrap. Skip because the chosen shape passed verification.

## Scope and expected behavior

The confirmed candidate is repeated rounding of independent order-wide cash
refunds. Test the existing refund-completion repository against the disposable
PostgreSQL database, then observe committed Refund and WalletLedgerEntry rows.
These seams were authorized by the original UI/API/DB numeric-audit request.

Two Shop Orders with grandTotal 1 minor unit each have a payment of 2.
Two successful refunds of 1 must debit each Shop by a total of 1, not debit
the same Shop twice. Literal expected per-shop ledger amounts are -1 and -1.
Duplicate completion must retain those amounts. No coupon-funding, commission,
shipping-refund, or payout-debt policy is selected by this fix.

Affected domains are Refund and Wallet. Records read are Refund, ShopOrder,
Payment, ReturnRequest and WalletLedgerEntry. The existing order transaction
lock must cover previous refund allocation reads and the new debit writes.
No schema change or generated-file edit is planned.

Before implementation, compare at least two designs. The rubric is exact
per-shop limits, cumulative rounding, compatibility with targeted return refunds,
legacy-data handling, a small interface, and transactional safety. Produce a
failing database regression before selecting the implementation.

The throughput checkpoint is one database reproduction, two design candidates,
one scoped implementation, one independent source review, and database plus
typecheck/test verification. Preserve unrelated skill changes.

Append red/green and design checkpoints to `numeric-audit-decisions.tsv`.

## Result

The original PostgreSQL reproduction now passes, including seller wallet service
response parity. Seven added database cases cover sequential cents/replay,
simultaneous different refunds, decreasing ideal components, mixed return/order
refunds, over-return rejection, missing history, and already overdrawn history.
All 20 commerce database cases pass, including the existing rollback case.

The focused amount/repository/database suites pass 52 cases. The complete Vitest
run passes 1,279, fails zero, and skips two Redis integration cases. Typecheck
passes. Pure finite arithmetic exploration has zero failures. No browser or
external provider run is claimed for this backend increment.

Source review found no blocking issues. Its cross-payment history coverage gap
was closed by a literal repository regression. Existing unsafe legacy BigInt
serialization remains outside this fix. Evidence is in
`test-evidence/2026-10-04-refund-allocation/README.md`.
