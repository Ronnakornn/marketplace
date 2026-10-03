# Numeric threshold verification

Base c3142a7. Scope owns new Review/ShopReview/Search/Recommendation/AI/Fraud/ProductAnalytics tests and fixes proven in those domains. UI parity remains the root browser task. No tax/refund/schema changes.

Plan: verify fraud and deterministic AI score boundaries first; verify actual PostgreSQL fraud persistence, review summaries, search badge/filter/facet boundaries, similar-price intervals and analytics conversion thresholds second. Use distinct local test identities, literal expected values and actual route handlers over the same repository rows where practical. Commit verified units separately.

Affected fixture tables are User/SellerProfile/Shop/Category/Brand/Product/ProductVariant/Inventory/Cart/Checkout/Order/ShopOrder/OrderItem/Payment/Review/ShopRating/ProductViewLog/Refund/FraudCase. Refund rows here are read-only fraud-context inputs, with no settlement/refund source changes. Risk is confusing raw bigint with HTTP strings, or claiming supplied AI vectors prove an external provider. Preserve canonical money DTOs and Bangkok dates.

Throughput checkpoint: grounding completed; first blocking unit is pure threshold/AI behavior. Reuse one typed fixture helper for actual PostgreSQL tests; follow with independently observable API/DB assertions. Tests are pending until execution logs and final counts are recorded below. Root owns full-suite/build/browser gates.

## Unit 1 executed result

`pure-ai.log` records 54 passing tests across fraud rules, existing fraud service and AI service files. There are 37 new fraud boundary cases and two new AI service/actual-route cases. Every signal uses below/equal/above literal scores; 39/40/69/70/89/90 levels and nine-reason cap100 pass. Actual Elysia POST returns semantic scores0.1234/0.1235 for supplied0.123444/0.123456, with price `"1200"` in canonical money JSON. Standalone typecheck exited2; `pure-ai-typecheck.log` records errors in unmodified frontend money code/tests inherited from c3142a7. No errors refer to the newly owned fraud/AI tests. Full typecheck is pending the root UI money integration, not passed.

AI embeddings/vector matches are deterministic supplied adapters. This proves production score rounding and HTTP metadata/serialization, not external vector retrieval. No product UI renders this semantic score. IP/device fraud rules are pure coverage only because the runtime order payload does not currently provide those signals. PostgreSQL cases and browser parity remain pending.

## Unit 2 fraud PostgreSQL result

`fraud-pg.log` records four actual repository/service cases passed. Checkout timestamps60,499ms/60,500ms produce scores15/0. Three failed payments plus three canceled Orders, amount100000 and60-second checkout persist capped score100/critical with four runtime reasons. Two concurrent evaluations produce one FraudCase; actual admin GET reads the same100 and reasons. Authentication session identity is supplied by a test adapter for a persisted verified admin, not a real login session.

Refund risk uses row counts including PENDING/FAILED/SUCCESS. Three rows over six Orders produce75/high; adding a seventh Order makes current risk0/low. Re-evaluation leaves the prior OPEN75 case as history, matching current manual review behavior. These fixture refund rows do not execute or modify refund settlement code. `generate.log` records successful isolated client regeneration. Full typecheck still awaits the upstream frontend money migration, with errors logged separately.

## Unit 3 reviews and search PostgreSQL result

`search-review-after.log` records43 passing tests across nine Review/ShopReview/Search files. Six new actual PostgreSQL cases prove empty summaries are zero, published product ratings5,5,3 produce4.33/count3/sum13, and moderated shop ratings5,5,4 produce4.67/count3/sum14. PENDING/REJECTED/HIDDEN ratings are excluded. Shop stored Decimal summary is4.67/count3. Both actual HTTP summaries match; two-item feed pages retain global count3 with a one-item final page and no repeated IDs. Product publication states are fixture updates, while shop publication uses the actual moderation service.

Search min1000/max2000/rating4 includes exact price/rating boundaries and excludes999,2001 and rating3 before pagination. Actual HTTP uses money strings. Paid quantities99/100 cross the best_seller threshold, with new at2026-09-27T00:00:00Z and excluded one millisecond earlier when now is2026-10-04T00:00:00Z.

