# Production Readiness Report

**Date:** 2026-09-04
**Status:** Application and fresh-database release gates pass locally. Infrastructure credentials, CI, and the external provider checks below remain required before deployment.

## Local verification evidence

Verified on 2026-09-04:

- Prisma generation and schema validation passed
- TypeScript typecheck passed
- 138 unit/integration files passed (996 tests)
- 43 Playwright tests passed across Buyer, Seller, Admin, Chromium, Firefox, WebKit, and mobile Chromium projects
- i18n parity passed (2,243 English keys and 2,243 Thai keys, zero audited findings)
- Bun production dependency audit reported no vulnerabilities
- Next.js production build passed (127 localized/static routes)
- all 18 checked-in migrations applied to an empty standard PostgreSQL 17 database without pgvector and produced zero Prisma drift
- the verification database contained neither the `vector` extension nor the `ProductEmbedding` table

The database-backed buyer golden path covers multi-shop checkout, inventory reservation, signed payment webhook, stock commit, shipment split, and duplicate-webhook idempotency. AI search and its pgvector-backed `ProductEmbedding` storage are temporarily disabled; fresh databases require standard PostgreSQL 17 only.

Browser evidence covers the Buyer checkout/payment return/order tracking and
delivered-order review/return flows; Seller product studio, ownership,
inventory, state-safe order/return actions, promotion/finance validation,
notification/chat UI, and routes; and Admin access control, locale-safe
navigation, product moderation, and two-person payout approval. Deeper mutation
rules remain covered by repository, service, and route tests. Playwright can run
on isolated ports without reusing or modifying an active development server.

The lockfile pins patched transitive `fast-uri` and `mysql2` versions because
the production dependency audit previously reported high-severity advisories
through optional tooling dependencies; the application remains PostgreSQL-only.

The migration chain includes the promotion reconciliation and Flash Sale reservation tables/indexes. `20260823120000_restore_pending_review_status` restores the legacy enum label before the immutable publication migration, preserving applied checksums while allowing a fresh replay. Do not edit an applied migration checksum or use `prisma db push` to bypass the migration gate.

The generated schema reconciliation is baseline-only and aborts on populated legacy business tables. Existing databases may mark it applied only after a backup and a verified zero-drift/current-schema check; older populated databases require a staged data-preserving migration reviewed for that exact source version.

## Required release gates

The workflow in `.github/workflows/production-gates.yml` must pass before deployment:

- dependency install from the frozen lockfile
- migrations against a fresh PostgreSQL 17 database
- Prisma generation, validation, and zero-drift comparison between migrations and the schema
- TypeScript, unit/integration tests, i18n audit, and Next.js production build
- dependency audit with no high or critical findings
- Playwright E2E suite
- Docker image build

The zero-drift gate passes on both the current development database and a freshly created PostgreSQL 17 verification database. CI must reproduce this result.

## Runtime contracts

- Mock payment routes are mounted only outside production. Production checkout uses a signed external provider URL and payment state changes only through a signed webhook.
- A successful signed payment webhook atomically commits active reservations: `quantityOnHand` and `quantityReserved` are both reduced and the reservation becomes `COMMITTED`. Failed or expired payments release reservations.
- Checkout accepts the configured online provider only. The previously non-functional COD choice is rejected rather than pretending to create a COD order.
- BullMQ schedules expired-payment release every minute and abandoned-cart cleanup daily. The production process supervisor starts the API, frontend, and worker together.
- Coupon usage follows `RESERVED -> REDEEMED | RELEASED` and checkout locks the coupon row before its final usage-limit check.
- Flash Sale price, quota, and per-buyer limits are authoritative in the checkout transaction. Reservations commit only after payment and release on failed, cancelled, or expired payment.
- Buyer Coins use an explicit ledger: one coin equals THB 1, can discount at most 20% of product subtotal, cannot pay shipping, and earn 1% cashback after discounts only after a paid order. Successful refunds atomically restore proportional spent coins and reverse proportional cashback.
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
- a green fresh-database migration replay and zero-drift result from the production gate

Production startup intentionally fails when required secrets, providers, or acknowledgements are missing or use development placeholders.
