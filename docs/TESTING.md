# Testing Guide

This repository uses Vitest for unit, component, service, repository, and route
tests. Playwright covers critical browser journeys.

## Before Running Tests

```bash
bun install
bun run db:generate
```

E2E tests require PostgreSQL through `DATABASE_URL`. Use a disposable local or
test database: `bun run test:e2e` deploys the checked-in Prisma migrations and
seeds deterministic fixtures before Playwright, so it creates and changes data
in that database.

Frontend and API ports must be available:

- Next.js: `http://localhost:3000`
- Elysia API: `http://localhost:3001`

Playwright starts both services automatically. When local services already run,
it reuses them.

To keep Playwright isolated from an existing development session, assign test
ports and a disposable database. In development mode, Playwright uses a
separate Next.js build directory, loads `.env.local`, trusts the isolated browser origin for test
authentication, and disables rate limiting only for its development-mode API
process so server-side requests do not share one rate-limit bucket:

```powershell
$env:DATABASE_URL = "postgresql://.../marketplace_e2e"
$env:PLAYWRIGHT_FRONTEND_PORT = "3100"
$env:PLAYWRIGHT_API_PORT = "3101"
$env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3100"
bunx playwright test
```

Production startup still rejects `RATE_LIMIT_ENABLED=false`; the Playwright
override does not change the deployed runtime contract.

## Normal Workflow

Run the smallest relevant test while developing:

```bash
# One file
bunx vitest run app/features/storefront/StorefrontCatalog.test.tsx

# Tests matching a name
bunx vitest run -t "loads more products"

# One backend module
bunx vitest run server/modules/seller-shop
```

Before considering code complete:

```bash
bun run db:generate
bunx tsc --noEmit
bun run test
bun run audit:i18n
bun run build
```

For changes affecting browser journeys, also run the relevant Playwright
project. Run the complete E2E matrix only after focused tests pass.

## Vitest

```bash
bun run test                         # Complete non-E2E suite
bunx vitest run path/to/file.test.ts # One test file
bunx vitest run -t "test name"       # Name filter
bunx vitest path/to/file.test.ts     # Watch a file during development
```

Vitest uses at most four workers. Large jsdom suites otherwise contend for CPU
and can produce false timeout failures. Do not raise global test timeouts to
hide a slow test. Split oversized workflows into focused tests and use scoped
queries where possible.

## PostgreSQL Commerce Concurrency Checks

The opt-in commerce integration suite contains 13 scenarios using real services
and PostgreSQL repositories. It covers multi-shop checkout and trusted pricing,
seller/buyer isolation, concurrent reservations, duplicate and invalid payment
events, payment failure and expiry, cancellation races, fulfillment and refunds,
concurrent payouts, inventory reservation protection, and transaction rollback.
Payment provider events are supplied directly; Redis scheduling and browser
flows are not exercised. Use a disposable local
database named `marketplace_test_*`, apply Prisma migrations, then run:

```powershell
$env:DATABASE_URL = "postgresql://...@127.0.0.1:5432/marketplace_test_commerce"
bunx prisma migrate deploy
$env:COMMERCE_TEST_DATABASE_URL = $env:DATABASE_URL
bunx vitest run server/modules/refund/commerce-concurrency.integration.test.ts
Remove-Item Env:COMMERCE_TEST_DATABASE_URL
```

The suite creates unique fixtures and leaves them in this disposable database.
It is skipped by the normal suite unless `COMMERCE_TEST_DATABASE_URL` is set.
It never falls back to the application's `DATABASE_URL`.

The same variable enables `cart-concurrency.integration.test.ts` and
`shipment-concurrency.integration.test.ts`: concurrent first visits must share
one cart; sibling shipments dispatched or delivered simultaneously must leave
the parent order at the correct aggregate status.

### Real Redis expiry worker

`server/modules/jobs/queue-expiry.integration.test.ts` starts the application's
actual BullMQ scheduler and worker factories inside the test process. It checks
that the scheduled expiry cancels the order/payment/shop order and releases stock,
then processes another queued expiry without releasing twice.

```powershell
$env:QUEUE_TEST_DATABASE_URL = "postgresql://...@127.0.0.1:5432/marketplace_test_queue"
$env:QUEUE_TEST_REDIS_URL = "redis://127.0.0.1:56379/15"
bunx vitest run server/modules/jobs/queue-expiry.integration.test.ts
```

