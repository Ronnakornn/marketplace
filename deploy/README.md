# Deploy without payment

This Compose deployment runs Next.js, Elysia, and the queue worker under the existing process supervisor. Nginx terminates TLS. PostgreSQL 17 and Redis 7 have persistent volumes and no published ports. The app starts after successful migrations and Redis readiness. Nginx starts after the app's frontend readiness check passes.

## Prepare the host

1. Install Docker Engine and Docker Compose v2 on a Linux host.
2. Point your domain at the host. Open ports 80 and 443.
3. Copy `production.env.example` to `/etc/marketplace/production.env` outside the checkout. Restrict it to the deployment account with `chmod 600`.
4. Set `APP_HOST` to your DNS hostname without a scheme or path. Set `APP_ENV_FILE` to the absolute environment file path.
5. Set `TLS_CERT_DIR` to a directory containing your issued `fullchain.pem` and `privkey.pem`. Restrict the private key to the deployment account.
6. Generate distinct secrets with `openssl rand -hex 32` for each empty password or secret variable. Keep PostgreSQL and Redis passwords in hexadecimal so their connection URLs need no escaping.
7. Review the existing manual refund and payout process before setting `MANUAL_FINANCE_OPERATIONS_ACKNOWLEDGED=true`.

The default disables payment, affiliate, AI search, phone OTP, and push notifications. Checkout returns the existing payment-unavailable error when payment is disabled. Email remains disabled until you select `EMAIL_PROVIDER=resend`, set `RESEND_API_KEY` and `EMAIL_FROM`, and verify your sending domain. Enable email before accepting users who need verification, password reset, or order emails.

## Start the release

Run from the repository root:

```bash
docker compose --env-file /etc/marketplace/production.env -f deploy/compose.yml config --quiet
docker compose --env-file /etc/marketplace/production.env -f deploy/compose.yml build
docker compose --env-file /etc/marketplace/production.env -f deploy/compose.yml up --detach --wait --wait-timeout 180
curl --fail https://your-domain.example/api/health/ready
```

Expect `status` and every database, schema, Redis, and queue service to report `ok`. The image health check requests the frontend on port 3000 so it also verifies Next.js and its API rewrite. A terminated backend or worker causes the supervisor to stop the app container. Docker restarts the process group.

Inspect the worker with `docker compose --env-file /etc/marketplace/production.env -f deploy/compose.yml logs app`. Expect `Job worker running` and recurring `reconcile_seller_earnings` completions. Scrape `/api/metrics` and `/api/metrics/worker` separately with `Authorization: Bearer <METRICS_AUTH_TOKEN>`. Worker counters reset when that worker process restarts. The internal worker metrics port 3002 has no published port.

For each release, back up PostgreSQL and both upload volumes before migration. Apply migrations with the release's `migrate` image, then replace the app and Nginx together. An app replacement can change its internal IP, so reload Nginx's upstream with the replacement:

```bash
docker compose --env-file /etc/marketplace/production.env -f deploy/compose.yml build
docker compose --env-file /etc/marketplace/production.env -f deploy/compose.yml run --rm migrate
docker compose --env-file /etc/marketplace/production.env -f deploy/compose.yml up --detach --force-recreate app nginx
```

After certificate renewal, run `docker compose --env-file /etc/marketplace/production.env -f deploy/compose.yml exec nginx nginx -s reload`.

## Verify data recovery and the deployment

Public uploads persist in `public-uploads`. Nginx mounts that volume read-only and serves `/uploads/` directly, so new files are available without a Next.js restart. The signed local upload PUT goes directly to Elysia with a 25 MiB limit. Other proxied requests retain a 1 MiB ingress limit. Private KYC files persist in `private-uploads` and are not served by Nginx. Back up both volumes with PostgreSQL and the encryption keys. Redis persists queues through AOF in `redis-data`. A volume is not an off-host backup.

Use `bun run db:backup /absolute/path/marketplace.dump` from a host with PostgreSQL client tools and the private `DATABASE_URL`. Set `RESTORE_DATABASE_URL` to a separate disposable database, then run `bun run db:restore /absolute/path/marketplace.dump --confirm-restore`. The restore tool ignores `DATABASE_URL` and overwrites only the explicit restore target. Compare representative orders and seller ledger balances, and record elapsed recovery time. Never test a restore against the active database.

Run `bash deploy/ci-smoke.sh` only on a disposable Docker host after building `marketplace:ci` and `marketplace-migration:ci`. It creates a unique Compose project with test credentials and a temporary TLS certificate. It verifies migrations, TLS routing, protected admin and worker metrics routes, anonymous WebSocket rejection, actual worker job completion, graceful shutdown, and database, Redis, and upload persistence across container replacement. It deletes only that disposable project's containers and volumes. CI runs this check and stores logs and JSON evidence. The build-stage canary check also rejects `.env.local` or `.env.production` in the Docker context or generated frontend.

CI evidence covers the disposable Linux deployment. Before opening the deployed service, verify the real certificate chain, authenticated realtime reconnects, email delivery, upload access, monitoring scrapes, and an off-host restore drill. Record your required backup frequency and recovery time with the deployed infrastructure.

## Use PM2 on an existing host

`ecosystem.config.cjs` runs the same Bun supervisor as one PM2 process. Provision PostgreSQL, Redis, upload directories, and a TLS reverse proxy separately. Set the complete production runtime environment, including `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `API_BASE_URL`, and the secrets in `production.env.example`. Bind ports 3000, 3001, and 3002 behind the local firewall. For a same-host Nginx deployment, replace the `app` upstream name with `127.0.0.1`. Replace the upload alias with your persistent public upload directory, and set the certificate paths to your issued files.

Build with the real `NEXT_PUBLIC_APP_URL` before starting PM2:

```bash
bun install --frozen-lockfile
bun run db:migrate:deploy
bun run build:all
pm2 start deploy/ecosystem.config.cjs --update-env
pm2 save
```

Keep one PM2 instance per configured local process group. Apply the same readiness, metrics, persistence, and restore checks to that host.
