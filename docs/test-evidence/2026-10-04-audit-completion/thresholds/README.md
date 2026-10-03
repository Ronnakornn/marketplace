# Numeric threshold verification

Base c3142a7. Scope owns new Review/ShopReview/Search/Recommendation/AI/Fraud/ProductAnalytics tests and fixes proven in those domains. UI parity remains the root browser task. No tax/refund/schema changes.

Plan: verify fraud and deterministic AI score boundaries first; verify actual PostgreSQL fraud persistence, review summaries, search badge/filter/facet boundaries, similar-price intervals and analytics conversion thresholds second. Use distinct local test identities, literal expected values and actual route handlers over the same repository rows where practical. Commit verified units separately.

Affected fixture tables are User/SellerProfile/Shop/Category/Brand/Product/ProductVariant/Inventory/Cart/Checkout/Order/ShopOrder/OrderItem/Payment/Review/ShopRating/ProductViewLog/Refund/FraudCase. Refund rows here are read-only fraud-context inputs, with no settlement/refund source changes. Risk is confusing raw bigint with HTTP strings, or claiming supplied AI vectors prove an external provider. Preserve canonical money DTOs and Bangkok dates.

Throughput checkpoint: grounding completed; first blocking unit is pure threshold/AI behavior. Reuse one typed fixture helper for actual PostgreSQL tests; follow with independently observable API/DB assertions. Tests are pending until execution logs and final counts are recorded below. Root owns full-suite/build/browser gates.

## Unit 1 executed result

`pure-ai.log` records 54 passing tests across fraud rules, existing fraud service and AI service files. There are 37 new fraud boundary cases and two new AI service/actual-route cases. Every signal uses below/equal/above literal scores; 39/40/69/70/89/90 levels and nine-reason cap100 pass. Actual Elysia POST returns semantic scores0.1234/0.1235 for supplied0.123444/0.123456, with price `"1200"` in canonical money JSON. Standalone typecheck exited2; `pure-ai-typecheck.log` records errors in unmodified frontend money code/tests inherited from c3142a7. No errors refer to the newly owned fraud/AI tests. Full typecheck is pending the root UI money integration, not passed.

AI embeddings/vector matches are deterministic supplied adapters. This proves production score rounding and HTTP metadata/serialization, not external vector retrieval. No product UI renders this semantic score. IP/device fraud rules are pure coverage only because the runtime order payload does not currently provide those signals. PostgreSQL cases and browser parity remain pending.