Apply migrations to the queue test database first. Use a dedicated Redis instance
on a nonstandard loopback port with an explicit nonzero database. The test refuses
an existing marketplace queue and removes only its owned queue; it never flushes
Redis. `QUEUE_TEST_ALLOW_OLD_REDIS=true` is an explicit local compatibility override
for older Redis, not a production setting. The recorded local run used Redis 5.0.14.1;
validate the deployed Redis version separately. Missing queue test URLs skip the test.

## Playwright E2E

### Watch the buyer/seller journey

With `DATABASE_URL` pointing to a disposable test database and
`PAYMENT_WEBHOOK_SECRET` set for the test server:

```powershell
$env:PLAYWRIGHT_SLOW_MO = "350"
bun run test:e2e:buyer-seller
```

The command checks the database name, applies migrations, seeds demo accounts,
and opens Chromium. The lifecycle test signs in through the UI, adds a product
to the cart, places an order, then signs in as the seller in a separate browser
context to pack and ship it. It reloads the buyer tracking page and verifies the
same tracking number. Payment is simulated only at the provider boundary using
a signed HTTP webhook; no real charge is made. A second test covers buyer review
and return submission against a delivered fixture. Failures retain a screenshot,
video, and trace in `test-results`; the HTML report is in `playwright-report`.

`PLAYWRIGHT_SLOW_MO` controls browser-action pacing only; tests still wait for
actual UI state and responses. Leave it unset for normal fast runs.

The command also runs `commerce-edge-flows.spec.ts` and `finance-lifecycle.spec.ts`:

- Payment failure, payment expiry webhook, and buyer cancellation restore stock,
  coupon reservations and coins; buyer state and seller fulfillment queue agree.
- Two shops ship separately; each seller sees only its items and the buyer sees
  each tracking number. The order becomes fully shipped only after both shops ship.
- Stock disappearing after a quote shows a readable failure without an order or
  reservation; reloading after a price change displays the new server quote.
- Revoked sessions require login; other buyers cannot read the order and sellers
  cannot open another shop's product editor; non-admins cannot access admin UI.
- A partial order return uses net discounted item amounts and a single seller debit.
  Processing and completing a refund require different administrators.
- Payouts reserve balance, reject overspending and duplicate completion, and require
  separate approving/paying administrators.

New extended fixtures use unique accounts, products and orders in a local
`marketplace_e2e_*` database and remain there for disposable database teardown.
Finance cases start from a paid/delivered historical fixture; they do not transfer
real money. Actual provider sandbox validation requires the provider/bridge name,
`PAYMENT_PROVIDER`, `PAYMENT_CHECKOUT_BASE_URL`, `PAYMENT_CHECKOUT_SECRET`, and
`PAYMENT_WEBHOOK_SECRET`. Do not count mock webhook tests as provider validation.

Install the browser once when needed:

```bash
bunx playwright install chromium
```

Available commands:

```bash
# All Playwright projects; also synchronizes the configured test database
bun run test:e2e

# Public storefront only; deterministic and unauthenticated by default
bunx playwright test e2e/storefront.spec.ts --project=storefront-chromium

# Authenticated seller Chromium flows
bunx playwright test --project=chromium

# Buyer, seller, and admin production workflows
bunx playwright test e2e/buyer-lifecycle.spec.ts e2e/seller-workflows.spec.ts e2e/admin-workflows.spec.ts --project=chromium

# Responsive/cross-browser seller route checks
bunx playwright test e2e/seller-routes.spec.ts --project=firefox
bunx playwright test e2e/seller-routes.spec.ts --project=webkit
bunx playwright test e2e/seller-routes.spec.ts --project=mobile-chromium
```

Storefront evidence is written under `test-results/milestone-28/`. Failure
screenshots, videos, and traces are retained by Playwright under
`test-results/`; the HTML report is written to `playwright-report/`.

## Debugging E2E Failures

```bash
# See the browser
bunx playwright test e2e/storefront.spec.ts \
  --project=storefront-chromium --headed

# Playwright inspector
bunx playwright test e2e/storefront.spec.ts \
  --project=storefront-chromium --debug

# Open the latest HTML report
bunx playwright show-report

# Inspect a retained trace
bunx playwright show-trace test-results/<test-folder>/trace.zip
```

Classify failures before changing code:

1. Re-run the failing file/project alone.
2. If isolated run passes, check worker contention, leaked database clients, or
   shared fixtures before increasing a timeout.
