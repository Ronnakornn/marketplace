# Numeric audit evidence

Baseline commit is `ed2093b`. Final source changes and this evidence belong to the numeric audit on 2026-10-04, Asia/Bangkok. Reported results come from actual runs. Red logs retain pre-fix application failures and corrected test-fixture failures, which the report distinguishes.

## Final artifacts

- `final-vitest.json`: 1,252 passing tests, zero failed, zero skipped. Every opt-in PostgreSQL and Redis gate was enabled.
- `browser-final.json`: 21 passing Chromium tests, including one authentication setup, zero failed, skipped or flaky. Development Next/API processes used dedicated ports and did not reuse existing servers.
- `browser-database-invariants.json`: eight checks with zero violations. This includes 35 orders, 35 payments, 58 items and 49 shop orders from repeated browser runs plus seeded history.
- `final-typecheck-result.json` and `final-build-result.json`: commands, timestamps and exit codes. Empty successful compiler logs are retained separately.
- `final-generate.log` and `final-i18n.log`: Prisma regeneration and bilingual key/placeholder checks.
- `checkout-*.png` and `numeric-analytics.png`: screenshots taken after numeric UI assertions passed.
- `snapshot-completeness-red.json`: the stricter scanner rejected six historical fixtures missing shop snapshots. Five came from the old demo seed and one from the initial analytics test fixture. Both fixture sources were repaired.
- `seed-snapshots-first.log`, `seed-snapshots-second.log` and `seed-snapshots-count.log`: actual repeat seed runs and nine demo shop snapshots.

## Reproduction environment

The run created an isolated PostgreSQL 17 server at localhost:55439 and Redis 5.0.14.1 at localhost:56379. Redis 5 compatibility is limited evidence; the production Redis 7 gate was not verified. Existing default-port services were not used. The task-owned servers are stopped after verification, and their temporary files remain available at the path in `postgres-path.txt`.

Commands below require disposable local databases that have been migrated. Browser fixtures reject database names without `marketplace_e2e_`; integration tests require `marketplace_test_`. Use the workspace's Bun dependencies and installed PostgreSQL/Redis tools. Do not substitute a production connection.

PowerShell integration run:

```powershell
$env:COMMERCE_TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:55439/marketplace_test_numeric'
$env:QUEUE_TEST_DATABASE_URL=$env:COMMERCE_TEST_DATABASE_URL
$env:QUEUE_TEST_REDIS_URL='redis://127.0.0.1:56379/15'
$env:CACHE_TEST_REDIS_URL='redis://127.0.0.1:56379/14'
$env:QUEUE_TEST_ALLOW_OLD_REDIS='true'
bun run test --reporter=json --outputFile=docs/test-evidence/2026-10-04-numeric/final-vitest.json
```

PowerShell browser run:

```powershell
$env:DATABASE_URL='postgresql://postgres@127.0.0.1:55439/marketplace_e2e_numeric_final'
$env:PLAYWRIGHT_FRONTEND_PORT='3100'
$env:PLAYWRIGHT_API_PORT='3101'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3100'
$env:PLAYWRIGHT_PRODUCTION='false'
$env:NEXT_DIST_DIR='.next-e2e-3100'
$env:PAYMENT_PROVIDER='mock'
$env:PAYMENT_WEBHOOK_SECRET='numeric-test-webhook-secret-2026-at-least-32'
$env:BETTER_AUTH_URL='http://127.0.0.1:3100'
$env:NEXT_PUBLIC_APP_URL='http://127.0.0.1:3100'
$env:PHONE_OTP_ENABLED='false'
$env:CACHE_ENABLED='false'
$env:PLAYWRIGHT_JSON_OUTPUT_FILE='docs/test-evidence/2026-10-04-numeric/browser-final.json'
bun run scripts/assert-e2e-database.ts
# Run the following only after the safety command succeeds.
bun run db:migrate:deploy
bun run db:seed
bunx playwright test e2e/numeric-commerce.spec.ts e2e/numeric-boundaries.spec.ts e2e/numeric-analytics.spec.ts e2e/buyer-lifecycle.spec.ts e2e/checkout-resilience.spec.ts e2e/commerce-edge-flows.spec.ts e2e/finance-lifecycle.spec.ts --project=chromium --reporter=list,json
bun run scripts/verify-numeric-snapshots.ts
```

The webhook secret above is a synthetic local test value. External provider settlement was not exercised. Production configuration deliberately prohibits mock payments; that guard was preserved.

The snapshot scanner uses raw PostgreSQL integer arithmetic and read-only queries. It checks equations, snapshot completeness, per-shop item sums, parent sums, payment amounts/currency, stock bounds and duplicate seller credits. It does not validate discount funding policy or reconstruct external cash settlement.
