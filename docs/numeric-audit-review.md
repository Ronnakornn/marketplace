# Numeric audit review

Reviewed 2026-10-04, Asia/Bangkok. Baseline: `ed2093b`. Scope: numeric production changes, regression tests, audit notes and recorded evidence in the current shared workspace. Unrelated skill upgrades and generated Next files are excluded. No schema change, deployment, external payment operation or production database operation was performed by this reviewer.

Final stable artifact review: 2026-10-04 after the recorded cleanup at 2026-10-03T19:06:36.8614214Z. Final Vitest: 1252 passed, zero failed or skipped. Final browser: 21 passed, zero failed, flaky or skipped. Typecheck and production build exited zero. The final strengthened database scan reported zero violations across eight checks. The remaining limitations below are coverage or policy gaps, not failures in those final runs.

This is a separate review of the other workers' changes within the same model family. It is not independent model-family verification. This reviewer implemented analytics ranking, percentage display and recommendation sold-count changes; those changes therefore need the parent review in addition to the runtime checks below.

## Findings and dispositions

| Finding | Current disposition | Evidence and limit |
| --- | --- | --- |
| Decimal baht conversion could gain one satang near the safe integer maximum. `90071992547409.9 * 100` rounds to `9007199254740991`; the canonical decimal's correct minor units are `9007199254740990`. The initial `toFixed(2)` equality guard did not prevent this. | Reproduced and repaired. | `finance-decimal-red.log` preserves the failing public service assertion. Current `PromotionService.bahtToMinorUnits` parses the canonical decimal string and calculates with BigInt. `finance-boundaries-green.log` records acceptance of the independent exact maximum fixture, 0.29 and 1.15, among 113 passing checks. |
| Payout accepted unsafe integer amounts at its service boundary. | Reproduced and repaired. | Current routes and service use safe integer limits. `finance-boundaries-green.log` proves `9007199254740992` rejects before funds are reserved. |
| A cart mutation queued behind a lock could operate on a cart whose status had changed. | Guarded with actual database regression. | Four mutation methods now assert active status after the locked reread. `cart-followup-green.log` records 24 passes, including eight PostgreSQL cases. The normal inspected checkout path deletes selected items and leaves its cart active; the status-change fixture additionally tests a controlled competing transition. |
| Global Prisma result serialization converts every bigint with `Number(v)` without a safe integer guard. Persisted values above the safe number range lose precision before services receive them. | Remaining source-confirmed gap. | `server/lib/prisma.ts`. Input and checkout guards reduce new unsafe writes but do not prove safety for legacy data, aggregate sums, other write paths or arbitrary database values. No oversized real PostgreSQL response serialization case was run. |
| Initial snapshot invariant script omitted missing shop snapshots and shop tax totals. | Script and demo seed repaired, fresh database scan passed. | Current `scripts/verify-numeric-snapshots.ts` checks missing snapshots, item/shop mapping, unexpected snapshot shops, currency agreement, parent tax sum, each shop's arithmetic equation and each shop's item subtotal. `snapshot-completeness-red.json` records six missing-snapshot violations in the old database. The demo seed provides nine explicit snapshots for five orders; the final fresh database has zero violations across eight checks. |
| Lightweight analytics ranking still retains all matching candidates and metric rows in service memory. | Explicit scalability limitation, accepted minimal repair. | Queries fetch candidate IDs/titles or IDs/SKUs in batches of 500, hydrate only selected page IDs, and sort with stable ID ties. Memory and sorting remain proportional to the matching catalog/log set. No catalog-size benchmark was run. |
| Seller gross earnings, shipping entitlement, discount funding and commission reversal on refunds use different underlying formulas. | Policy gap; no speculative settlement change. | `numeric-audit-finance-notes.md` has independent 10000/2000/500/10% examples. Current arithmetic correctness does not establish the intended economic contract. |
| Affiliate refund settlement and externally verified refund reconciliation are incomplete. | Unsupported/unverified rather than passed. | Finance source notes and production-readiness contract. Mock payment/webhook flows do not prove real provider settlement or late paid-money refund. |

