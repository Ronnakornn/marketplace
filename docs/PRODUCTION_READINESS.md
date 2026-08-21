# Production Readiness Report

**Date:** 2026-08-20
**Status:** Production blocked. The pgvector dependency is disabled, but the historical migration chain does not yet reproduce the current Prisma schema without drift.

## Local verification evidence

Verified on 2026-08-20:

- Prisma generation and schema validation passed
- TypeScript typecheck passed
- 123 unit/integration files passed (915 tests)
- i18n parity passed (2,104 English keys and 2,104 Thai keys, zero audited findings)
- Bun production dependency audit reported no vulnerabilities
- Next.js production build passed (119 routes)
- all 9 checked-in migrations applied to an empty standard PostgreSQL 17 database without pgvector
- the verification database contained neither the `vector` extension nor the `ProductEmbedding` table

The database-backed buyer golden path covers multi-shop checkout, inventory reservation, signed payment webhook, stock commit, shipment split, and duplicate-webhook idempotency. AI search and its pgvector-backed `ProductEmbedding` storage are temporarily disabled; fresh databases require standard PostgreSQL 17 only.

The required Prisma migration drift check currently fails because the historical migrations omit or differ from many models, columns, indexes, and foreign keys in `prisma/schema.prisma`. A reviewed schema-baseline/reconciliation migration is required before production deployment. Do not use `prisma db push` to bypass this gate.

## Required release gates

The workflow in `.github/workflows/production-gates.yml` must pass before deployment:

- dependency install from the frozen lockfile
- migrations against a fresh PostgreSQL 17 database
- Prisma generation, validation, and zero-drift comparison between migrations and the schema
- TypeScript, unit/integration tests, i18n audit, and Next.js production build
- dependency audit with no high or critical findings
- Playwright E2E suite
- Docker image build

The zero-drift gate above is currently red and is a production blocker.

## Runtime contracts

- Mock payment routes are mounted only outside production. Production checkout uses a signed external provider URL and payment state changes only through a signed webhook.
- A successful signed payment webhook atomically commits active reservations: `quantityOnHand` and `quantityReserved` are both reduced and the reservation becomes `COMMITTED`. Failed or expired payments release reservations.
- Checkout accepts the configured online provider only. The previously non-functional COD choice is rejected rather than pretending to create a COD order.
- BullMQ schedules expired-payment release every minute and abandoned-cart cleanup daily. The production process supervisor starts the API, frontend, and worker together.
- Coupon usage follows `RESERVED -> REDEEMED | RELEASED` and checkout locks the coupon row before its final usage-limit check.
- Email OTP values are HMAC-digested in the database and delivered through Resend in production.
- Readiness returns HTTP 503 when PostgreSQL, the required schema, Redis, or the queue is unavailable.
- Rate limits and realtime fan-out use Redis in production.
- Seller KYC files use private object keys and short-lived signed admin download URLs. Local storage is the default and keeps private files outside the public web root; S3 remains an explicit opt-in.
- Seller onboarding requires payout bank details, pickup address, identity/tax evidence, and a bank-book document before submission.
- Payout approval and paid confirmation require different administrators and a bank reference. Refund processing and successful completion also require different administrators and an external provider reference. Trusted carrier evidence is required for an admin delivery override.
- Admin payment and shipment exception cards open server-filtered, paginated operational queues. User administration is server-paginated.
- Admin commission review and non-secret system settings use protected APIs and record administrative changes in the audit log.
- Affiliate commission settlement is intentionally disabled in production with `AFFILIATE_ENABLED=false` until a complete settlement workflow is enabled.
- Pgvector-backed AI search and the shopping assistant are intentionally disabled with `AI_SEARCH_ENABLED=false` until their storage migration is restored.
- Production requires the API to run behind a trusted reverse proxy; direct backend access must be firewalled.
- Swagger and mock payments are disabled in production; frontend responses include CSP, HSTS, framing, referrer, permissions, and MIME-sniffing protections.

## Deployment inputs still required

- PostgreSQL 17 and a verified backup/restore target
- Redis
- external payment gateway bridge implementing `docs/04-security/payment-provider-contract.md`
- Resend API key and verified sender
- persistent local upload volumes (default), or S3-compatible object storage and CDN/public base URL when explicitly selected
- identity-provider MFA for named finance operators, daily reconciliation, and explicit operation of `docs/09-ops/manual-finance-operations.md`
- a green `.github/workflows/production-gates.yml` run, including the database-backed buyer golden path, immediately before deployment
- a reviewed migration baseline/reconciliation that makes the fresh-database Prisma drift comparison exit successfully

Production startup intentionally fails when required secrets, providers, or acknowledgements are missing or use development placeholders.
