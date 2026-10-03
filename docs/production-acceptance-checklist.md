# Production acceptance checklist

## Latest load revision: 1,000 users / 1,000 checkout per minute / 1 minute

**PASS, 2026-09-08.** Final code: 61,684 requests, zero errors, overall p95 51.32ms and 1,000/1,000 checkout submissions.
Endpoint p95: catalog list 56.45ms; product detail 9.00ms; cart add 207.02ms; quote 67.51ms; checkout create 145.25ms. Measured workload plus drain: 61.03s.
PostgreSQL confirms 1,000 orders, 1,000 payments, quantityOnHand 2,100 and quantityReserved 1,000. The failed pre-fix run remains evidence of the original Prisma P2028/cache/logging contention.
Local Node 22 client and Bun API on the same machine, 1s actor think time, synthetic distinct IPs, no external payment completion.
[Final load report](test-evidence/2026-09-08/production-load-pass.json) · [Database proof](test-evidence/2026-09-08/production-load-pass-database.json) · [Pre-fix failure](test-evidence/2026-09-08/production-load-1000-users-1000-checkouts-1-minute.json)


Status: final verification in progress, 2026-09-08. **Production approval is not established.** Item-level scope and remaining work: [production test matrix](production-test-matrix.md).

## Accepted criteria

- Latest user revision (2026-09-08): **1,000 concurrent users for 1 measured minute**, 1,000 checkout submissions/minute, API p95 <1,000ms and errors <1%. Setup/logins and external-provider latency excluded. This is a short load check, not a soak. Record workload, dataset, hardware and environment. Local measurements do not establish staging capacity.
- RPO <= 15 minutes; RTO <= 60 minutes. Local restore verifies mechanics; production scheduling/PITR and deployment recovery must establish the targets.
- Fix confirmed defects and record absent features/external prerequisites. Skips, mocks, unexecuted CI and provider simulations are not production acceptance.

## Verified fixes

| Defect | Change and regression evidence |
| --- | --- |
| Password reset left sessions valid | Atomic OTP consumption, credential update and all-session revocation; service18 and actual PostgreSQL3 focused cases passed. |
| Product slug reached UUID-only subresource APIs | Resolve canonical product ID before reviews, rating, questions and favorites calls; focused product component suite40 passed. Browser asserts actual subresource HTTP success. |
| Slug cache survived UUID invalidation | Cache by resolved canonical product ID and check active product/shop visibility before reading cache; focused catalog suite67 passed, including a real PostgreSQL/Redis freshness regression. Adds an indexed lookup per detail read. |
| Immediate double-click submitted twice | Synchronous UI guard, reset after failed submission; focused UI11 passed. |
| Concurrent checkout created two orders/payments | Lock cart and current item rows before reading inside the transaction. Actual PostgreSQL same-selection race creates one order/payment; disjoint selections and subsequent cart reuse remain valid. Focused backend41 passed, including3 new concurrency cases. [Pre-fix proof](test-evidence/2026-09-08/checkout-race-before-fix.md). |
| Login accepted input before hydration and lost it | Disable editable controls until React is ready. Apply the same protection to signup, verify/reset/change password forms; SSR-to-hydration and existing auth tests12 passed. Only login had the original browser reproduction; other forms shared the exposed controlled-input pattern. |
| Mobile navigation covered fixed purchase/return/review actions | Hide the shared bottom navigation on pages with their own fixed action bar. BuyerShell11 tests passed; mobile WebKit refund/payout rerun3/3 including setup passed in37.0s. [Failure screenshot](test-evidence/2026-09-08/mobile-return-action-covered.png). |

| Cached product lists still repeated facet database queries | Cache facets under the existing product-list invalidation prefix; real PostgreSQL/Redis price-change regression passes. |
| Concurrent product metrics repeated identical queries | Share only the in-flight request; subsequent reads remain fresh. Coalescing and failure/retry regressions pass; focused catalog/cache suite 97/97. |
| Load caused Prisma P2028 and multi-second latency | Coalesce cold cache/visibility reads, avoid read-only transactions, move cache invalidation after commit, batch inventory invalidation, sample successful/slow access logs while retaining full metrics/errors, and remove a duplicate cart read from add-item. Final load passed. |

No schema changes were needed for these fixes. Cart, inventory, order and payment invariants remain inside database transactions. Lost-response recovery uses order history; retry does not guarantee replaying the first response.

## Final checks

