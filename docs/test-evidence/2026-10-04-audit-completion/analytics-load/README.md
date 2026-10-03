# Bounded analytics process load

Status: functional ranking/pagination checks passed; latency and memory measured; production SLO acceptance not tested because no analytics latency/heap budget has been agreed.

## Plan and measured target

Run production ProductAnalyticsService.getProducts/getSkus and PrismaProductAnalyticsRepository in one dedicated Bun process against migrated local PostgreSQL port 55439. Seed independent active shops with exactly 501, 5,000 and 20,000 products, one variant/paid line/view/add-to-cart event each. Read the first and final pages, then issue three waves at concurrency 1/5/20. This directly measures analytics code rather than unrelated catalog endpoints.

The application source is date commit fe44bb1d4b8ae6f97fa7e29e10d175f20596fc91 plus this harness. W1 ba7 is its existing ancestor. Monetary code is the pre-integration version; the parent must rerun after merging money changes for an integrated performance claim.

Fixture monetary amounts are distinct ordinals from 1 through the dataset size. Independent literal first-three expectations are 501/500/499, 5000/4999/4998, and 20000/19999/19998. The final 501-product page contains amount 1; other final pages contain 10 through 1. Assert product identities, product/SKU final-page order, exact candidate totals, 10-row page size and one sold unit per row. Every dataset owns a distinct shop and persists alongside earlier fixtures, so exact totals also check cross-shop exclusion.

Safety limits: explicit local marketplace_test_* URL/port and opt-in, dataset allowlist 501/5000/20000, max concurrency 20, 15-minute sampled runtime bound and 2 GiB sampled heap bound. Setup uses 500-row transactions with 30-second transaction timeouts. `guard-local.log` and `guard-size.log` demonstrate rejected opt-in and size 20001, both exit 1 before creating the Prisma client or fixtures.

## Results

Run exit 0, fatal null, 234 measured requests / 0 errors across nine phases. Additional first/final-page checks passed outside measured phases. Total runtime 35.66 seconds, Bun 1.3.14 on Windows, process PID 33772, 12 logical CPUs, PostgreSQL pool max 10. `run.log` is original event output; `report.json` contains exact byte/timing/sample/query counts and fixture identities. `typecheck.log` records standalone exit 0.

| Products | Concurrency | Requests | Sample p95 ms | Peak heap MiB | Peak RSS MiB | SQL queries |
|---:|---:|---:|---:|---:|---:|---:|
| 501 | 1 | 3 | 25.87 | 96.3 | 301.9 | 28 |
| 501 | 5 | 15 | 94.97 | 129.1 | 317.9 | 136 |
| 501 | 20 | 60 | 144.05 | 183.8 | 383.1 | 540 |
| 5,000 | 1 | 3 | 101.38 | 338.6 | 616.9 | 55 |
| 5,000 | 5 | 15 | 268.53 | 384.5 | 711.9 | 271 |
| 5,000 | 20 | 60 | 956.53 | 595.9 | 903.2 | 1,080 |
| 20,000 | 1 | 3 | 232.82 | 376.6 | 752.6 | 145 |
| 20,000 | 5 | 15 | 950.20 | 619.0 | 906.6 | 721 |
| 20,000 | 20 | 60 | 3,797.86 | 1,808.7 | 2,336.2 | 2,880 |

At 20,000/concurrency20, exact heap peak is 1,896,594,765 bytes and RSS peak is 2,449,649,664 bytes. Candidate cursor batching bounds each SQL result, but the service accumulates candidates/raw metric lines and globally sorts them before paging. Thus a 10-row response still requires O(N) materialization per request. This remains a concrete scalability risk. A future change should move globally ordered aggregates and pagination into the database while preserving all current paid/canceled-shop filters, deterministic ties and exact monetary comparison. This evidence does not silently redefine a performance budget or claim that this resource profile is production-ready.

## Reproduce and limits

PowerShell from the isolated worktree or final merged root:

```powershell
$env:COMMERCE_TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:55439/marketplace_test_completion'
$env:ANALYTICS_LOAD_ALLOW_LOCAL='true'
$env:ANALYTICS_LOAD_SIZES='501,5000,20000'
$env:ANALYTICS_LOAD_REPORT='test-results/analytics-load.json'
bun run scripts/analytics-load-test.ts
```

Heap/RSS comes from process.memoryUsage in the process executing production analytics, sampled every 20ms and at request boundaries. It includes fixture bookkeeping, allocator history and garbage collection; no forced GC and no subtraction disguises resident process costs. Short allocation peaks can be missed. First requests and repeated requests are reported; analytics has no application cache, so this is not a Redis cold/warm claim. Sample p95 for three requests is the maximum and is not a stable production percentile estimate.

Not tested here: HTTP serialization/network/auth/rate limits, browser rendering, summary/daily endpoint load, multiple concurrent analytics processes, sustained production duration or remote/cloud database latency. Date correctness has separate PostgreSQL timezone evidence. Unique local fixtures are retained for root-owned environment cleanup. No production data or schemas changed and no full-suite claim.
