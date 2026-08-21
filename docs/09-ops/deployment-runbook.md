# Deployment and Operations Runbook

This runbook defines operational steps for deploying and maintaining the marketplace.

## Environments

Recommended environments:
- local
- development
- staging
- production

Each environment should have:
- PostgreSQL database
- Redis
- app secrets
- payment webhook secret
- shipping webhook secret if used
- API base URL
- Better Auth URL and secret

## Required Environment Variables

- `DATABASE_URL`
- `ALLOW_INSECURE_HTTP`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_TRUSTED_ORIGINS`
- `NEXT_PUBLIC_APP_URL`
- `API_BASE_URL`
- `ADMIN_EMAILS`
- `NODE_ENV`
- `PAYMENT_WEBHOOK_SECRET`
- `PAYMENT_PROVIDER`, `PAYMENT_CHECKOUT_BASE_URL`, `PAYMENT_CHECKOUT_SECRET`
- `OTP_HASH_SECRET`, `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`
- `PHONE_OTP_PROVIDER=http` and `PHONE_OTP_HTTP_URL`, or explicitly `PHONE_OTP_ENABLED=false`
- `REDIS_URL`
- `TRUST_PROXY=true` with direct API access blocked so only the reverse proxy can supply client-IP headers
- `UPLOAD_STORAGE=local` (default), or explicitly `s3`
- for local storage: writable persistent volumes for `LOCAL_UPLOAD_DIR` and `LOCAL_PRIVATE_UPLOAD_DIR`
- for S3 storage: `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`
- `MANUAL_FINANCE_OPERATIONS_ACKNOWLEDGED=true`
- `AFFILIATE_ENABLED=false` until affiliate commission settlement is implemented and separately approved
- `AI_SEARCH_ENABLED=false` while pgvector-backed product embeddings are disabled

Provider integrations:
- payment provider API key
- payment webhook secret
- shipping provider API key
- shipping webhook secret

## Pre-Deploy Checklist

```bash
bun install --frozen-lockfile
bunx --bun prisma migrate deploy
bun run db:generate
bunx --bun prisma validate
bunx --bun prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
bunx tsc --noEmit
bun run test
bun run audit:i18n
bun audit --prod --audit-level=high
bun run build
bun run test:e2e
```

Database:
- confirm migration status
- confirm backup exists before production migration
- confirm rollback plan
- confirm PostgreSQL 17 is available and the target database is empty or migration-compatible

Security:
- verify auth secret length and rotation plan
- verify webhook secrets
- verify admin emails
- verify environment does not expose development secrets
- verify `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`, and `NEXT_PUBLIC_APP_URL` match the public browser origin
- set `ALLOW_INSECURE_HTTP=true` only for temporary IP-based HTTP deployments such as `http://165.245.191.63`
- verify named finance operators use MFA and payout/refund two-person responsibilities are assigned

Object storage:
- keep `LOCAL_PRIVATE_UPLOAD_DIR` outside the web root, or deny anonymous/public S3 reads for `private/kyc/*`
- permit KYC access only through short-lived signed application URLs for authorized admins
- expose only intended public product assets through `S3_PUBLIC_BASE_URL` or the configured CDN
- test upload, authorized KYC preview, expired-link rejection, and public denial before go-live

## Migration Deployment

Production migration command:

```bash
bunx prisma migrate deploy
bun run db:generate
```

For containerized deployments, build and run the dedicated one-shot migration target before rolling out the application image:

```bash
docker build --target migration -t marketplace-migration .
docker run --rm --env-file .env.production marketplace-migration
```

Rules:
- Do not use `db push` in production.
- Back up database before destructive migrations.
- Run migrations before starting the new app version when required.
- Keep generated client in sync with schema.

## Deployment Steps

1. Build application artifact or Docker image.
2. Back up production database.
3. Apply migrations.
4. Start new application version.
5. Run health checks.
6. Verify frontend loads.
7. Verify API health.
8. Verify auth login.
9. Verify payment webhook endpoint receives signed test event.
10. Run the buyer golden path: multi-shop checkout, reservation, signed paid webhook, stock commit, split shipments, and duplicate webhook replay.
11. Verify seller KYC upload and admin signed preview without public object access.
12. Monitor logs and error rates.

## Rollback

Rollback application:
- redeploy previous image/version
- keep database compatibility in mind

Rollback database:
- restore backup only if required and approved
- prefer forward fixes for non-destructive migration issues

Critical note:
- Payment and order data is financial state. Do not restore production database without understanding payment provider reconciliation impact.

## Health Checks

Application:
- frontend responds on expected URL
- API responds
- database connection works
- auth session creation works

Marketplace:
- product feed loads
- cart API responds for authenticated buyer
- checkout validation works
- payment webhook signature verification works
- seller/admin protected routes reject unauthorized users
- inventory is reserved before payment, committed only by a signed successful webhook, and released after failure/expiry
- admin payment/shipment exception cards open the corresponding filtered queue

## Monitoring

Track:
- API error rate
- checkout failures
- payment webhook failures
- duplicate webhook events
- reservation expiry rate
- shipment delay rate
- refund failure rate
- login/session errors

Important log fields:
- `requestId`
- `userId`
- `shopId`
- `checkoutId`
- `orderId`
- `paymentId`
- `shipmentId`
- provider event id

## Backup and Recovery

Database:
- daily automated backups minimum
- point-in-time recovery recommended
- test restore process regularly

Repository helpers:

```bash
bun run db:backup -- ./backups/pre-deploy.dump
RESTORE_DATABASE_URL=postgresql://... bun run db:restore -- ./backups/pre-deploy.dump --confirm-restore
```

The restore helper intentionally ignores `DATABASE_URL` and requires a separate target variable plus explicit confirmation.

Files/media:
- if product images are externally stored, document provider backup/recovery separately

Secrets:
- store in environment secret manager
- rotate webhook secrets with provider coordination
- never commit secrets

## Incident Playbooks

Payment webhook failure:
- pause payment success assumptions in UI; keep pending state
- inspect signature and provider event logs
- replay provider event if supported
- verify idempotency before replay

Oversell risk:
- disable checkout if needed
- inspect inventory reservations
- reconcile affected orders
- notify sellers/admin

Seller ownership issue:
- disable affected route/action
- audit logs
- patch authorization check
- notify impacted users if data exposure occurred

## Acceptance Checklist

- Production uses `migrate deploy`.
- Backups are available before migrations.
- Webhook secrets are configured.
- Health checks include API, DB, auth, and webhook verification.
- Rollback plan accounts for financial/order state.
- The full production-gates workflow is green for the exact release commit.
- Payment, email, object storage, Redis, MFA, finance reconciliation, and backup/restore have passed staging acceptance with real provider credentials.
