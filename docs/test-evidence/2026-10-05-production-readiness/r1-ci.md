# R1 CI numeric gates

**Local checks PASS; GitHub Actions/Linux/browser execution NOT_EXECUTED.** The `aabb535` baseline's 1,745 tests and 130 browser configurations remain historical evidence. This unit changes CI configuration and its result gate; it does not rerun or relabel that baseline.

## Confirmed gaps addressed

- The quality job no longer sets global `REDIS_URL`. Dedicated `CACHE_TEST_REDIS_URL` and `QUEUE_TEST_REDIS_URL` still opt real integrations into Redis databases 14 and 15. Memory-based security tests retain their intended isolation.
- Quality PostgreSQL is exposed on port **55439**, required by the existing numeric threshold fixture. It prepares and migrates six separate databases: ordinary tests, commerce, queue, tax, rollout, and read-only audit. Commerce uses exact `marketplace_test_completion`, required by the existing W7 disposable-database guard. Tax uses exact `marketplace_test_tax`; rollout does not share tax's mutable global settings; audit uses exact `marketplace_test_readiness_audit`.
- Both quality and browser jobs explicitly opt into `CHECKOUT_V2_SETTLEMENT_ENABLED=true`. This is test configuration, not production rollout authorization.
- `scripts/assert-ci-integration.ts` rejects missing required opt-ins, unsafe/shared database targets, global unit Redis, shared cache/queue Redis, old-Redis bypass, and incompatible fixture ports before tests. After Vitest, it requires every source `*.integration.test.ts` under `server/` and `scripts/` to appear with executed passing assertions. Failed, pending/skipped/todo, empty, omitted, or incomplete reports fail the gate. Report artifacts upload even on failure.
- Each browser job explicitly generates Prisma outputs in its own fresh checkout. `generated/` is ignored and quality's checkout is not reused by dependent jobs.

## Production and mock coverage

The production job retains the original blanket E2E selection, with gateway mode, `PAYMENT_MOCK_ENABLED=false`, enabled rate limits, and v2 opt-in. It excludes **only six confirmed mock-dependent cases**:

| Group | Cases | Confirmed reason |
| --- | --- | --- |
| `numeric-commerce.spec.ts` | repriced basket; coupon and coins; flash price with coupon and coins | Posts webhook bodies with literal provider `mock` |
| `numeric-admin-projections.spec.ts` | cashback for original NET 9,999; 10,000; 10,001 | Asserts the newly created payment's provider is `mock` |

Those six cases run in the separate `e2e-numeric-mock` development job across Chromium, Firefox, WebKit, mobile Chromium, and mobile WebKit. Production keeps the two non-mock admin fraud cases and all preexisting compatible auth, seller, catalog, checkout, numeric, and finance selection. Historical seeded payment rows labelled `mock` in analytics/reporting/finance fixtures do not enable a production mock payment provider; those tests cover projections or manual snapshot finance, not external acquisition.

The tax browser helper signs internal webhook fixtures using the payment's actual configured provider. Gateway fixture callbacks and manually acknowledged finance references do **not** constitute external provider/bank verification. That remains R4's separate prerequisite.

## Evidence

- `r1-ci-focused.json` / `.log`: **55 passed, 0 failed, 0 skipped**: 36 gate protocol/configuration tests and the existing 19 security tests. Cases prove that an incompatible commerce database, omitted tax execution, skipped leaf assertions despite a green summary, missing opt-ins, private/non-test targets, and global Redis fail closed.
- `r1-ci-typecheck.log`: workspace `bunx tsc --noEmit`, exit **0**, no diagnostics after parallel workers completed their typed fixtures.
- `r1-ci-verify.py` / `r1-ci-semantics.json`: parsed actual YAML and executed the Bun environment preflight using its exact quality configuration. Verifies separate database creation/migration commands, Prisma generation, v2/production safeguards, distinct mock job, report gate, and evidence uploads.
- `r1-ci-all-discovery.json`, `r1-ci-production-discovery.json`, `r1-ci-mock-discovery.json`: real Playwright **`--list` only**. Original selection **260 configurations** equals production **230** plus development/mock **31**, minus their shared setup **1**. No configuration is omitted; all six mock cases appear in all five explicit profiles. Production still includes v2 tax and snapshot finance on those profiles, plus auth/seller/catalog cases.

Playwright's list-only JSON labels unexecuted selections as skipped; those artifacts are discovery manifests, not executed tests or browser pass claims. No browser, build, Actions dispatch, push, or commit occurred in this unit. Parent final checks run actual PostgreSQL/Redis; CI/Linux and provider outcomes must be reported separately.

The parent's first actual full-suite run found a further configuration gap: `w7-independent-review.integration.test.ts` rejected `/marketplace_test_commerce` in `beforeAll`, leaving nine assertions unexecuted and the suite failed (`full-tests.log` / `.json`). Its existing exact disposable-database guard remains unchanged. CI now creates and migrates `marketplace_test_completion`; the environment preflight also requires that exact commerce path. `r1-ci-commerce-red.json` / `.log` records the new regression failing before this preflight fix (**35 passed, 1 failed**). The subsequent focused run passes all 55 tests, and refreshed YAML/runtime semantics select the corrected database. The earlier typecheck artifact predates this final string-only guard/configuration patch; the parent reruns final workspace checks.

## Environment for local final checks

Unset global `REDIS_URL` for Vitest. Supply `NODE_ENV=test`, `CHECKOUT_V2_SETTLEMENT_ENABLED=true`, `QUEUE_TEST_ALLOW_OLD_REDIS=false`, and all six database URLs from the workflow; local rollout can use its separate `marketplace_test_readiness_tax` database. Supply local Redis 7 URLs on nonstandard port 56379, cache DB14 and queue DB15. The audit harness creates disposable reader/inherited-writer test roles from its admin test URL; the production audit runner's `AUDIT_DATABASE_URL` is a separate read-only connection and is not a fallback to global `DATABASE_URL`.
