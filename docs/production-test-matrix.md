# Production test matrix

## Latest load revision: 1,000 users / 1,000 checkout per minute / 1 minute

**PASS, 2026-09-08.** Final code: 61,684 requests, zero errors, overall p95 51.32ms and 1,000/1,000 checkout submissions. Every endpoint p95 is below 1,000ms. PostgreSQL confirms 1,000 orders/payments and 1,000 reserved units.
Local Node 22 client and Bun API on the same machine, 1s actor think time, synthetic distinct IPs, no external payment completion.
[Final load report](test-evidence/2026-09-08/production-load-pass.json) · [Database proof](test-evidence/2026-09-08/production-load-pass-database.json) · [Pre-fix failure](test-evidence/2026-09-08/production-load-1000-users-1000-checkouts-1-minute.json)


Snapshot: 2026-09-08. Item-level scope from the agreed buyer/seller checklist. This document maps evidence, not a production approval. See [live execution results](production-acceptance-checklist.md) and [previous execution report](buyer-seller-test-report.md). Latest full unit/integration run: 1,077 tests passed after performance fixes. All 140 production-mode headless browser cases passed before the backend performance changes. Latest local load passed: 1,000 users, 1,000/1,000 checkouts in a one-minute workload, zero errors; production approval is not established.

Status: **EXECUTED** = directly verified scope in this acceptance task, remaining limits retained; **PREVIOUS** = relevant cases executed in the earlier run, with limits stated; **ASSERTIONS** = existing automated assertions inspected, current execution pending; **PENDING** = additional test needed; **BLOCKED** = external environment/config needed; **GAP** = requested behavior absent. Mixed statuses deliberately preserve incomplete coverage. Test paths below are repository-relative; a file reference does not imply every case in this row is covered.

Latest accepted load (user revision 2026-09-08): 1,000 concurrent users, 1,000 checkout submissions/minute, 1 measured minute, API p95 <1,000ms and errors <1%, excluding setup/login and provider latency. This short load check is not a soak. Record hardware, dataset and workload. Accepted recovery: RPO <= 15 minutes, RTO <= 60 minutes. Local results prove only their local scope; staging capacity and production backup cadence/PITR remain separate gates.

## 1. Accounts and authorization

| ID | Required test | Status and evidence / remaining scope |
| --- | --- | --- |
| AUTH-01 | Signup, verify email, login, logout, password reset | EXECUTED / PENDING: `e2e/auth-lifecycle.spec.ts` signup, known-fixture OTP verification, two-device login/logout and reset passed in some browser runs; final140-case browser matrix passed. `server/modules/user/password-reset.integration.test.ts` PostgreSQL concurrency/rollback/expiry **3/3**; focused service **18/18**. OTP issuance and real email delivery remain untested; fixture HMAC codes are not inbox delivery. |
| AUTH-02 | Expired/revoked sessions and multiple devices | EXECUTED / PENDING: auth lifecycle verifies reset revokes both old sessions, OTP replay rejection and old-password denial; final140-case browser rerun passed. Atomic reset regression **3/3** on PostgreSQL. Edge E2E session deletion/re-login previously passed; expiry by clock and broader device lifecycle remain pending. |
| AUTH-03 | Buyer cannot read or mutate another buyer's resources | PREVIOUS / ASSERTIONS: edge E2E denies another buyer order; `server/modules/order/order.routes.test.ts`, `server/modules/security/security.test.ts` ownership cases. Broader mutation endpoint matrix pending. |
| AUTH-04 | Seller cannot read or mutate other shops' products/orders/finances | PREVIOUS / ASSERTIONS: edge E2E product denial; `e2e/seller-workflows.spec.ts` ownership; catalog/return/payout service tests. Full endpoint matrix pending. |
| AUTH-05 | Buyer/seller cannot directly call admin APIs | PREVIOUS / ASSERTIONS: edge E2E admin page denial; `server/modules/admin/admin.routes.test.ts`, `server/modules/auth/auth-plugin.test.ts` API role protection. |
| AUTH-06 | Suspended users/shops lose required access | ASSERTIONS: auth-plugin and `server/modules/security/seller-readiness.test.ts`; live session before/after suspension pending. |
| AUTH-07 | Rate limits and password guessing protection | EXECUTED / PENDING: local production repeated failed-login probe reached429 with limiter enabled. Security unit bucket tests exist; distributed limiter concurrency and sustained guessing/account recovery still pending. |

Email verification exists but `server/modules/auth/auth.ts` sets `requireEmailVerification: false`; mandatory verification at signup is not the present policy. Social/SMS flows, if enabled for launch, also require actual provider acceptance.

