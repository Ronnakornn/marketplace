# Final numeric audit evidence

The final verdict is local verification on 4 October 2026, using PostgreSQL 17,
Redis 7.2.14 and five Playwright profiles: desktop Chromium, Firefox, WebKit,
Pixel 7 Chromium and iPhone 13 WebKit. These are browser profiles, not physical
device or external provider certifications.

| Evidence | Executed result |
| --- | --- |
| `full-tests-delivery.json` / `.log` | 1,745 passing tests, no failures or skips |
| `verification-summary.json` | 130 unique latest browser configurations passed |
| `browser-numeric-cross-profiles.json` | 90 pass, five shipping failures before final fix |
| `browser-shipping-verified.json` | Those five shipping configurations passed on rerun |
| `browser-production.json` | 30 finance configurations passed |
| `browser-production-final.json` | Ten passed: five repeated refund configurations and five new homepage freshness configurations |
| `snapshot-invariants-final.json` | Twelve invariant checks, zero violations; 369 orders, 369 payments, 471 items, 396 shop orders |
| `production-build-final.log` | Production build exit 0 |
| `delivery-typecheck.log` | Typecheck exit 0; empty log means no diagnostics |
| `delivery-i18n.log` | Exit 0; 2,288 English/Thai keys each and placeholder parity |
| `analytics-load/integrated-report.json` | 234 requests, zero errors, measured latency/memory limits |
| `cleanup.json` / `.log` | Task PostgreSQL/Redis stopped, three task Next caches removed, three worktrees archived recoverably |

The summary keys each browser result by file, case title and project, replacing
an earlier run only with that same configuration's later result. Numeric coverage
is 19 cases × five profiles = 95; production coverage is seven cases × five = 35.
Raw failures remain in their original reports and error contexts. Repeated runs
are not counted as additional coverage.

The full suite ran `bun run test` with actual commerce PostgreSQL gates, the
separate tax database, `CACHE_TEST_REDIS_URL` database 14 and
`QUEUE_TEST_REDIS_URL` database 13. Global `REDIS_URL` was omitted for security unit
tests whose mocked Redis counter always returned one. The integration URLs stayed
enabled; production browser rate limits stayed enabled. This corrects a harness
configuration error without changing production rate-limit behavior.

Development browser cases use signed mock payment webhooks. Production finance
cases use the existing guarded manual operations with distinct administrators
and synthetic references; the payment provider remains disabled. They perform no
real provider/bank transaction. The v2 settlement rollout flag is enabled only in
the disposable verification environment. No production migration, historical
financial repair or feature activation was performed.

Task-scoped `.gitignore` rules retain text/JSON logs, attached PNG screenshots and
automatic failure screenshots in Git. Duplicate original screenshot copies,
trace ZIPs, videos and temporary Playwright artifact folders remain local and are
ignored. The recorded report attachment paths point to retained attachment copies.
Older committed evidence remains unchanged. PostgreSQL data and local browser
traces/videos were preserved during cleanup; user servers and other Next caches
were untouched.

Raw tool logs and generated failure contexts retain formatter whitespace. The
source/document whitespace check excludes this raw evidence directory. The final
[artifact check](delivery-artifact-check.json) also verifies local report links
and all 150 PNG attachment references in the selected browser reports against
files retained in Git.

Business formulas, independent literal expected values, bug explanations and
remaining limitations are in [the completion report](../../numeric-audit-completion-report.md).
Real external reconciliation remains `NOT_VERIFIED` until authentic provider/bank
sandbox access and statements are available. Analytics ranking still scans all
candidates; the measured run establishes a local limit, not a production SLO.