| Check | Result |
| --- | --- |
| Full unit/integration with commerce, queue and cache opt-ins | **1,077/1,077 passed across 157 files**, 40.71s. Actual PostgreSQL17 and isolated Redis databases enabled. [Final summary](test-evidence/2026-09-08/unit-integration-final-summary.md). |
| TypeScript | `bunx tsc --noEmit --incremental false` passed after final backend changes. |
| Production frontend build | Passed after the final auth hydration and mobile action-bar changes. [Log](test-evidence/2026-09-08/production-build.log). |
| Translation audit |2,243 keys per locale and placeholder parity passed. |
| Production dependency audit | `bun audit --prod --audit-level=high` reported no vulnerabilities at execution time. |
| Full production Playwright | **140/140 passed before the subsequent catalog performance changes**,10.3minutes, exit0. Chromium, storefront Chromium, Firefox, WebKit, Pixel7 Chromium and iPhone13 WebKit emulation; production servers, real cache and rate limits, headless/one worker. [Case log](test-evidence/2026-09-08/production-browser-140.log). |
| Final load after fixes | **PASS: 1,000 users, 1,000 checkout/minute, 1 measured minute**. 61,684 requests, zero errors, 1,000/1,000 checkouts, overall p95 51.32ms and all endpoints below 1,000ms. [Report](test-evidence/2026-09-08/production-load-pass.json). Local Node client/Bun API; no provider completion or soak evidence. |
| CI configuration | Migrated separate commerce/queue databases, Redis7 and cache opt-ins configured; YAML validated. GitHub Actions itself was not executed. |

Focused counts overlap the full suite; do not add them together. Earlier original browser run52/52 used development servers. Failed intermediate production runs exposed the defects above and are not counted as passed.

Finance fixtures now open actor contexts only when needed, close finished actors,
and avoid creating an unused default page. Parallel multi-context WebKit runs on
Windows stalled; sequential close alone did not resolve it. The reduced-context
desktop run passed both finance cases, then exposed a separate mobile action-bar
overlap. After the UI fix, mobile finance completed without forced termination.
Final browser acceptance uses headless mode and one worker to reduce desktop
resource pressure; it does not certify physical Safari devices or headed stability.

## Infrastructure and security evidence

- Backup/restore using shipped scripts:101 tables /1,064 rows with matching sorted row-JSON checksums,18/18 migrations. Backup0.690s/487,280 bytes; restore1.686s. Missing confirmation or a separate restore URL rejected. Small disposable fixture, not production RPO/RTO proof.
- Actual production worker CLI expired an order, canceled shop/payment, released stock and published notification. Restart after completion processed zero. CLI SIGINT entered its handler, but Windows wrapper exit1 and OS-level in-flight draining were not established.
- [Worker resilience drill](test-evidence/2026-09-08/worker-resilience.md): actual retries/backoff/exhaustion, isolated Redis orderly restart/persistence/offline enqueue, two workers processing21 unique notifications, and factory close waiting for active work passed. Abrupt crash and exactly-once financial effects remain outside this evidence.
- Local production API probes: readiness200; anonymous admin/seller401; hostile auth origin403; hostile preflight404 without allow-origin; repeated failed login429. Targeted checks, not a complete endpoint/CSRF/CORS audit.
- Production browser bundle exact-value scan:75 JS files,2 configured secret values checked,0 matches. Not a comprehensive secret or deployed log audit.

## Load evidence

The [baseline before the catalog/checkout fixes](test-evidence/2026-09-07/production-load-full.json) passed:100 users,1,801.006 measured seconds,165,702 requests,300/300 pending checkouts,0 errors, overall p95 319.188ms. PostgreSQL independently confirmed300 pending orders/payments and300 reserved units. This is historical evidence; final-code measurement remains pending.

Environment: local production Elysia API directly, PostgreSQL17, Redis5.0.14.1, cache/rate limits enabled, synthetic distinct forwarded client IPs with trusted local proxy configuration. Windows i5-12450H,12 logical CPUs,25.37GB RAM. Baseline catalog127 products/141 variants/83 shops. No frontend, worker processing or external payment completion in the workload; setup/logins excluded. Run heavy checks sequentially during measurement. Redis passes the installed version check but is below the recommended6.2; CI's Redis7 and deployed topology require their own execution.

For local HTTP browser testing, build-time and runtime `ALLOW_INSECURE_HTTP` must match because Next compiles CSP headers. The source default still requires production HTTPS.

## Outstanding release gates

- No verified staging target, payment/refund/payout sandbox, email/SMS delivery, carrier connector or production storage target. No external money movement or messages were performed.
- Partial-unit returns and a return-window policy/enforcement are absent. Automatic external late-payment reconciliation/refund is not established.
- Persistent push retry/restart deduplication, mid-financial-job crash recovery, abrupt infrastructure failures and deployed process-manager behavior need further evidence.
- Complete endpoint ownership/audit coverage, keyboard/assistive-technology review, production-scale query/pool analysis, TLS/proxy/cookie checks and deployed logs/alerts remain listed in the matrix.
- Populated prior-release migration, deployment rollback, remote backups/PITR and timed production recovery must prove the accepted RPO15/RTO60 targets.

Each row in the matrix remains scoped. High automated test totals do not close feature gaps or external deployment gates.