## 2. Catalog and storefront

| ID | Required test | Status and evidence / remaining scope |
| --- | --- | --- |
| CAT-01 | Create/edit/publish/hide products, variants and SKU | ASSERTIONS: `server/modules/catalog/catalog.service.test.ts`; `e2e/seller-workflows.spec.ts` product lifecycle. Full browser suite execution tracked live. |
| CAT-02 | Upload/replace/delete images; reject invalid/oversized files | ASSERTIONS / BLOCKED: `server/modules/upload/upload.service.test.ts`, `upload.storage.test.ts` includes real local byte validation; product-studio E2E uploads. Configured production S3/CDN lifecycle pending. |
| CAT-03 | Search/filter/sort/pagination | ASSERTIONS: catalog service/repository tests and `e2e/storefront.spec.ts` URL filters, load-more and deduplication. |
| CAT-04 | Sold-out/deleted products and closed shops cannot be bought | PREVIOUS / ASSERTIONS / PENDING: edge E2E sold-out checkout; catalog tests inactive products, storefront inactive shop404. Live cart-to-checkout shop closure/deletion matrix pending. |
| CAT-05 | Updated price/stock/status visible after cache invalidation | EXECUTED / PENDING: focused catalog/cache suite **67 tests passed**, including `server/modules/catalog/catalog-cache.integration.test.ts` real PostgreSQL/Redis warmed slug+UUID invalidation and visibility regression. This is **not67 infrastructure scenarios**. `e2e/catalog-checkout-guards.spec.ts` price-cache acceptance exposed a real stale-slug defect; final140-case browser rerun after fix passed. No manual cache flush counts as acceptance. |

## 3. Cart and checkout

| ID | Required test | Status and evidence / remaining scope |
| --- | --- | --- |
| CHK-01 | Add/update/remove quantities, variants and multiple shops | PREVIOUS / ASSERTIONS: buyer-lifecycle UI purchase, `server/modules/cart/cart.service.test.ts`, checkout tests and real multi-shop integration. |
| CHK-02 | Multiple tabs/devices create no duplicate carts/items | PREVIOUS / PENDING: `server/modules/cart/cart-concurrency.integration.test.ts` real first-cart race; browser cross-device item mutation races pending. |
| CHK-03 | Price/stock changes after checkout opens | PREVIOUS: edge E2E disappearing stock and reload-to-requote price. PENDING: explicit stale-quote submit behavior without reload. |
| CHK-04 | Expired/exhausted/minimum-spend coupons and concurrent usage | ASSERTIONS / PENDING: `server/modules/promotion/promotion.service.test.ts`, checkout tests; concurrent final coupon allowance needs dedicated evidence. |
| CHK-05 | Coins, discounts, shipping and rounding | PREVIOUS / ASSERTIONS: commerce/finance E2E, `server/modules/promotion/buyer-coin.transitions.test.ts`, checkout and refund-amount tests. |
| CHK-06 | Address and product snapshots | ASSERTIONS / PREVIOUS / PENDING: checkout repository and commerce integration cover snapshot creation. Catalog-guard E2E verifies snapshots after live address/product/variant edits on all5 commerce browser profiles; final140-case run passed. |
| CHK-07 | Double submit/refresh/back/network loss creates no duplicates | EXECUTED / DEFECT FIXED: prior Chromium double-click created2orders/2payments/reserved4. New `server/modules/checkout/checkout-concurrency.integration.test.ts` actual PostgreSQL3cases cover same-selection duplicate protection, independent selected-item checkouts, and concurrent cart edits; focused backend suite41passed including unit cases. Synchronous UI guard focused suite11passed. Final140-case production browser run passed, including double-click/lost-response/retry/history on5 commerce browser profiles. This is duplicate prevention, not an API contract to replay a lost response. |
| CHK-08 | Failed transaction leaves no order/reservation | PREVIOUS / ASSERTIONS: commerce integration, checkout repository tests and stock-error E2E. |

## 4. Payment

