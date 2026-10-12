# Full Admin verification — 13 October 2026

Implemented scope and runtime setup: [Full Admin](full-admin.md).

All verification used newly created disposable local PostgreSQL 17 databases and
Redis 7.2.14. Primary database data and external delivery were not used. Browser
testing disabled email, phone OTP, push delivery and live payments. Helper servers
were stopped and browser-created fixtures were removed after acceptance.

| Check | Result |
| --- | --- |
| Full Vitest run with all mandatory integration opt-ins | 2,362 passed; 0 failed/skipped/todo |
| Production integration report gate | PASS; all 45 source integration files executed |
| New PostgreSQL boundary regressions | 38 passed |
| Final admin HTTP policy checks | 7 passed, including two added 403/409 owner-policy cases |
| TypeScript `tsc --noEmit --incremental false` | Passed |
| Optimized Next.js production build | Passed |
| Prisma validate and isolated database/schema comparison | Passed; no difference |
| Migration replay | All 26 migrations applied, including the two Full Admin migrations |
| Thai/English audit | 2,891 keys per language; key/placeholder parity passed |
| Production dependency audit | Passed at high severity |
| Authenticated admin API read checks | 19 passed |
| Thai/English new-page browser sweep | 34 pages; no console/HTTP errors or raw translation keys |
| Browser API/auth and actual rendered workflows | 13 passed |
| Scheduled localized popup/session checks | 4 passed |
| Final light/dark bilingual visual checks | 12 passed |

Boundary tests cover owner changes and races, revoked refund/payout/config rights,
private support evidence, exact compensation plans and failed-plan recovery,
stale catalog approvals and atomic child revisions, frozen shop shipping/SLA and
commission, targeted coupon allocation, authoritative review scope resolution
and promotion disabling before writes. A reports-only administrator receives no
export controls or unauthorized export requests; another requester's private
export download is denied.

An earlier four-worker run overlapped compilation and timed out in two existing
UI tests. Both files passed a focused rerun (83 tests). The complete final run
used two workers and passed every test without skips. Timing was not hidden by
increasing individual test timeouts.

Ignored local evidence remains under `.audit/full-admin-runtime/`: `quality.json`,
build/typecheck/schema/i18n logs, `browser-summary.json`, workflow evidence and
screenshots. The three implementation worktrees contain recoverable worker
commits; integrated changes are in the primary checkout.

Before activating this version against the intended application database, run
`bun run db:migrate:deploy`. Bootstrap an owner through `ADMIN_EMAILS` and
`bun run db:seed-admin` if there are no existing administrators. Recurring reports
and payout preparation need `bun run jobs:worker` with Redis configured. Real
SMS/LINE, carrier labels/pickups and payment transfer adapters remain conditional
on configured providers; management and evidenced manual workflows do not claim
their external success. Purchase documents are printable HTML, commerce uses THB,
and reported operating contribution excludes unrecorded costs.
