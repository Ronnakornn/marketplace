# Task 12: promotion admission

Owner: checkout/promotion builder. Batch Flash Sale promotion admission once over unique candidate shop IDs per evaluator call. Preserve regular-price validation, admission even for unusable sale prices, fail-closed maintenance/user/shop policy and locked revalidation. evaluateFeature already requires every supplied shop, so passing the set retains scope semantics. Coupon/coin admission remains a separate existing gate. Verify lookup count and scoped failures, not latency.