| ID | Required test | Status and evidence / remaining scope |
| --- | --- | --- |
| PAY-01 | Success/failure/cancel/expiry | PREVIOUS / BLOCKED: local signed webhook and buyer cancellation E2E; actual payment sandbox missing. |
| PAY-02 | Browser closes before callback | PENDING / BLOCKED: server settlement exists; explicit browser-close/provider-callback run missing. |
| PAY-03 | Bad signature/amount/currency/references | ASSERTIONS / PREVIOUS / PENDING: `payment.webhook-signature.test.ts`, `payment.test.ts`, `payment.routes.test.ts`; real PG amount mismatch. Currency contract and provider payload validation need provider-specific confirmation. |
| PAY-04 | Duplicate/delayed/reordered/concurrent webhook | PREVIOUS / ASSERTIONS: commerce concurrency tests and payment tests. Provider-specific reordered event matrix still BLOCKED. |
| PAY-05 | Provider timeout and retry cannot double-charge | BLOCKED: actual checkout provider unavailable; local order state cannot prove no external double charge. |
| PAY-06 | Late success after expiry reconciles/refunds money | PREVIOUS for stock preservation only: commerce concurrency late-success case. GAP / BLOCKED for automatic external refund/reconciliation. |
| PAY-07 | Crash after provider success recovers status | PENDING / BLOCKED: process crash + replay/reconciliation sandbox required. |
| PAY-08 | Reconcile order records with provider transactions | BLOCKED: provider credentials/report source and reconciliation process required. |

## 5. Inventory and fulfillment

| ID | Required test | Status and evidence / remaining scope |
| --- | --- | --- |
| INV-01 | Concurrent buyers cannot oversell final stock | PREVIOUS: commerce concurrency integration, actual PostgreSQL reservations. |
| INV-02 | Seller stock adjustment during reservation | PREVIOUS: same integration rejects stock below reservations and other-shop updates. |
| INV-03 | Failure/expiry/cancel releases stock exactly once | PREVIOUS: edge E2E, commerce integration and queue expiry integration. |
| INV-04 | Shops pack/ship independently; aggregate status correct | PREVIOUS: edge two-seller E2E and `server/modules/shipment/shipment.service.test.ts`. |
| INV-05 | Concurrent ship/deliver never regress state | PREVIOUS: `server/modules/shipment/shipment-concurrency.integration.test.ts` actual sibling races. |
| INV-06 | Buyer tracking matches seller submission | PREVIOUS: buyer-lifecycle and edge E2E. |
| INV-07 | Actual carrier integration/callback, if used | GAP / BLOCKED: inspected shipment service accepts manual carrier/tracking strings; no carrier connector established. Explicit launch exclusion or integration required. |
| INV-08 | Reject invalid transitions and other-shop shipments | ASSERTIONS: shipment service tests, security ownership tests; broader real HTTP denial matrix pending. |

## 6. Returns, refunds and seller finance

| ID | Required test | Status and evidence / remaining scope |
| --- | --- | --- |
| FIN-01 | Whole order, selected lines and partial quantity return | PREVIOUS for one full line in a multi-line order: finance E2E. GAP: return input has one orderItemId and no quantity; always returns full line quantity. Whole-order batch action not this endpoint. |
| FIN-02 | Approve/reject and enforce allowed return window | ASSERTIONS for approve/reject: `server/modules/return/return.service.test.ts`. GAP: no return-date/window check in createReturn. |
| FIN-03 | Correct net refund after coupon/coins/shipping policy | PREVIOUS / ASSERTIONS: finance E2E verifies discounted line excluding shipping; `server/modules/refund/refund-amount.service.test.ts`, coin transition tests. |
| FIN-04 | Cumulative refunds never exceed paid amount | ASSERTIONS / PREVIOUS: refund service/amount and commerce integration; enumerate repeated separate refund requests as well as duplicate completion. |
| FIN-05 | Sandbox refund success/failure/timeout/duplicate callback | BLOCKED: external refund provider unavailable. |
| FIN-06 | Wallet/ledger match sale/refund/withdrawal | PREVIOUS: commerce and finance E2E assert ledger debits/balance; provider reconciliation remains separate. |
| FIN-07 | Overdraw/concurrent/duplicate withdrawal | PREVIOUS: actual PG concurrent withdrawal and finance E2E rejection. |
| FIN-08 | Two-admin approval; prevent self-completion | PREVIOUS / ASSERTIONS: finance E2E, `server/modules/payout/payout.service.test.ts`, admin tests. |
| FIN-09 | Transfer failure releases reserved money correctly | ASSERTIONS for rejected payout release; BLOCKED for real transfer failure and callbacks. Rejection is not evidence of provider failure recovery. |
| FIN-10 | Reconcile external transfers | BLOCKED: dummy/manual transfer references in E2E prove internal rules only. |

## 7. Jobs and notifications

