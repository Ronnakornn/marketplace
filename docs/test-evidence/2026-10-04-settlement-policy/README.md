# Accepted settlement policy verification

This increment implements accepted ADR-0005 for new snapshot orders. Historical
numeric-audit and refund-allocation results remain separate. Literal expected
amounts come from the accepted business rules, not the tested calculator.

## Evidence and current gates

| Behavior | Result and evidence |
|---|---|
| Schema and migration | Additive four-table migration applied only to local test/E2E databases; `migration-status.log`, `schema-validate.log`, `generate.log` |
| Purchase facts and original fee | `settlement-policy.integration.test.ts`; buyer 92,000, seller gross 94,000, fee 9,000, retained 85,000 despite live rate 20% |
| Platform discount and coins | Same PostgreSQL suite; 5,000 platform coupon and 2,000 coin funding preserve seller base 100,000, retained 94,000 |
| Full merchandise return | Same suite; cash 88,000, seller debit 90,000, fee credit 9,000, retained shipping 4,000 and all 20 spent coins restored |
| Pre-earning cancellation | Same suite; cash 92,000, no unearned debt, stock restored from 9 to 10 once; shipment canceled |
| Free shipping by funding owner | Same suite; platform funding retains 94,000 versus seller waiver 90,000 |
| Zero-cash merchandise | Same suite; fully subsidized 10,000 item refunds zero cash, reverses seller subsidy and original fee; retains buyer shipping 4,000 |
| Outstanding and paid payouts | Same suite; unfunded approval rejected, reservation release avoids invented debt; paid payout then refund creates debt 81,000; real future checkout/payment/delivery offsets it to balance 13,000 |
| Replay, race and rollback | `settlement-races.integration.test.ts`, `new-races.log`; concurrent completion, recognition/refund race, plan reservation and failed release, late reward failure, shipping refunded once, plan/status CAS |
| Cancel one shop after another delivers | Same race suite uses actual AdminService lifecycle; parent becomes DELIVERED, remaining shop receives 9,500, canceled shop receives zero, stock 10 |
| UI/API/DB parity | `browser-complete.json`, `browser-complete.log`; four Chromium finance flows passed; new pending plan shows 32.00 then 37.00 after approved shipping; final shop balance 43.20 matches API/DB |
| Cancellation through admin UI/API | Same browser run; POST prepares PENDING cash 85.00, order stays PAID until two-admin SUCCESS; replay leaves payment REFUNDED, both item stocks 10, zero seller ledger writes |
| Seller-fault checkbox | Initial browser failed to click collapsed checkbox; wrapping fixed-size control passed real browser without forced clicks |
| Legacy compatibility | `legacy-commerce-green.log`; 20 commerce tests passed; historical amount-only fixtures explicitly omit new funding snapshots |
| Cash and posting limits | Checkout rejects unsafe seller gross even if discounted buyer cash is safe; worker evidence records literal near-ceiling regression |
| Schema/translation checks | Regeneration and validation passed; 2,253 keys in each locale and placeholder parity passed |
| Cache and expiry | `redis-integration.log`; two actual Redis 5/PostgreSQL cases passed; Redis 7 is unverified |
| Cancellation cache and retry | `cache-worker-green.log`, `cache-worker-result.json`; real checkout/payment/AdminService and Redis refresh stock 9→10 and sold 1→0; affected detail/discovery/search/dashboard caches cleared, sibling/unrelated keys retained, replay restocks once |
| Canceled units and gross analytics | `sold-worker-red.log`, `sold-worker-green.log`; canceled line quantity 4 excluded, delivered history 9 retained despite a later return, remaining paid shop quantity 3 included; gross revenues 900 and 1,200 |
| Inconsistent coin spend / ownership | `refund-worker-unit.log`, `new-races.log`; 61 focused and 11 PostgreSQL tests passed, including missing/insufficient spend, over-restoration and unrelated wallet proof; conflict leaves PROCESSING and rolls back every refund money write |

Final gates after all source review repairs:

| Gate | Final result | Evidence |
|---|---|---|
| Full Vitest with PostgreSQL and Redis enabled | 173 files, 1,374 passed, zero failed or skipped | `final-all-vitest.json`, `final-all-vitest.log`, `final-all-result.json` |
| Chromium finance lifecycle | Four passed, zero failed, skipped or flaky | `browser-complete.json`, `browser-complete.log` |
| Standalone typecheck | Exit 0 | `typecheck-complete-result.json`, `typecheck-complete.log` |
| Production build | Exit 0 | `build-complete-result.json`, `build-complete.log` |
| Task infrastructure cleanup | PostgreSQL stop exit 0 / status 3, Redis shutdown exit 0; no listeners on 55439, 56379, 3100 or 3101 | `cleanup-result.json`, `cleanup-postgres.log`, `cleanup-redis.log` |

Local data directories are retained. Existing services on 3000/3001 were not
stopped. Earlier failed logs remain historical evidence, not final passes.
Raw runner logs retain their trailing whitespace and terminal blank lines. The
final whitespace check covers source, documentation and JSON, excluding these
unaltered `.log`/`.txt` execution records only.

## Red evidence and repairs

