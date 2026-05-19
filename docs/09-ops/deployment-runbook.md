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
- app secrets
- payment webhook secret
- shipping webhook secret if used
- API base URL
- Better Auth URL and secret

## Required Environment Variables

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `API_BASE_URL`
- `ADMIN_EMAILS`
- `NODE_ENV`
- `PAYMENT_WEBHOOK_SECRET`

Provider integrations:
- payment provider API key
- payment webhook secret
- shipping provider API key
- shipping webhook secret

## Pre-Deploy Checklist

```bash
bun install
bun run db:generate
bunx tsc --noEmit
bun run test
bun run build
```

Database:
- confirm migration status
- confirm backup exists before production migration
- confirm rollback plan

Security:
- verify auth secret length and rotation plan
- verify webhook secrets
- verify admin emails
- verify environment does not expose development secrets

## Migration Deployment

Production migration command:

```bash
bunx prisma migrate deploy
bun run db:generate
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
10. Monitor logs and error rates.

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