| ID | Required test | Status and evidence / remaining scope |
| --- | --- | --- |
| JOB-01 | Expiry runs with no browser open | EXECUTED: real production `jobs:worker` CLI canceled expired order/shop/payment and released stock without browser. Existing queue-expiry integration also exercised actual factories. |
| JOB-02 | Worker restarts mid-job without duplicate financial effects | EXECUTED / PENDING: CLI restart after completed expiry processed zero and preserved stock; completed2/failed0. Mid-job crash and financial duplicate side effects remain unverified. SIGINT handler entered but Windows wrapper exit1; this does not prove successful graceful drain. |
| JOB-03 | Retry/backoff/exhausted jobs observable | EXECUTED locally: [worker resilience evidence](test-evidence/2026-09-08/worker-resilience.md) real producer/workers3attempts, exponential backoff ~5s/~10s; transient third-attempt success, permanent failure retained with JOB_RETRY_EXHAUSTED. Local injected transport only; deployed alert delivery still BLOCKED. |
| JOB-04 | Redis outage/reconnect loses no work | EXECUTED / PENDING: worker drill21jobs persisted/processed across orderly SHUTDOWN SAVE and AOF restart;20acknowledged queued jobs survived and1enqueue waited offline then resolved (~1381ms). Abrupt crash/power loss, partitions/failover and production persistence configuration remain unverified. |
| JOB-05 | Multiple workers avoid duplicate transactions | EXECUTED / PENDING: two actual competing workers completed21distinct notification jobs (14+7),21unique PostgreSQL rows, no duplicates. This does not prove exactly-once financial effects on crashes, duplicate enqueue, lock loss or stalled replay. |
| JOB-06 | Email/notifications correct recipient, no duplicates, retry | ASSERTIONS: notification tests check recipient and ownership; email uses mocked fetch, push uses mocked webpush. BLOCKED actual delivery. GAP: transient push errors logged/swallowed without persistent retry. Event-bus dedup is memory-only and restart durability unproven. |

Prior factory integration used Redis5.0.14.1 with an explicit compatibility override. The later CLI worker drill used version checks enabled but the same Redis5.0.14.1, below BullMQ recommended6.2. Neither proves deployed Redis7 operation; CI targets Redis7 and execution remains separate.

## 8. UI and usability

| ID | Required test | Status and evidence / remaining scope |
| --- | --- | --- |
| UI-01 | Buyer/seller Chrome/Firefox/Safari/mobile | EXECUTED / PENDING: original development matrix52/52 passed, including Chromium and seller-route Firefox/WebKit/mobile smoke. New production buyer/auth/finance contexts now inherit actual project emulation; final expanded140-case matrix passed. WebKit is not physical iOS acceptance. |
| UI-02 | Small screens, keyboard and accessibility | ASSERTIONS: product-studio semantics/dialog/live-region, storefront mobile viewport. PENDING keyboard purchase/finance, automated a11y scan and manual assistive-technology checks. |
| UI-03 | Loading/empty/error/retry states | ASSERTIONS: seller workflow API retry, buyer/checkout/seller component tests. Full route/state inventory pending. |
| UI-04 | Slow/offline network during submit | EXECUTED / PENDING: real checkout commit followed by dropped response, retry and order-history recovery passed on5 commerce browser profiles. Other mutation/network-failure combinations remain separate coverage. |
| UI-05 | Language/money/date/timezone | ASSERTIONS: EN/TH storefront/seller routes and translation audit; cross-timezone boundary/currency display matrix pending. |
| UI-06 | Refresh/deep links on protected pages | PREVIOUS session/login return; ASSERTIONS seller routes. Full protected deep-link/refresh matrix pending. |

## 9. Security

| ID | Required test | Status and evidence / remaining scope |
| --- | --- | --- |
| SEC-01 | Input/XSS/injection/uploads | ASSERTIONS / PENDING: upload validation and actual local bytes covered. New catalog guard tests seed legacy script/SVG product text and assert literal text, no executable nodes and unchanged window marker; final140-case browser run passed. Seller PATCH400 was publish-readiness rejection (fixture lacked media), not proof of HTML filtering. HTTP injection probes and production storage checks remain. |
| SEC-02 | CSRF/CORS/cookies/security headers | EXECUTED / PENDING: local production hostile auth origin403; hostile preflight404 with no access-control-allow-origin. Targeted probes do not constitute full CSRF/CORS audit. Local WebKit required matching build/runtime HTTP exception; production HTTPS default retained. Deployed TLS/cookies/proxy remains BLOCKED. |
| SEC-03 | API exposes no credentials/tokens/excess PII | ASSERTIONS / PREVIOUS: safe errors, public assets, real storefront redaction. PENDING systematic authenticated API response review. |
| SEC-04 | No secrets in browser bundle/log/error | EXECUTED / PENDING: production browser JS scan checked75 files against2 configured secret values, no matches; exact-value scan only. Redaction unit assertions exist. Complete secret-pattern/deployed logs scan remains pending. |
| SEC-05 | Sensitive endpoint limits and dependency audit | EXECUTED / PENDING: `bun audit --prod --audit-level=high` found no reported vulnerabilities at run time; real failed-login429 probe. Full endpoint/distributed limiter coverage pending. |
| SEC-06 | Audit roles/order transitions/financial actions | ASSERTIONS: audit service stores/redacts snapshots. PENDING end-to-end completeness for every required action; formatter tests alone insufficient. |

