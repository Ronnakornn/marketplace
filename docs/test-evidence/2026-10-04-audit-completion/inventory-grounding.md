# Inventory grounding for W1

This is a source investigation at the start of W1. No tests ran for this
investigation. The numeric audit report already records browser evidence that the
composed API uses InventoryService. This document does not independently measure
Elysia's duplicate route precedence.

## Components

| Component | Source | Responsibility and risk |
|---|---|---|
| Legacy catalog HTTP registration | `server/modules/catalog/catalog.routes.ts:682` | Registers PATCH `/api/seller/variants/:variantId/inventory`, using CatalogService. It applies `withAuth` and `withSellerOperational`. |
| Legacy service | `server/modules/catalog/catalog.service.ts:1106` | Checks integer values and manageable Product access, then calls a direct inventory upsert. It invalidates product and seller dashboard caches after the write. |
| Legacy persistence | `server/modules/catalog/catalog.repository.ts:1291` | Upserts quantityOnHand and reorderLevel without a surrounding transaction, reservation floor, version increment, or movement. The method belongs to ICatalogRepository at line 420. |
| Inventory HTTP registration | `server/modules/inventory/inventory.routes.ts:43` | Registers the same PATCH URL, using InventoryService. Its body strips quantityReserved and accepts reason. It currently applies only `withAuth`. |
| Inventory service | `server/modules/inventory/inventory.service.ts:94` | Requires a reason and active Shop access. It sets stock under a transaction and checks the freshly locked reserved quantity. It writes an ADJUSTMENT movement. |
| Inventory repository | `server/modules/inventory/inventory.repository.ts:152` | Ensures Inventory, locks its row, and rereads it. `updateInventory` increments version at line 163. `createMovement` records before and after quantities at line 174. |
| Actual frontend caller | `app/features/seller/hooks/useSellerManage.ts:791` | Sends quantityOnHand, reorderLevel, and the reason `seller stock update` to the shared PATCH URL. `useUpdateSellerInventory` aliases this hook at line 806. |
| Composition | `server/index.ts:147` and `server/index.ts:174` | Composes Catalog before Inventory. Both services exist independently in the container at `server/context/app-context.ts:197` and line 204. |

The legacy methods have one production caller each. Catalog's route calls its
service, which calls its repository. The service tests call the legacy method
directly. `catalog-cache.integration.test.ts:57` also calls the legacy method to
verify refreshed public detail after an inventory edit. Repository and service
inventory types are only needed by this chain.
Catalog's product and variant create/update persistence has no other
quantityOnHand write in the source searched for this investigation.

## Flow

The seller inventory table uses `useUpdateSellerInventory`. The hook submits the
shared PATCH URL and invalidates React Query inventory and product queries after
success. `SellerManagePages.tsx:506` accepts two numeric input fields and sends
their numeric values. It does not send reserved stock.

The legacy path validates values, reads Variant and Product, validates access,
then upserts Inventory. Those reads do not lock Inventory. A seller can lower
on-hand stock below reserved stock through a direct service caller. The write
does not advance version or create a movement. The service's existing unit test
at `catalog.service.test.ts:1779` supplies a mocked reserved quantity and asserts
that the upsert is called. That test does not prove reservation protection.

The Inventory path normalizes accepted fields and requires a trimmed reason.
After access validation it opens a transaction. `ensureInventory` upserts an
empty row when needed, acquires `FOR UPDATE`, and rereads the current row. The
service rejects on-hand below that row's quantityReserved with 409 and
`INSUFFICIENT_STOCK`. Otherwise it updates stock, increments version, and records
the ADJUSTMENT in the same transaction. It hydrates the response after commit.
This path currently performs no server cache invalidation.

Checkout independently protects the same Inventory row. At
`checkout.repository.ts:317`, its SQL update increments reserved quantity and
version only when available stock covers the requested quantity. PostgreSQL's
row write serializes this update against the Inventory service's row lock.
Checkout currently writes a reservation but does not create an InventoryMovement
in this block. Closing that separate audit gap would be a broader change than
deleting Catalog's legacy stock setter.

