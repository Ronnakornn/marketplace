# Cumulative refund allocation fix

## Bug fix workflow

- [ ] Reproduce it yourself on the matching surface via the control skill.
- [ ] Binary-search the cause.
- [ ] Plan the fix.
- [ ] Verify on the same surface.
- [ ] Stage the commits so the failing repro lands before the fix in git history.
- [ ] Run Opening a PR. Skip unless a PR is requested; this task remains local.

## Architect phases

- [ ] Ground.
- [ ] Sketch.
- [ ] Agree. No human checkpoint requested for this arithmetic fix.
- [ ] Implement.
- [ ] Scrap. Skip if the chosen shape survives verification.

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
