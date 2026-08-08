# Testing Guide

This repository uses Vitest for unit, component, service, repository, and route
tests. Playwright covers critical browser journeys.

## Before Running Tests

```bash
bun install
bun run db:generate
```

E2E tests require PostgreSQL through `DATABASE_URL`. Use a disposable local or
test database: `bun run test:e2e` runs `prisma db push` before Playwright and
may create or change tables in that database.

Frontend and API ports must be available:

- Next.js: `http://localhost:3000`
- Elysia API: `http://localhost:3001`

Playwright starts both services automatically. When local services already run,
it reuses them.

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

## Playwright E2E

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

