# Production Readiness Report

**Date:** 2026-08-13
**Status:** Code-ready for staging. Production go-live remains conditional on the CI gates and real provider credentials described below.

## Local verification evidence

Verified on 2026-08-13:

- Prisma generation and schema validation passed
- TypeScript typecheck passed
- 122 unit/integration files passed (892 tests)
- i18n parity passed (1,864 English keys and 1,864 Thai keys)
- Bun production dependency audit reported no vulnerabilities
- Next.js production build passed (119 routes)
- Playwright production-mode suite passed (36 tests across Chromium, Firefox, WebKit, and mobile Chromium)

The local E2E run used an isolated PostgreSQL clone that was deleted after testing. The release workflow remains the source of truth for a completely fresh pgvector database and Docker image build.

## Required release gates

The workflow in `.github/workflows/production-gates.yml` must pass before deployment:

- dependency install from the frozen lockfile
- migrations against a fresh pgvector-enabled PostgreSQL database
- Prisma generation, validation, and zero-drift comparison between migrations and the schema
- TypeScript, unit/integration tests, i18n audit, and Next.js production build
- dependency audit with no high or critical findings
- Playwright E2E suite
- Docker image build

## Runtime contracts

- Mock payment routes are mounted only outside production. Production checkout uses a signed external provider URL and payment state changes only through a signed webhook.
- BullMQ schedules expired-payment release every minute and abandoned-cart cleanup daily. The production process supervisor starts the API, frontend, and worker together.
- Coupon usage follows `RESERVED -> REDEEMED | RELEASED` and checkout locks the coupon row before its final usage-limit check.
- Email OTP values are HMAC-digested in the database and delivered through Resend in production.
- Readiness returns HTTP 503 when PostgreSQL, the required schema, Redis, or the queue is unavailable.
- Rate limits and realtime fan-out use Redis in production.
- Production requires the API to run behind a trusted reverse proxy; direct backend access must be firewalled.
- Swagger and mock payments are disabled in production; frontend responses include CSP, HSTS, framing, referrer, permissions, and MIME-sniffing protections.

## Deployment inputs still required

- pgvector-enabled PostgreSQL and a verified backup/restore target
- Redis
- external payment gateway bridge implementing `docs/04-security/payment-provider-contract.md`
- Resend API key and verified sender
- S3-compatible object storage and CDN/public base URL
- explicit acknowledgement and operation of `docs/09-ops/manual-finance-operations.md`

Production startup intentionally fails when required secrets, providers, or acknowledgements are missing or use development placeholders.
