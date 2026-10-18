# Commerce optimization loop

Completed the four planned follow-up units and then reinspected their request,
database and payload paths. Further passes reduced related-card overfetch, fixed
UUID casing in tracking, narrowed cart hydration, batched promotion admission and
removed duplicate coupon reads. The preceding four-unit implementation remains
documented in [verification.md](verification.md).
The last pass removed category/brand fallback loads when displayed listing
facets already provide their options.

## Measured results

| Workload | Before | After |
| --- | ---: | ---: |
| 40 visible product impressions | 40 HTTP requests | 1 HTTP request |
| Persisting those 40 impressions | 40 SELECTs + 40 INSERTs | 1 SELECT + 1 INSERT |
| Product detail and rating boot | 2 HTTP requests | 1 HTTP request |
| English public listing JSON, 12 products | 529,473–529,477 bytes | 113,153–113,157 bytes |
| Thai public listing JSON, 12 products | 572,265–572,269 bytes | 118,361–118,365 bytes |
| English public translation props | 245,601 bytes | 42,417 bytes |
| Thai public translation props | 362,224 bytes | 79,888 bytes |
| Internal cart hydration, 12 lines | 92,793 bytes | 21,463 bytes |
| Promotion admission, 11 Flash Sale candidates in one shop | 11 configuration reads | 1 configuration read |
| Coupon estimate | 2 coupon reads | 1 coupon read |
| Coupon commitment | 4 coupon reads | 2 coupon reads |
| Seeded listing with both facet lists, component query functions | 2 fallback invocations | 0 fallback invocations |

These are uncompressed UTF-8 JSON bytes and observed request/query counts on
owned fixtures. Cart bytes describe the internal hydrated Prisma result, not
HTTP or database wire traffic. Listing JSON retains the existing `data` and
`items` response aliases. Returned gallery objects fell from 96 to 12; the
database still reads all ordered URLs before selecting a valid public image.
Tracking also emits one COMMIT query event. No latency, p95, throughput or LCP
improvement was measured.

Five alternating before/after repetitions checked normalized card and quick-add
inputs, both locales, facets, metadata and exact amounts beyond JavaScript's safe
integer range. Product boot additionally covered UUID/slug identity and hidden
products. Tracking preserved all 40 events and metadata, rejected invalid batches
without writes and charged rate limits per event. Mixed-case UUIDs have regression
coverage. Promotion comparisons preserved complete quotes and fingerprints,
including actual post-lock coupon invalidation and rollback, shop/user denials,
user overrides and maintenance precedence. Cart and buy-again passed 14 real
PostgreSQL integration cases.

## Verification

All follow-up units passed independent review. The final aggregate default suite
passed 2,527 tests in 258 files, with 422 tests skipped across 56 files. The final listing
component/query/server-loader suites passed 127 tests, including ten added
fallback regressions. Five new cases failed on the preceding implementation.
Both the builder and independent reviewer ran the final suite. It covers
populated/partial/missing facets, pending/error/retry, pagination metadata and
cached fallback data across filter navigation. These query counts are component
observations using real TanStack Query, not a live-browser wire benchmark.

The final production build exited 0, including TypeScript and all 163 generated
pages. The build used `.next-optimization-loop-build`; only its two temporary
tsconfig include additions were removed afterward. Standalone typecheck also
exited 0 against the final saved sources after that cleanup. `git diff --check`
passed. Final logs are `.audit/optimization-loop/final-all-tests.log`,
`final-all-typecheck.log` and `final-build.log` in that directory.

The durable baseline and runtime methodology are summarized above. Rerunnable
scripts, raw JSON comparisons and logs are retained in
`.audit/optimization-loop/`, including its `report.md`. Audit-owned API and
PostgreSQL processes were stopped and their ports verified free. No data or logs
were deleted.

## Decisions and limits

The final reinspection found unused category/brand fallback requests on listings
whose facets already supply those options. Task 14 addresses each query
independently while preserving empty/error recovery. After this change, the
independent reviewer found no further safe, concrete duplicate work in the
inspected boundaries and recommended ending this run after final verification.

Further local reductions did not establish equivalent behavior. Shrinking the
recently-viewed log sample can remove distinct history cards. Taking only the
first image in SQL can hide a valid later public image. Restricting sold-count
metrics to card variants can omit sales of inactive variants. Removing response
aliases requires caller migration. Reusing cart, coupon or Flash Sale candidates
across locks would remove required freshness. Product boot still composes the
existing Catalog and Review readers; it does not claim removal of all internal
rating work. Deeper changes need profiling or an explicit contract migration.

Prove It Works shaped real PostgreSQL/API and observable UI assertions. Explain
the Number shaped the saved-baseline comparisons and the distinction between
internal objects, response bytes and database reads. Sequence Work into
Verifiable Units shaped the bounded implementation and independent reviews.

Automatic approval review previously rejected starting Next dev with
`blocked by policy`. No bypass was attempted. Live browser hydration/navigation
and actual RSC metadata/page deduplication remain unverified. Component rendering,
typed loaders, actual API/database checks and production compilation provide
separate evidence without claiming those browser checks passed.
