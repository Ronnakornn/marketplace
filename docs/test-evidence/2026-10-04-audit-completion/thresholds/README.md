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