Payment uses conditional Inventory updates for committing and releasing holds
at `payment.repository.ts:203` and line 264. Refund cancellation locks Inventory
and writes RETURN_RESTOCK at `refund.repository.ts:93`. Deleting the Catalog stock
setter does not require replacing those transaction-specific persistence paths
with nested InventoryService transactions.

## Boundaries

The public URL can remain unchanged. Its sole owner can become Inventory routes.
The existing UI already supplies the required reason. Inventory's response has
id, variantId, productId, shopId, stock values, titles, and updatedAt. The mutation
hook returns the response and does not depend on Catalog's narrower inventory
return shape.

`withSellerOperational` checks seller readiness through auth-plugin.ts:78.
Catalog's duplicate PATCH has this macro. Inventory's PATCH currently lacks it.
Moving sole ownership to Inventory must deliberately preserve that readiness
boundary rather than accidentally weaken it.

InventoryService calls `ActiveShopResolver.requireActiveShop`. This resolver
accepts an active owner or active staff access without required permissions at
`security/active-shop.ts:57` and line 62. Catalog calls `hasActiveShop`, backed by
the owner's active Shop query. The two service access contracts differ. Staff
inventory permission policy must not be guessed during this cleanup. An unrelated
user and a suspended or inactive Shop must fail before stock creation or writes.

Inventory quantity and version columns are Prisma `Int` at
`prisma/schema.prisma:1372`. Current Inventory validation accepts any nonnegative
JavaScript integer, while PostgreSQL's signed 32-bit storage is narrower. The
HTTP schema also lacks a maximum. Values above 2,147,483,647 currently reach the
database boundary instead of returning a normal validation error.

## Non-obvious

- A later composed route does not remove the legacy service and repository.
  Direct callers can still bypass the locked domain operation. Removing the
  chain closes that access even if the normal browser already selects Inventory.
- Moving the caller to Inventory without preserving server cache invalidation
  would leave public availability or seller dashboards stale after a seller edit.
- `ensureInventory` rereads after locking. The reservation floor must use that
  reread, not the earlier Variant inventory projection.
- Movement failure must abort both the stock update and its version increment.
  Cache invalidation belongs after the transaction commits.
- Existing inventory concurrency tests cover repeated commit, release, and expiry
  of one reservation. They do not prove seller edits racing checkout.
- Metadata-only reorderLevel edits still produce an ADJUSTMENT with quantityDelta
  zero and advance version once. That is the current Inventory contract.
- `restockReturn` accepts a quantity and always adds it. It has no operation
  identity itself. Actual refund completion protects replay at its own boundary.
  This investigation does not recommend exposing restockReturn as an unguarded API.

## Minimal proposed fix

Delete Catalog's duplicate PATCH registration, UpdateInventoryBodySchema,
CatalogService.updateSellerInventory and UpdateInventoryData, and
ICatalogRepository.updateVariantInventory with its implementation and
UpdateInventoryRecord. Remove mock fields and legacy-only tests. Preserve the
shared public URL as Inventory's route.

Migrate the stock edit in `catalog-cache.integration.test.ts:57` to a real
InventoryService with PrismaInventoryRepository, real ActiveShopResolver, the
existing CacheInvalidation, and a reason. Keep its public cache refresh assertion.

Give InventoryService an optional existing CacheInvalidation dependency and wire
it in `createContainer`. After a successful seller update, invalidate the affected
Product and seller dashboard using the hydrated response IDs. Preserve existing
fail-open CacheService behavior. Avoid adding a delegation adapter inside Catalog.

Apply the seller operational macro to Inventory's operational routes and include
the Inventory route file in the existing seller authorization contract. Assert
the actual HTTP behavior with Catalog and Inventory composed in production order.
Bound seller quantities and reorderLevel to the storage range at the API and
service boundaries. These changes need no Prisma model or migration.

