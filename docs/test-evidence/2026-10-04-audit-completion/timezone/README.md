# Bangkok calendar reporting

Owner decision: daily sales and analytics use Asia/Bangkok. This change owns date boundaries, date labels, custom range validation and safe pagination offsets. Monetary types and arithmetic remain the money worker's scope.

## Plan and boundaries

Use one shared calendar helper with an explicit IANA timezone. Derive calendar dates independently of the host timezone, translate local midnight to UTC for repository filtering, and use inclusive day/month intervals. Parse real YYYY-MM-DD dates rather than accepting timestamp strings or JavaScript's invalid-date rollover. Cap custom ranges at 366 calendar days and reject unsafe page offsets. Custom input spans 0001-01-02 through 9999-12-30 so both adjacent midnights remain representable in four-digit calendar years.

Alternatives considered: duplicating UTC+7 arithmetic in each service risks drift; depending on process TZ makes correctness deployment-dependent. The shared helper uses Intl's Asia/Bangkok calendar and keeps repositories responsible for database queries. No table/model changes.

Risk: previously accepted UTC/custom timestamp semantics intentionally change. Existing calendar-date UI calls retain their shape. A requested custom range over 366 days now returns ANALYTICS_DATE_RANGE_INVALID. A mathematically unsafe offset returns ANALYTICS_PAGINATION_INVALID. Daily and monthly totals exclude rows outside their complete calendar interval; lifetime totals retain all eligible rows. Cache TTL behavior is unchanged and browser cache rollover is not tested here.

## Independent expected values

Persisted paid orders carry distinct literal amounts 1, 2, 4, 8 and 16 at UTC instants:

| UTC instant | Bangkok date | Amount |
|---|---|---:|
| 2026-09-30T16:59:59.999Z | 2026-09-30 | 1 |
| 2026-09-30T17:00:00.000Z | 2026-10-01 | 2 |
| 2026-10-01T16:59:59.999Z | 2026-10-01 | 4 |
| 2026-10-01T17:00:00.000Z | 2026-10-02 | 8 |
| 2026-10-31T17:00:00.000Z | 2026-11-01 | 16 |

The tests hardcode daily totals 1/6/8 and, at Oct 1, today 6/month 14/lifetime 31. Views and add-to-cart counts are 1/2/1; add-to-cart quantity 3 deliberately demonstrates event counts rather than quantity totals. The DB aggregate independently verifies 5 rows and 31 minor units. The same repository/service assertions run with process TZ UTC, America/New_York and Asia/Bangkok. A 7-day preset at exactly Sep 30 17:00Z must label Sep 25 through Oct 1.

## Evidence and limits

Baseline: `before.log`, 9 failed / 5 passed on actual migrated PostgreSQL port 55439. Failures reproduced UTC labels, host timezone totals, invalid date rollover, long ranges and unsafe offsets. After fix: `after.log`, 38 passed / 0 failed across three focused files, including 16 actual PostgreSQL cases. Standalone typecheck: `typecheck.log`, exit 0.

These are direct production service + Prisma repository integration tests, not browser or HTTP tests. UI/API presentation and full root integration remain the parent's separate gates. All fixtures use unique local test identities and marketplace_test_completion; no production data or schema changes. No full-suite claim.
