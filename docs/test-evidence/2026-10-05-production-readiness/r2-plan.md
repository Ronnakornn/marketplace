# R2 isolated rollback proof

Only new rollout transitions are added. Existing tax, partial, inventory and browser evidence remains baseline.

1. Compare already-created policy/evaluator capability against fresh instances after flag changes. Capture a failing real-service test before any source fix.
2. Create original v2 NET/TAX while enabled; replace instances after disabling and changing policy/current commission. Settle internal mock payment, recognize and refund on either side of delivery, replay all financial calls.
3. Create/settle/refund v1 on the disabled instance.
4. Reject old acceptance while disabled and after policy downgrade, checking exact persisted cart, inventory, coins, coupon, checkout/order/payment/snapshot state; accept only a refreshed quote.

Use real services and exclusive local PostgreSQL via ROLLOUT_TEST_DATABASE_URL. Literal fixture expectations, no formula-derived oracle. No browser, build, external provider or production claims. New service construction simulates composition restart; actual process deployment is R5.