## Review conclusions

Checkout row, shop and payment amounts now derive from the authoritative priced quote and persisted snapshots. BigInt intermediate multiplication repairs commission, affiliate, percentage coupon and proportional shop-discount rounding while preserving their existing floor and remainder policies. Parent sum equality alone would not have detected the reproduced one-satang allocation error; the new literal per-shop checks cover it.

Cart and earning changes place a parent lock before rereading mutation state. Inventory reservation transitions reread the active reservation after their inventory lock. The real database scenarios are stronger evidence than the previous mocks for duplicate transitions, lost cart additions and duplicate seller earnings. Passing scenarios do not prove every possible lock ordering or arbitrary concurrency load.

Seller order projections sum the authorized shop snapshots. Recommendation sold units filter payment success. Product and SKU rankings apply their metric sort before slicing pages, with stable ID ties. The percentage formatter consumes API fractions; the component and browser assertions use independent `10%` expectations for a fraction of 0.1.

## Evidence checked

| Recorded artifact | Observed result | Interpretation |
| --- | --- | --- |
| `baseline-vitest.json` | 1053 passed, 24 pending, zero failed. | Baseline only, not the final changed-workspace result. |
| `final-vitest.json` | 1252 passed, zero failed or skipped; success true. | Completed final combined suite after frontend decimal and seed changes. |
| `other-red.log`, `other-green.log` | Four regressions failed before repairs; 33 deterministic checks passed afterward, two database checks skipped in that focused run. | The skipped cases subsequently ran in the PostgreSQL artifact below. |
| `postgres-numeric.json` | Six passed, none skipped. | Actual inventory commit/release/expire replay, analytics global ranking, recommendation/search paid-count agreement, and concurrent/replayed earnings. |
| `postgres-commerce.json` | Nineteen passed, none skipped. | Actual commerce database integration selected by the parent runner. |
| `cart-followup-green.log` | Twenty-four passed across three files. | Includes eight additional actual PostgreSQL cart scenarios. |
| `finance-boundaries-green.log` | 113 passed across seven files. | Includes the last decimal and unsafe payout fixes. |
| `redis-integration.json` | Two passed, none skipped. | Selected Redis integration checks. A PostgreSQL client overlapping-query deprecation warning remains in its log. |
| `browser-final.json` and `.log` | Twenty-one passed; zero unexpected, flaky or skipped. Final run started 2026-10-03T19:02:15Z. | Actual Chromium UI/API/DB checks after the final frontend changes, including numeric analytics. Earlier failed runs are historical evidence and must not be reported as the current result. |
| `browser-database-invariants.json` | Current strengthened eight-check scan shows zero violations over 35 orders, 35 payments, 58 items and 49 shop orders in `marketplace_e2e_numeric_final`. Checked at 2026-10-03T19:03:57.750Z. | Includes completeness, currency mapping, tax totals, per-shop equations and per-shop item subtotals. Fixture totals include historical seeded orders, not solely purchases through the UI. |
| `other-typecheck.log`, `commerce-typecheck.log` | Recorded exit-zero focused workspace checks. | One analytics E2E preparation attempt encountered transient malformed generated Next validator output while Next was running. Subsequent parent final typecheck governs final workspace status. |
| `final-typecheck-result.json` | Exit zero for `bunx tsc --noEmit`, checked at 2026-10-03T19:04:43.1212743Z. | Completed final workspace typecheck. |
| `final-build-result.json` | Exit zero for `bun run build`, checked at 2026-10-03T19:01:40.0738668Z. | Completed production build. |
| `cleanup-result.json` | Temporary PostgreSQL and Redis stopped; temporary data retained; default services untouched. Checked at 2026-10-03T19:06:36.8614214Z. | Cleanup status recorded by the owner of the temporary processes. |

The browser analytics case seeds a historical paid order containing three one-unit lines of 100, 200 and 900 satang, with ten product-A views. It proves aggregate conversion 10%, product-A conversion 10%, UI revenue order C/B/A, API pages [900, 200] then [100], and database item/parent values. The three numeric commerce browser cases separately perform purchase/payment flows. The analytics test is not itself a browser checkout test.

