# R1 critical documentation coherence

PASS: six scoped documents updated against current source. Documentation-only slice; no application/schema changes or baseline suite reruns for this slice. R2's separate capability fix/tests are documented in [r2-report.md](r2-report.md).

| Document | Corrected contract | Source inspected |
| --- | --- | --- |
| [CLAUDE.md](../../../CLAUDE.md) | Prisma retains bigint, canonical money HTTP strings, inferred UI types, checked provider limits; v1/v2 admission and restart | `server/lib/prisma.ts`, `server/lib/money.ts`, checkout routes/evaluator/tax policy |
| [Architecture](../../ARCHITECTURE.md) | Frozen NET/TAX and gross seller receipts versus NET commission; cumulative partial quantities; affiliate models named from Prisma; COMPLETED/CANCELLED lifecycle | Prisma `ShopSaleSnapshot`, `ItemSaleSnapshot`, allocation and `AffiliateCommissionItem` / `AffiliateRefundReversal`; real refund, Return and admin repositories |
| [Checkout](../../checkout-flow.md) | Shop-then-platform slots, legacy coupon compatibility, exact quote acceptance, added/included/reporting totals, explicit tax options, captured boolean gate, original facts | `checkout.service.ts`, `checkout-quote.evaluator.ts`, `checkout.repository.ts`, `sale-economics.ts`, `checkout.routes.ts`, `tax-policy.service.ts` |
| [Fulfillment](../../fulfillment-flow.md) | Remaining quantity input/projection, independent NET/TAX intervals, same-item hold, terminal Return closure, direct versus linked admin editing, gross coin restoration, NET cashback/affiliate reversal, no automatic coupon/goodwill/restock | `return.service.ts`, `order.repository.ts`, `settlement-refund.service.ts`, `refund.repository.ts`, `admin.repository.ts`, affiliate refund calculation |
| [ERD](../../erd.md), [DBML](../../schema.dbml) | Clearly labeled core/legacy orientation, not complete current-schema/migration source; list omitted v2/affiliate fields and link to authoritative Prisma/design; ERD notes now describe current partial/version semantics | Current `prisma/schema.prisma`; `numeric-tax-design.md` |

Verification:

- Local Markdown link existence: PASS for all six documents.
- `git diff --check` on scoped docs: exit0. UTF-8 without BOM confirmed.
- Search for stale global money-coercion, only-full quantities, zero-tax-only v2 and independent nonclosing Return claims: no matches in these documents. Intentional policy-1 zero-tax semantics remain explicit.
- DBML table/enum definitions unchanged; only coverage notice added. This is not a claim of complete schema diagram coverage. No migration/generate required.
- Tax examples are fixtures, never a legal-rate selection. Nonzero policy/flag changes and historical binary rollback constraints are explicit.
- Final integrated typecheck (run for R2, not counted as a new docs test suite): exit0, [outcome](r2-check-summary.json).

Kept historical evidence and ADR funding policy intact. No edits to readiness plan/report, CI YAML, scripts, generated files or other agents' source.