Laziness Protocol changed this recommendation from repairing two independent
setters to deleting the unused setter. Migrate Callers Then Delete Legacy APIs
changed the recommendation from adding a Catalog-to-Inventory wrapper to keeping
the existing frontend URL and removing its duplicate internal implementation.
Both leaf skills were read in full for this investigation.

## Literal regression expectations

These are proposed expectations, not test results.

| Case | Independent expected result |
|---|---|
| Composed PATCH, on-hand 10, reserved 6, version 1, requested on-hand 5 | HTTP 409 `INSUFFICIENT_STOCK`. Database remains 10 on-hand, 6 reserved, version 1, and zero new movements. No invalidation. |
| Same state, requested on-hand 6 with reason `count` | HTTP 200. Database becomes 6 on-hand, 6 reserved, version 2. One ADJUSTMENT records delta -4, on-hand 10 to 6, reserved 6 to 6, actor, reason, and variant reference. Available stock is zero. |
| Same state, requested reorderLevel 4 only | On-hand 10 and reserved 6 remain unchanged. ReorderLevel is 4 and version is 2. Exactly one ADJUSTMENT has delta zero. |
| Client submits quantityReserved 99 alongside legal stock fields | Reserved quantity remains 6. The boundary strips the unsupported field. |
| Unrelated actor or inactive Shop | HTTP 403 before Inventory creation or mutation. No new movements or cache invalidation. |
| Actor fails operational readiness | HTTP 403 from the composed route. No stock mutation. |
| Missing reason, fractional stock, negative stock, or stock 2,147,483,648 | Validation rejects before persistence. Stock, version, movements, and caches remain unchanged. |
| Inject movement failure after setting stock 10 to 12 | Operation fails. Transaction restores on-hand 10, reserved 6, version 1, and no ADJUSTMENT row. No postcommit invalidation. |
| Concurrent seller set to 5 and checkout reserve 6, initial on-hand 10, reserved 0, version 1 | Exactly one operation succeeds. If checkout wins, final stock is 10 on-hand, 6 reserved, version 2, seller gets 409, and no seller ADJUSTMENT exists. If seller wins, final stock is 5 on-hand, 0 reserved, version 2, checkout gets 409, and its Order/reservation writes roll back. One seller ADJUSTMENT records delta -5. |
| Seller edits 10 to 12 and 12 to 8 under controlled lock ordering | Final on-hand 8, reserved 6, version 3. Two movements form the chain 10 to 12 and 12 to 8, with deltas 2 and -4. |
| Warmed caches after successful edit | Affected product detail, public product/search lists, and affected seller dashboard are invalidated. An unrelated Product detail and Shop dashboard remain cached. |

## Open questions

No owner decision blocks removal of the legacy direct setter. Staff inventory
permission policy is a separate existing authorization ambiguity. Do not add a
new permission string or broaden staff rights without an accepted contract.

The proposed composed and PostgreSQL tests must establish runtime behavior. The
source trace alone cannot mark W1 passed. Movement coverage in checkout and the
internal mutation helpers is outside this minimal removal proposal and must be
reported separately if the completion scope requires a global stock audit.

## Subsequent runtime finding

W1 implemented and tested the recommendation in the isolated audit-inventory
worktree. The actual composed Catalog-first, Inventory-later route selected
Catalog's unsafe PATCH before the fix. Stock 5 with 6 held returned HTTP 200.
The earlier report's claim that this composition selected Inventory is refuted by
`inventory/red-corrected.log` and its JSON report. That baseline had nine product
failures and eleven passes. The first attempt failed because PostgreSQL was not
running, and a later intermediate run had one incorrect test barrier. Neither
counts as product evidence.

The finalized focused run passed 120 tests with no skipped tests. It includes 24
new actual PostgreSQL boundary tests, composed HTTP calls, both lock orders for
real CheckoutService versus seller stock edits, actual movement/version rollback,
accepted staff permissions, and the migrated PostgreSQL/Redis 7 catalog cache
test. Standalone typecheck passed. Final root gates and independent review belong
to W10. See `inventory/README.md` after the W1 commit is integrated.