3. If it fails consistently, fix the application or fixture root cause.
4. Confirm Playwright exits cleanly and ports 3000/3001 are released.

Avoid `waitForTimeout` and `networkidle` for app readiness. Prefer a visible UI
state, expected URL, API response, or health endpoint. Database-backed fixtures
must close Prisma/adapter pools during teardown.

## Writing Tests

- Test behavior and domain rules, not component implementation details.
- Keep each test independent and deterministic.
- Use repository/service tests for business rules and ownership checks.
- Use route tests for validation, auth, status codes, and public field allowlists.
- Use accessible Playwright locators: role, label, and visible text.
- Use `data-testid` only when no stable user-facing locator exists.
- Seed exact E2E states; never depend on mutable demo data.
- Mock external providers and failure paths, not the application layer being
  tested.
- Clean created data and close database clients in teardown.
- Never commit `.only`, secrets, production credentials, or production database
  URLs.

## Database Schema Changes

When `prisma/schema.prisma` changes:

```bash
bun run db:generate
bunx tsc --noEmit
bun run test
```

Create migrations through Prisma. Never edit generated Prisma or Prismabox
files manually.

## Recommended Order in CI

```text
generate -> typecheck -> unit/integration -> i18n audit -> build -> E2E
```

Fail fast on deterministic checks. Keep Playwright last because it starts the
full application and is the slowest gate.

## Production acceptance and load

See `production-test-matrix.md` for item-level scope and
`production-acceptance-checklist.md` for accepted thresholds and run evidence.
The expanded Firefox/WebKit/mobile projects include buyer, auth, finance and
checkout resilience flows. Independently authenticated contexts inherit each
project's device settings. Local fixtures simulate separate trusted-proxy client
IPs; they do not disable production rate limits.

Enable `CACHE_ENABLED=true` and a dedicated local `REDIS_URL` when running the
full browser suite: the catalog freshness acceptance case requires a real cache.
Build and start with matching `API_BASE_URL` and `ALLOW_INSECURE_HTTP` values;
the latter is an explicit local HTTP exception, not a production HTTPS setting.

The real PostgreSQL/Redis unit-integration gates are opt-in:

```text
COMMERCE_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55439/marketplace_test_buyer_seller
QUEUE_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55439/marketplace_test_queue
QUEUE_TEST_REDIS_URL=redis://127.0.0.1:56379/15
CACHE_TEST_REDIS_URL=redis://127.0.0.1:56379/14
```

Migrate both disposable databases first, then run `bun run test`. Without the
opt-ins these tests are skipped, so a green default run alone does not establish
infrastructure coverage. Queue tests require an empty dedicated application
queue namespace. Cache tests use a unique prefix. CI uses Redis 7; the old local
Redis 5 compatibility setting is not evidence for the intended deployed version.

Playwright clears `test-results/` at the next run. Copy accepted load reports and
other durable evidence to `docs/test-evidence/<date>/` before starting another
browser run.

Run load against an already running local production-mode API and a migrated,
disposable database. The API must use the same database; login setup checks that
fixture users are reachable. Required variables:

```text
LOAD_TEST_ALLOW_LOCAL=true
LOAD_TEST_BASE_URL=http://127.0.0.1:3201
LOAD_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55439/marketplace_e2e_extended
LOAD_TEST_DISTINCT_CLIENT_IPS=true
```

Then `bun run test:load`. Defaults:100 users,10 checkouts/minute,30 minutes,
1-second think time, p95 below1,000ms and error rate below1%. The distinct-IP
option requires the local target's `TRUST_PROXY=true`; it models separate users
behind the test proxy. Default shared-IP mode intentionally exercises one-client
rate limits. Never point this local-only harness at production.

For a short harness smoke, set `LOAD_TEST_USERS=2` and
`LOAD_TEST_MINUTES=0.2`; that is not the acceptance run. Output defaults to
`test-results/production-load.json` and can be changed with `LOAD_TEST_REPORT`.
The runner logs minute-level progress and writes machine metadata, endpoint
latencies/errors and actual successful checkout counts. It fails on setup,
interruption, insufficient duration/checkouts or threshold violations.

Checkout uses real HTTP, database stock reservation and pending order creation.
The runner never follows payment links or submits a payment webhook. Unique
fixtures remain in the disposable database. Provider collection/refund and
staging capacity require separate evidence. Run heavy tests sequentially so
browser/build/unit work does not contaminate load measurements.
