# Production fixes excluding payment

This release repairs the source findings from the 11 October review. Deployment instructions are in [deploy/README.md](../deploy/README.md). Payment integration remains excluded. `PAYMENT_PROVIDER=disabled` deliberately rejects checkout before creating an order; it permits the rest of the application to run.

## Behavior changed

| Area | Result |
| --- | --- |
| Account privacy | A user/session change mounts a new QueryClient and component subtree. Prior requests and mutation callbacks retain only their detached client. |
| Realtime | Each local or Redis recipient delivery checks the stored session, active user and current channel access. Revoked sessions close the connection; lost channel access removes the subscription. Authorization failures fail closed. |
| Seller approval | All required documents, including BANK_BOOK, must be approved for both individual and company applications. Submission and approval use the same document list. |
| Delivery earnings | Repeating DELIVERED delivery retries earnings without changing delivery timestamps or repeating delivery events. A recurring job finds missing earning recognition from committed orders and retries it under the existing order lock. |
| Returns | The configured request window defaults to seven days after the last shipment of the whole order is delivered, as selected by the user. Ownership, complete delivery evidence and deadline are checked under the order lock. The exact deadline is included; one millisecond later is rejected. Existing partial quantities and settlement rules remain enforced. |
| Readiness | Every migration directory shipped with this release must appear as completed and not rolled back in the database migration history. |
| Worker monitoring | Completed and failed attempts update worker counters. The protected worker metrics endpoint is scraped separately from API metrics because they are different processes. Counters reset on process restart. |
| Disabled affiliate | The unavailable state replaces creator actions and the profile shortcut while the backend is disabled. |
| Build and deploy | Sitemap database queries run at request time. Environment files, runtime evidence and upload data are excluded from Docker context. The supervisor waits for every child during shutdown and bounds the wait. |

No schema migration was added. Existing migration history, session, user, shop, order, delivery, sale snapshot and ledger records supply the required evidence. The earning repair does not use an enqueue-after-commit step that could lose repair work during a crash.

`RETURN_WINDOW_DAYS` accepts an integer from 1 through 365, defaults to 7, and is captured when ReturnService is created. Replace running instances after changing it. Delivered legacy orders without trustworthy delivery timestamps require support review; the API does not substitute an order creation or update timestamp. The return page translates the corresponding admission errors in both locales.

Realtime checks observe committed state when the authorization query runs. This prevents continued delivery after known revocation; it does not provide a globally atomic database-revocation/WebSocket-send boundary.

## Verification evidence

Verification is local only, as requested. Evidence is recorded in `.audit/production-fixes-2026-10-11*`. The original failing regressions and independent review remain beside the passing results.

| Check | Local result | Evidence suffix |
| --- | --- | --- |
| `bun run test` with isolated PostgreSQL 17 and Redis 7 | 2,023 passed, zero failed or skipped, all 34 integration files executed | `/quality.json`, `/quality-gate.log` |
| `bunx tsc --noEmit` | Exit 0 | `.typecheck-final.log` |
| `bun run build` | Exit 0 with HTTPS public origin, insecure HTTP disabled and an unavailable test database. 127 static pages; sitemap runs at request time. | `.build-final.log` |
| Production browser checks | 17 passed, zero skipped. Includes same-document account switching, authentication, protected admin pages, English and Thai seller pages, and storefront journeys. | `.browser.json`, `.browser.log` |
| Prisma generation, validation and schema drift | Passed; all 22 existing migrations applied to isolated databases; no schema drift | `.generate.log`, `.prisma-validate.log`, `.prisma-drift.log` |
| i18n audit | 2,294 keys per locale, placeholder parity passed, zero findings | `.i18n.log` |
| `bun audit --prod --audit-level=high` | Exit 0 | `.audit-final.log` |
| Worker through actual Redis queue | Valid repair job completed; invalid job failed; protected metrics rejected anonymous access and reported completed and failed attempts | `.worker-smoke.json` |
| Realtime through actual Redis pub/sub and PostgreSQL | One delivery before session revocation, zero afterward, revoked connection closed | `.realtime-redis-smoke.json` |
| Compose, Nginx, Bash, YAML and PM2 config | Configuration and syntax checks passed. Compose preserves a configured Return window. | `.deployment.md`, `.compose-return-window.log` |
| Local TLS through native Nginx | Trusted test certificate, readiness, protected admin and worker metrics, anonymous WebSocket rejection, newly added public upload visibility and private upload denial passed. The API uses the local HTTP auth fixture. | `.nginx-live.json` |
| Disposable backup and restore | Both helpers exited 0. All 107 public tables and 573 rows match by counts and content checksums. Active schema, indexes, constraints, sequences and 22 migrations match. | `.backup-restore.json` |

The initial restore comparison found 49 physical column-position differences. PostgreSQL retains slots for dropped columns, while a dump restores live columns only. The 11 dropped source slots explain every difference. The comparison preserves active column order and normalizes those gaps; the original failed comparison and diagnosis remain in the evidence.

The Prove It Works principle led to real database, queue and browser checks. Make Operations Idempotent led to delivery replay and durable earnings reconciliation using the existing recognition guards.

## Deployment evidence boundary

Compose supports a Linux deployment with TLS Nginx, private database/Redis/app ports, migrations before application startup, and persistent database, queue and public/private upload volumes. Nginx serves public uploads directly so files uploaded after Next.js starts are immediately available. Private KYC data is mounted only in the app. PM2 configuration and host preparation are documented separately.

The container CI job now builds the release and migration images, rejects secret-file canaries, starts the Compose deployment, and checks readiness, protected endpoints, worker completion/counters, shutdown and persistence. Docker is unavailable on this local Windows host, so adding that gate does not count as an executed Linux runtime check.

Real deployment acceptance is outside this local test request. Local fixtures do not establish deployed capacity, backup RPO or recovery RTO. Issued TLS, external email delivery, private storage permissions, monitoring alerts and off-host restore need evidence in the target environment. Email, phone OTP, push, affiliate and AI functionality remain unavailable when their providers are disabled.