`baseline.log` reproduces gross-only earnings before this policy. `shipment-worker-red.txt`
reproduces canceled siblings blocking delivery completion. `lifecycle-first.log`
and `refund-timeout-diagnostic.log` exposed recursive transactions because Prisma's
transaction proxy still exposes a callable `$transaction`; explicit repository
transaction ownership fixed it without raising timeouts.

`browser.log` preserves the original legacy fixture over-credit introduced by an
over-broad post-refund earning hook and the collapsed checkbox failure. The hook
now applies only to snapshot orders. `browser-final.log` passed all three flows.
Initial full-suite and UI rerun logs include five-second jsdom timeouts under
concurrent browser/build load. A later two-worker run narrowed the remaining
failure to a legacy route mock missing its required order projection; that fixture
was repaired rather than adding an optional production Order guard.
`final-build.log` caught an invalid direct OrderItem relation in the cache query;
the corrected `itemSale.orderItem` relation passed `build-complete.log`.

Independent review found missing coin-spend evidence could silently under-restore
coins and that a failed postcommit earning hook could prevent audit/publication.
Their source-review record and regression evidence distinguish findings from
final repairs. The review used another GPT-family agent, not a different model family.
Comment review recommended zero deletions and found no new safety suppressions.

Model the Domain separates immutable sale funding from reserved refund rights.
Type System Discipline derives admin payloads from Eden and queries generated
snapshot relations instead of duplicating transport types.
Test Behavior, Not Implementation uses literal expected money and actual lifecycle
calls. Prove It Works requires PostgreSQL/Redis and browser parity alongside the
complete suite. Sequence Work into Verifiable Units separates the additive schema,
backend accounting, and UI/evidence commits.

## Reproduction

Use migrated disposable local databases only. Integration fixtures require
`marketplace_test_*`; browser fixtures require `marketplace_e2e_*`. No production
connection, global cache flush, schema push or guessed historical backfill is used.

```powershell
$env:COMMERCE_TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:55439/marketplace_test_numeric'
$env:QUEUE_TEST_DATABASE_URL=$env:COMMERCE_TEST_DATABASE_URL
$env:QUEUE_TEST_REDIS_URL='redis://127.0.0.1:56379/15'
$env:CACHE_TEST_REDIS_URL='redis://127.0.0.1:56379/14'
$env:QUEUE_TEST_ALLOW_OLD_REDIS='true'
bun run test --maxWorkers=2 --reporter=default --reporter=json --outputFile=docs/test-evidence/2026-10-04-settlement-policy/final-all-vitest.json
bunx tsc --noEmit
bun run build
```

The Redis compatibility flag applies only to the retained Windows Redis 5 run.
It does not prove production Redis 7 behavior.

Browser uses the existing isolated database and dedicated development ports:

```powershell
$env:DATABASE_URL='postgresql://postgres@127.0.0.1:55439/marketplace_e2e_numeric_final'
$env:PLAYWRIGHT_FRONTEND_PORT='3100'
$env:PLAYWRIGHT_API_PORT='3101'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3100'
$env:PLAYWRIGHT_PRODUCTION='false'
$env:NEXT_DIST_DIR='.next-e2e-3100'
$env:PAYMENT_PROVIDER='mock'
$env:PAYMENT_WEBHOOK_SECRET='numeric-test-webhook-secret-2026-at-least-32'
$env:BETTER_AUTH_URL='http://127.0.0.1:3100'
$env:NEXT_PUBLIC_APP_URL='http://127.0.0.1:3100'
$env:PHONE_OTP_ENABLED='false'
$env:CACHE_ENABLED='false'
bun run scripts/assert-e2e-database.ts
bun run db:migrate:deploy
bunx playwright test e2e/finance-lifecycle.spec.ts --project=chromium --no-deps --reporter=list,json
```

Browser actors are created by guarded finance fixtures; `--no-deps` omits unrelated
demo seller login setup. The local webhook secret is synthetic. Production mock
payment prohibition remains enabled.

## Limits

This verifies the implemented settlement increment, not every earlier numeric
audit gap. Partial-unit returns, nonzero-tax snapshot settlement, simultaneous
shop/platform coupon selection, coupon reissuance, goodwill and affiliate late
refund adjustments remain unsupported or undecided. Combined funding arithmetic
does not advertise an unsupported checkout selection.

Actual provider refund/transfer execution, manual bank transfer/refund races,
production browser runtime, Firefox/WebKit/mobile and Redis 7 are not verified.
Two administrator references prove the local workflow, not external cash movement.
Best-effort notifications have no transactional outbox guarantee. Original funding
and fee facts for legacy orders are not reconstructed or certified. Safe sale and
per-entry guards do not certify arbitrarily large lifetime wallet aggregates or
the global legacy BigInt-to-Number serializer.

Product analytics revenue remains gross merchandise for noncanceled paid lines;
it is not the seller wallet's net entitlement after funding and commission.

## Local commit units

- `37b5d10`: additive original sale snapshots and refund allocation schema/design.
- `c55e8ac`: checkout, earnings, component refunds, debt, cancellation projections
  and backend regression tests.
- `feat: review settlement refunds and record numeric verification`: admin/seller
  UI, translations, browser regressions and final documentation/evidence.

No push, deployment or production migration was performed.
