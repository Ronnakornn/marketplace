# Settlement domain modeling plan

## Workflow

- [x] Read the Principles section of the poteto-mode skill.
- [x] Phase A: Frame.
- [x] Phase B: Design the workflow.
- [x] Phase C: Run the loop.
- [x] Phase D: Keep the audit trail.
- [x] Phase E: Verify and hand back.

## Frame

This increment defines the language and exposes the financial policy choices left
open by the numeric audit. It produces a glossary update and one settlement
reference with source evidence, literal scenarios, and proposed policy choices.
An accepted shipping entitlement decision is recorded separately in ADR-0004.
It does not change financial behavior or select a policy for the business.

Done means each documented current rule has a source reference, each numeric
scenario reconciles in integer minor units, and every proposed rule has an
explicit pending or accepted status. A pending product decision is not a pass.

The affected domains are Checkout, Promotion, Order, Payment, Shipping,
Commission, Wallet, Payout, Return, Refund, and Affiliate. The relevant records
are Coupon, CouponRedemption, OrderItem, ShopOrder, Payment, Refund, ShopWallet,
WalletLedgerEntry, SellerTransaction, SellerPayout, ReturnItem, buyer coin
reservations and ledger entries, and AffiliateCommission. This increment changes
neither those records nor the Prisma schema.

The main risk is treating an existing formula as an agreed financial policy.
Source inspection is sufficient to describe current behavior. It cannot decide
who pays for a discount, receives shipping, or retains a fee after a refund.

## Units and verification

1. Trace buyer pricing and seller finance separately with read-only explorers.
   Check their findings against source symbols and existing evidence.
2. Update `CONTEXT.md` with business terms only. Keep implementation details and
   policy proposals in `settlement-domain-model.md`.
3. Record current formulas and compare concrete policy options. Preserve the
   historical audit evidence and append this increment to its decision trail.
4. Ask the business owner about genuine policy choices after the alternatives
   and their numeric effects are reviewable. Continue independent documentation
   and verification while awaiting the answer.
5. Review the changed documents, verify scenario arithmetic and source links,
   and run the repository-required typecheck and tests. Report infrastructure
   skips separately. Create an accepted ADR only after a policy is selected.

The throughput checkpoint is two independent read-only traces, one glossary,
and one policy reference. No application implementation is scheduled until the
funding and refund contract is resolved.

## Trail

Append checkpoints to `numeric-audit-decisions.tsv`. The existing numeric audit
is the baseline, not proof that a proposed settlement policy is implemented.

## Result

The modeling increment is complete. Shipping entitlement is accepted in
ADR-0004. Funding and commission questions remain pending, so financial
implementation has not started. Source review corrected one invalid method
reference and removed stale pending-shipping statements.

Typecheck passed. Vitest passed 1,213 tests, failed zero, and skipped 39 optional
infrastructure tests. PostgreSQL, Redis, browser, and provider checks were not
rerun for this documentation increment. Evidence is in
`test-evidence/2026-10-04-settlement-model/`.
