# W1 inventory verification

Inventory now owns the seller inventory PATCH URL. Catalog's duplicate route,
service setter, repository upsert, and corresponding types are deleted. The existing
frontend caller keeps its URL and supplies the reason required by Inventory.

Seller changes preserve the reserved-stock floor under a PostgreSQL row lock.
The transaction advances Inventory.version and records an ADJUSTMENT together.
Successful commits invalidate the affected product and seller dashboard caches.
API and direct-service stock setters accept only the stored integer range.
Operational readiness applies to Inventory routes. Staff access uses the existing
`inventory` permission defined for MANAGER and WAREHOUSE, excluding SUPPORT.

## Measured baseline

`red-corrected.json` has nine failed and eleven passed tests, with zero skipped
tests. The actual composed route selected Catalog's legacy setter despite Inventory
registration occurring later. Requested stock 5 with reserved stock 6 returned
200 rather than 409. Legal metadata edits did not advance version. Missing reason
and out-of-range integers reached the legacy operation. The accepted staff roles
could not edit through that owner-only route.

The earlier numeric report's claim that the composed route used Inventory is
incorrect for this tested production registration order. `red-corrected.log` is
the retained product baseline. `environment-unavailable.log` records an initial
database connection failure. `red.log` includes an incorrect test barrier that
was repaired before the corrected baseline. Neither earlier attempt is a final
gate.

Captured text logs have trailing whitespace removed where Git's diff check
required it. JSON result reports retain the test runner's output.

## Final results

`final.json` and `final.log` record 120 passing tests in eight files, with zero
failed or skipped tests. `typecheck-final-result.json` records standalone
`bunx tsc --noEmit` with exit code zero. `generate.log` records isolated Prisma
generation before verification. The intermediate typecheck failure in
`typecheck-red.log` was an extra property in the test logger fixture and was
repaired without suppressions.

| Executed case | Literal observed result |
|---|---|
| Stock 10, held 6, version 1, seller sets 5 | Composed HTTP 409. Stock stays 10, held stays 6, version stays 1, and zero new movements exist. |
| Same starting state, seller sets 6 and supplies reserved 99 | HTTP 200 reports stock 6, held 6, and available 0. Database version is 2. One movement has delta -4 and before/after stock 10/6, with held stock 6/6. |
| ReorderLevel-only edit | On-hand 10 and held 6 remain. Version is 2, reorderLevel is 4, and one movement has delta zero. |
| Largest stored stock | 2,147,483,647 on-hand, 6 held, and 2,147,483,641 available agree in HTTP and database. The movement delta is 2,147,483,637. |
| Invalid quantities and missing reason | The API returns validation errors before writes. A direct service value 2,147,483,648 returns 400. |
| Outsider, inactive Shop, missing operational readiness | HTTP 403. Stock, version, and movement state remain unchanged. |
| MANAGER and WAREHOUSE | Each can set stock 12 and list the Shop's inventory through the accepted inventory permission. SUPPORT receives 403 and writes nothing. |
| Movement persistence fails after the stock update | Stock and version roll back to 10 and 1. No movement persists and the warmed product cache remains. |
| Reservation locks first, then seller sets 5 | One reservation succeeds, seller receives 409. Final state is stock 10, held 6, version 2, one reservation, and one RESERVATION_CREATED delta 6. |
| Seller locks first, then reservation of 6 | Seller succeeds, reservation receives 409. Final state is stock 5, held 0, version 2, zero reservations, and one ADJUSTMENT delta -5. |
| Concurrent seller edits under controlled ordering | Final stock is 8, held 6, version 3. Movement chain is 10 to 12 to 8, with deltas 2 and -4. |
| Real CheckoutService locks first, then seller sets 5 | Checkout succeeds, seller receives 409. Final state is stock 10, held 6, version 2. Exactly one Order and PENDING Payment have amount 6,000 minor units and one reservation. |
| Seller locks first, then real CheckoutService submits the stale stock snapshot | Seller succeeds, checkout receives 409. Final state is stock 5, held 0, version 2. No Order, Payment, or reservation persists. One seller movement has delta -5. |
| Cache invalidation | Real CacheService and CacheInvalidation with an in-memory provider preserve caches on failure and evict only affected detail/dashboard keys after success. |
| Actual Redis 7 and PostgreSQL catalog cache regression | The migrated real InventoryService stock edit refreshes public Product detail from stock 10 to 3. Existing price, slug, and Shop visibility checks also pass. |
| Repeated commit/release/expiry of one reservation | The existing actual PostgreSQL tests each complete one operation and reject the concurrent replay, with one movement. |

The real CheckoutService reservation block does not write InventoryMovement.
The checkout-first regression explicitly observes zero seller movements rather
than claiming a new checkout movement. W1 removes the unsafe seller setter and
does not change checkout, payment, refund, or internal restock transaction design.

The cache integration uses the task-owned Windows Redis 7.2.14 endpoint provided
by the root task. Its test guards require a nonstandard port, nonzero Redis
database, and unique key prefix. Cleanup removes only that test's cache prefix.
PostgreSQL fixture identities remain in the task-owned test database. The root
task owns server cleanup and final whole-repository gates.

## Reproduction

Generate the isolated client with `bun run db:generate`. Supply these task-owned
test endpoints before running the focused test command recorded in `final.log`.

```powershell
$env:COMMERCE_TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:55439/marketplace_test_completion'
$env:CACHE_TEST_REDIS_URL='redis://127.0.0.1:56379/14'
bun run test server/modules/inventory/inventory-boundary.integration.test.ts server/modules/inventory/inventory.service.test.ts server/modules/inventory/inventory.routes.test.ts server/modules/inventory/inventory-concurrency.integration.test.ts server/modules/catalog/catalog.service.test.ts server/modules/catalog/catalog.routes.test.ts server/modules/catalog/catalog-cache.integration.test.ts server/modules/auth/seller-authorization-contract.test.ts --maxWorkers=1
bunx tsc --noEmit
```

## Review and principles

The source diff was read and `git diff --check` passed. No production comments
were added or deleted. No lint or TypeScript suppression was added. Independent
source and comment review belongs to the root W10 review and is not claimed here.

Laziness Protocol and Migrate Callers Then Delete Legacy APIs selected deletion
over another setter adapter. Model the Domain kept stock invariants in the
existing Inventory service and movement transaction. Type System Discipline
retained the existing typed update shape and the generated database client.
Test Behavior, Not Implementation selected literal HTTP and database expectations.
Prove It Works required actual PostgreSQL locking, rollback, real CheckoutService,
and the existing Redis integration rather than service mocks alone. All named
leaf skills were read in full for W1.