## 10. Performance and resilience

| ID | Required test | Status and evidence / remaining scope |
| --- | --- | --- |
| PERF-01 | Expected users/order volume load | EXECUTED: latest requested 100-user/1-minute workload completed 5,937 requests and 300/300 checkout submissions after catalog performance fixes. PostgreSQL confirms 300 orders/payments and 300 reserved units. Local scope; staging capacity and soak remain unproven. |
| PERF-02 | Latency/error/throughput thresholds | EXECUTED: latest workload zero errors, overall p95 339.33ms; checkout-create p95 49.98ms and every endpoint below 1,000ms. Direct local API workload only; setup/login, Next browser traffic, workers and external providers excluded. See the linked acceptance report. |
| PERF-03 | Slow queries/N+1/indexes/pool | PENDING: realistic volume query instrumentation/explain/pool saturation; repository unit mocks do not establish performance. |
| PERF-04 | Peak traffic/soak/memory leak | EXECUTED / PENDING:30-minute workload completed; does not independently establish absence of memory leaks, peak saturation or longer daily-job behavior. Resource trend/peak assessment and final-code rerun pending. |
| PERF-05 | DB/Redis/provider temporary outage recovery | EXECUTED / PENDING: bounded real Redis orderly shutdown/AOF restart reconnect and job persistence passed; mocked readiness/cache tests also exist. Abrupt Redis failure, DB outage and provider outage remain unverified; see worker evidence. |

## 11. Deployment and recovery

| ID | Required test | Status and evidence / remaining scope |
| --- | --- | --- |
| OPS-01 | Production build and production-mode runtime | EXECUTED / PENDING: production build and production-mode local API/browser startup verified during this task. Final source passed production build, standalone typecheck,1,067 unit/integration tests and140 production browser cases; live ledger records exact scope. |
| OPS-02 | Migrations against populated old schema | PENDING: empty test DB migration differs from upgrading a populated prior release. |
| OPS-03 | Env validation/HTTPS/reverse proxy | ASSERTIONS: `server/config/production-env.test.ts`; BLOCKED actual staging TLS/proxy acceptance. |
| OPS-04 | Health/readiness/graceful shutdown | EXECUTED / PENDING: ready200; controlled in-flight worker.close() stayed pending while transport held200ms, then drained/completed after release. Earlier CLI SIGINT handler entered but wrapper exit1. Factory drain does not verify deployed process-manager SIGTERM/API shutdown; those remain pending. |
| OPS-05 | Deploy new release and rollback | BLOCKED: no confirmed staging/deployment target; local build is not rollback evidence. |
| OPS-06 | Backup/restore and verify actual data | EXECUTED / BLOCKED: shipped backup/restore scripts restored101 tables/1,064 rows with identical sorted row-JSON checksums and18/18 migrations. Backup0.690s/487,280bytes; restore1.686s. Missing confirmation/separate restore URL rejected. Small local fixture proves mechanics only; production RPO15min/RTO60min needs backup cadence/PITR and timed deployed recovery. |
| OPS-07 | Logs/metrics/alerts actually notify | ASSERTIONS: observability request IDs/metrics/redaction; BLOCKED deployed collection and actual alert receiver test. |
| OPS-08 | Staging buyer → payment → seller → tracking smoke | BLOCKED: no verified staging target/provider supplied. Local signed-webhook smoke recorded separately. |

## Highest-priority remaining local verification

1. Requested 100-user/300-checkout/1-minute local load passed. Complete external staging and provider gates below; the short run does not establish soak capacity.
2. Test abrupt mid-financial-job/DB/Redis failure and replay consistency. Current worker evidence covers orderly AOF restart, retry/backoff, distinct notification jobs and controlled factory drain.
3. Close remaining endpoint, coupon-race, accessibility and production-scale query/pool coverage described in the rows above. External staging/provider gates remain separate.

## Release decision

No blanket green state from test totals. Resolve critical/high defects; attach execution evidence to applicable money, ownership, inventory, deployment and recovery items. Mark disabled integrations explicitly out of launch scope rather than passed. Feature gaps require a product decision or implementation before their requested behavior can be accepted. Current changing results belong in the linked live ledger.