`search-before.log` reproduces category count2 for one available product and one fully reserved product. Shared SQL filtering now compares Inventory onHand directly with reserved; after fixing it, items, category/brand counts1 and price2000..2000 agree through service/API/DB. `search-canceled-before.log` separately reproduces sold1099 instead of99 for an explicitly inconsistent CANCELED parent with SUCCEEDED payment and DELIVERED line. The projection now excludes CANCELED Orders like the accepted analytics contract. This second fixture proves corrupted-state robustness, not that the normal cancellation workflow creates this combination. Legal delivered returns retain historical sold; item-level canceled lines were already excluded. No new refund policy is introduced.

Full `search-review-typecheck.log` still exits2 solely in unmodified frontend money files from c3142a7. No server diagnostics remain, including the new fixture/tests and Inventory field comparison. Browser parity remains pending root verification. No external login/cache claims apply to these public review/search route tests.

## Unit 4 recommendations and analytics PostgreSQL result

`recommendation-analytics-after.log` records53 passing tests across eight files, including five new actual recommendation cases and two actual analytics cases. Similar source1000 yields inclusive500..1500; source10000 yields7500..12500; source10002 rounds a half minor-unit padding upward and yields7501..12503. Source variants1000/5000 clamp the interval at0..6000. Exact edges appear, one-unit outside does not; source, wrong category, inactive product/variant/shop do not appear. Three accepted rows split across2+1 pages without repeated IDs. Actual recommendation HTTP emits exact canonical money strings.

`recommendation-before.log` reproduces sold109 instead of9 for the same explicitly inconsistent CANCELED parent used in the Search robustness test. Recommendation now applies status not CANCELED with payment SUCCEEDED and item not CANCELED. Unpaid/item-canceled quantities are independently excluded. The prior repository test selected its mocked quantities by JSON-string matching the old query. That mock failed after the query gained the stronger condition (`recommendation-query-mock-failure.log`). The actual PostgreSQL behavior suite replaces it; no SQL outcome is inferred from mock query matching.

Analytics fixture rows9/10 views and zero Orders test the minimum view boundary.100 views/one Order yields exact0.01 and is excluded from low-performing;101 views/one Order yields0.009900990099009901 and is included. Zero views with zero/one Orders both yield finite0. Six products have literal220 views/three Orders/three units/revenue300 in DB, service and authenticated HTTP summaries/tables. HTTP revenue is `"300"`; low-performing order is101-view product then10-view product. A second seven-product fixture views100/90/80/70/60/50/40 proves the limit5 is applied after descending view ranking, with DB view count490. Actual ActiveShopResolver uses the same PostgreSQL ownership repository; the verified owner's session identity is supplied by a test auth adapter, not a real login.

`recommendation-analytics-typecheck.log` exits2 only in unmodified upstream frontend money files. No server diagnostics remain. No analytics service changes were needed. UI rendering and end-to-end real session/cache interactions remain root gates.

## Scope status

| Case group | Executed result | Remaining limit |
| --- | --- | --- |
| Fraud pure signals/levels/cap | Passed37 new cases | IP/device signals are not in runtime Order context |
| AI semantic rounding | Passed2 new service/HTTP cases | Supplied vectors, no external provider or rendered score |
| Fraud runtime persistence | Passed4 PostgreSQL cases | Test auth adapter, browser case table pending |
| Product/shop review summary/feed | Passed3 PostgreSQL cases | Browser rating display pending |
| Search price/rating/badges/stock facets | Passed3 PostgreSQL cases after2 narrow fixes | Browser cards/facets pending; derived rating/badge facet semantics unchanged |
| Similar-price recommendation | Passed5 PostgreSQL cases after1 projection fix | Browser cards pending |
| Analytics conversion/limit | Passed2 PostgreSQL cases | Browser summary/table pending |
| Standalone whole typecheck | Still exits2 at c3142a7 frontend money migration | No server errors; root integrates UI before final gate |

There are56 new passing tests in this scope. This is focused numeric proof, not a full repository/build/browser pass or a production capacity claim.