The analytics fixture includes a valid 1200-satang `ShopOrder`. Final browser evidence passed all 21 cases after the frontend exact decimal changes. Demo seeding was repeated twice and the strengthened final scan passed. No browser or database test process was started by this reviewer.

## Final follow-up review

The tightened snapshot scanner rejects the old database with six missing-snapshot violations in `snapshot-completeness-red.json`. This is a useful negative control: five baseline demo orders and the earlier analytics fixture were previously invisible to the completeness check. The old seven-check, zero-violation artifact must be read as historical evidence, not final proof under the stronger scanner.

The current `scripts/seed.ts` declares literal per-shop subtotals, discounts, shipping and grand totals for all five demo orders, producing nine shop snapshots. Each fixture is checked against that shop's order-item subtotal and the parent totals before persistence. The discounted order independently allocates discount 61 and 239, shipping 250 and 250, and grand totals 1479 and 4981. Upsert keys are `(orderId, shopId)`, so repeat seeding updates the same snapshots rather than creating duplicates. `seed-snapshots-first.log` and `seed-snapshots-second.log` both record completed seeding; `seed-snapshots-count.log` records nine demo snapshots after repetition. The current fresh database invariant artifact records zero completeness or aggregate violations.

The final scanner additionally verifies each shop snapshot's arithmetic equation and compares its subtotal to that shop's order-item lines. This closes the previously identified aggregate-only blind spot where incorrect per-shop subtotals could offset each other. The numeric commerce browser cases also assert independent per-shop discount and shipping literals. These invariants establish persisted consistency for the inspected database; they do not decide unresolved settlement policies.

Frontend coupon, payout and catalog input conversions now use `app/lib/input-decimal.ts`. It parses the text mantissa and exponent into digits, verifies sub-satang digits are zero, bounds positive shifts before allocating, and converts only safe integer results to number. This avoids floating point multiplication while retaining valid scientific notation and trailing zeros. Invalid or unsafe text returns NaN for the existing API validation flow. Review found no incorrect satang arithmetic in the current parser.

Review also raised a catalog round-trip edge: initializing a form with `String(Number(price) / 100)` lost one satang at a valid maximum price before the new parser ran. The form now uses BigInt quotient and remainder to initialize stored `9007199254740991` as decimal `90071992547409.91`. Component assertions preserve that exact amount when saving without an edit. `seller-decimal-red.log` and `seller-decimal-compatibility-red.log` preserve the reproduced input and round-trip failures. The completed `seller-decimal-green.log` records 78 passing checks across three files, including real rendered coupon, payout and catalog components. The final combined suite, browser rerun, typecheck and build subsequently passed.

## Provenance and remaining coverage

The active local Codex session metadata identifies this workspace as `D:\GitHub\marketplace`. Artifact filename references were checked in `C:\Users\ASUS\.codex\sessions\2026\10\04\rollout-2026-10-04T00-56-32-01a102e9-1617-77f2-9a63-c3d60e21207d.jsonl`; it references the baseline, PostgreSQL, browser and regression artifacts above. Only workspace metadata and artifact-reference counts were inspected for provenance. Raw command payloads and credentials were not copied. Transcript references support artifact provenance and do not constitute an independent rerun.

The source inventories cover additional numeric formulas beyond the selected runtime cases. Actual browser/database proof remains incomplete for fraud scores, AI confidence, dashboard timezone boundaries, rating aggregates, every pagination/numeric-validation edge, large analytics datasets, external providers, and unsupported partial-unit return rounding. Passing selected cases must not be described as every numeric flow having passed.

The inventory notes preserve baseline findings and later implementation addenda. Any statement such as "no analytics E2E assertion found" refers to the baseline source scan; the new `e2e/numeric-analytics.spec.ts` and completed browser run supersede it. The stable final results above supersede earlier pending checkpoints and baseline verification counts. No new source flags arose from this final artifact check.
