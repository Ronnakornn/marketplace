# Complete the remaining numeric audit

## Workflow

- [x] Read the Principles section of the poteto-mode skill.
- [x] Phase A: Frame.
- [x] Phase B: Design the workflow.
- [ ] Phase C: Run the loop.
- [ ] Phase D: Keep the audit trail.
- [ ] Phase E: Verify and hand back.

## Scope and done predicate

The user requested all remaining numeric audit work after settlement commits
37b5d10, c55e8ac and 9cb0fa3. Every remaining report entry receives a concrete
implementation or executed verification with independent expected values.
Unsupported business features require an accepted rule before enabling them.
External verification requires a real sandbox; missing access is an explicit open
item, never a simulated pass. No production migration or real money movement is
authorized by the audit.

High rigor applies to stock, money representation, refund capacity and balances.
The scope comprises nine workstreams plus final review. Baselines and executed
proofs live in test-evidence/2026-10-04-audit-completion. The existing append-only
numeric-audit-decisions.tsv remains the canonical trail.

Affected domains include Catalog/Inventory, Checkout/Promotion, Refund/Return,
Wallet/Payout, Affiliate, Analytics/Search/Recommendation/Review/Fraud, and Payment.
Potential tables include original sale/refund allocations, return quantities,
coupon reservations, affiliate commissions and their reversal records. Existing
database data is not reconstructed from mutable current settings.

## Design and delegation

- [x] Ground. Trace inventory, money conversion, refund/affiliate and environments.
- [x] Sketch. Compare exact-money transport with compatible safe-number boundaries.
- [x] Agree. Synthesize against exactness, transaction safety, Eden compatibility,
  migration cost and full-path testability. Review independent candidate artifacts.
- [ ] Implement. Keep one verified unit per local commit.
- [ ] Scrap. Revisit the design only if measured defects invalidate its contract.

Arena phases are Frame, Fan out, Cross-judge, Pick, Graft and Verify. Coverage
swarm phases are Frame, Fan out, Aggregate and Report. Read-only grounding and
design outputs have disjoint paths; implementation uses separate worktrees when
parallel. Available models are one family, so review is independent but not
cross-family. No changes to other worktrees or skills are owned by this task.

Throughput checkpoint: two read-only money candidates and one inventory trace,
then source implementation after synthesis. Three to five small units are active
at a time; long runtime checks are scheduled to avoid build/browser contention.

## Workstreams

- [x] W1. Remove or secure legacy direct inventory writes. Prove reservation
  protection, stock/version/movement accounting, ownership and concurrent writes.
- [ ] W2. Preserve exact minor units throughout database read, aggregate, API and
  displays. Test MAX_SAFE boundaries and signed/lifetime aggregates explicitly.
- [x] W3. Verify multiple refunds sharing one buyer coin wallet under actual
  PostgreSQL concurrency, rollback and retry, repairing discovered defects.
- [ ] W4. Add literal threshold cases and UI/API/DB parity for cashback, reviews,
  search badges/prices/ratings, flash availability, recommendations, AI score,
  fraud signals and analytics. Align daily reporting to the accepted timezone.
- [ ] W5. Measure analytics candidate/ranking memory and pagination under bounded
  load and concurrent traffic; record the actual scale and latency limits.
- [ ] W6. Run Redis 7, Firefox/WebKit/mobile and a production-mode local browser
  workflow without disabling production payment safeguards.
- [ ] W7. Implement accepted partial-quantity returns, affiliate late-refund
  reversal, coupon stacking and explicit coupon/goodwill policies. Tax uses
  configurable rates and inclusive/exclusive pricing, defaulting to zero.
- [x] W8. Build guarded historical reconciliation with dry-run, provenance and
  explicit supplied original facts. Reject missing evidence instead of guessing.
- [ ] W9. Execute external provider/bank/currency reconciliation and real sandbox
  retry/out-of-order cases when sandbox identity/access is supplied. Prepare the
  runnable checks and document exact missing inputs while independent work runs.
- [ ] W10. Independent source/comment/trail review, full tests, typecheck, build,
  translations, final matrix, scoped cleanup and local commits.

## Open owner inputs

Questions sent during framing ask for reporting timezone, partial-return and
coupon/affiliate rules, tax policy and provider sandbox identity. Dependent
features wait for required answers; stock and representation work proceeds.

The owner accepted Asia/Bangkok, cumulative original partial-return rights,
merchandise-based affiliate reversal, Shop then platform coupon stacking, no
automatic coupon replacement and no automatic goodwill. Tax must be configurable;
both inclusive and exclusive arithmetic will be supported with a default zero
rate. External provider/bank identity and sandbox credentials are not present in
the inspected environment keys and have not been supplied.
