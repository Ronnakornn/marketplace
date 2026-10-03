# Exact money transport candidate

This candidate preserves a seller's full ledger and each displayed cent after the lifetime sum exceeds JavaScript's safe integer range. It removes the Prisma runtime/type disagreement. Application source and databases were read only during this design. The executable sketch is isolated in [money-exact/prototype.ts](money-exact/prototype.ts).

## Work checklist

- [x] Ground the database, service, transport, cache, and display paths.
- [x] Sketch the caller's usage and derived signatures.
- [x] Measure literal signed boundaries through Elysia and Eden.
- [ ] Agree. The parent compares this candidate with the separate bounded-number candidate.
- [ ] Implement. This task owns evidence only.
- [ ] Scrap. Revisit the shape if complete caller migration cannot preserve existing external contracts.

## Problem and traced ownership

Prisma schema declares 61 BigInt fields. Counts, ratings, inventory quantities, and basis points have separate numeric meanings. The current implementation changes BigInt values to Number before repositories receive them. A service that later calls BigInt cannot reconstruct a lost cent.

| Path | Observed behavior and source |
|---|---|
| Storage to repositories | [server/lib/prisma.ts](../../../../server/lib/prisma.ts) lines 14-34 runs every operation through JSON.stringify with Number for bigint, then returns the original generic T. Its declared PrismaClient still declares bigint. Date objects also become ISO strings. |
| Wallet aggregate | [wallet.repository.ts](../../../../server/modules/wallet/wallet.repository.ts) lines 112-124 calls aggregate then Number for ledger and reserved payout sums. [wallet.service.ts](../../../../server/modules/wallet/wallet.service.ts) lines 54-56 locks the wallet before both reads. Lines 258-275 compute debt with Number and serialize each ledger amount with Number. |
| Payout gate | [payout.repository.ts](../../../../server/modules/payout/payout.repository.ts) lines 93-99 also returns a Number aggregate. Approval/paid compare that balance under the existing wallet lock. The shape of a read must preserve signed cents before comparison. |
| Analytics aggregate | [product-analytics.service.ts](../../../../server/modules/product-analytics/product-analytics.service.ts) lines 393, 439, 457 and 587 add Number(item.lineTotal). Lines 511-522 compare money by Number subtraction. Large totals can lose cents and ties can select the wrong page. |
| Refund allocations | [settlement-refund.service.ts](../../../../server/modules/refund/settlement-refund.service.ts) already defines amount and allocated fields as bigint. [refund.repository.ts](../../../../server/modules/refund/refund.repository.ts) lines 212-244 uses BigInt and writes entitlement debits inside the completion transaction. Its apparent bigint reconstruction currently receives already-coerced Prisma data. |
| Search and seller totals | [search.service.ts](../../../../server/modules/search/search.service.ts) lines 322 and 358 converts variant prices. [seller-dashboard.service.ts](../../../../server/modules/seller/seller-dashboard.service.ts) lines 284-302 sums and maps line totals as Number. |
| Elysia JSON | Installed `node_modules/elysia/dist/adapter/web-standard/handler.js` uses JSON.stringify for object responses. A raw bigint handler throws during JSON serialization. A framework JSON replacer would change runtime bytes without changing inferred handler types. |
| Eden | [app/lib/eden.ts](../../../../app/lib/eden.ts) derives the client from App. Installed `node_modules/@elysiajs/eden/dist/treaty2/types.d.ts` derives successful data from handler/schema response types. The runtime parses JSON and normally restores ISO dates. It does not turn decimal money strings into bigint. |
| Prismabox | Installed `node_modules/prismabox/cli.js` maps both Int and BigInt to t.Integer. [generated/prismabox/WalletLedgerEntry.ts](../../../../generated/prismabox/WalletLedgerEntry.ts) therefore describes amount as a JSON number. Generated files cannot be edited manually. |
| Cache | [cache.service.ts](../../../../server/modules/cache/cache.service.ts) line 64 writes bigint as decimal strings. Its get<T> revives only dates. When services retain bigint, a cache miss returns bigint but a hit returns string under the same T. Catalog, search, recommendations, and seller dashboards call remember. |
| Display | [app/i18n/client.tsx](../../../../app/i18n/client.tsx) lines 71-89 accepts Number and divides cents by 100 before Intl. [SellerManagePages.tsx](../../../../app/features/seller/components/SellerManagePages.tsx) lines 61-62 repeats this. [app/lib/seo.ts](../../../../app/lib/seo.ts) line 49 converts money for structured data. The existing admin settlement display uses BigInt parts but is local to one component. |

The README, architecture, ERD/DBML, checkout, fulfillment, AGENTS, and CLAUDE rules were inspected before this sketch. The governing constraint is server-owned calculation and Eden-derived frontend types. This candidate changes representation, not settlement funding, currency, commission, tax, or partial-return policy.

## Usage first

The seller frontend imports the existing formatters. It renders the exact API field without Number or division.

```ts
const wallet = await api.api.seller.wallet.get()
if (wallet.data) {
  formatters.currency(wallet.data.availableBalanceCents, wallet.data.currency)
  // Input string "9007199254740993" displays THB 90,071,992,547,409.93.
}
```

The wallet service works with bigint under its existing transaction lock. Its HTTP handler calls a transport adapter with a typed return.

```ts
const summary = await walletService.getSellerWallet(actor)
return walletSummaryDto(summary)
// Handler amount fields are strings. Eden infers strings from this return.
```

Analytics ranks bigint revenue before mapping a selected page to string DTOs. Ratings and conversion ratios remain Number. A bounded provider adapter explicitly converts a checked transaction amount to Number when the provider contract requires it.

```ts
const rows = await analyticsService.getProducts(actor, query)
return analyticsProductsDto(rows)
// Service compares bigint revenue with < and >. It never sorts money strings.
```

## Shape

Storage stays Prisma BigInt. Remove serializeBigInt and the PrismaClient type assertion from the client factory. Repositories return Prisma-derived records and bigint monetary sums. Services compute integer money with bigint. HTTP response adapters own canonical decimal strings. Frontend formatting owns locale and two-decimal presentation only.

```ts
// Repository contracts. No changes to locks or transaction ownership.
sumLedger(walletId: string, currency: string): Promise<bigint>
sumReservedPayouts(walletId: string, currency: string): Promise<bigint>

// Service shape. Entity fields remain derived from Prisma types.
type WalletSummary = {
  walletId: string
  shopId: string
  shopName: string
  currency: string
  availableBalanceCents: bigint
  sellerDebtCents: bigint
}

// Transport schemas compose the generated entity schema.
const MinorUnitString = t.String({ pattern: '^(0|[1-9][0-9]*|-[1-9][0-9]*)$' })
const LedgerDto = t.Composite([
  t.Omit(WalletLedgerEntryPlain, ['amount']),
  t.Object({ amount: MinorUnitString }),
])
type LedgerDto = Static<typeof LedgerDto>

function walletSummaryDto(summary: WalletSummary): WalletSummaryDto
function ledgerDto(entry: WalletLedgerEntry): LedgerDto
function formatMinorUnits(cents: string, locale: Locale, currency: string): string
function checkedTransactionNumber(cents: bigint): number
```

WalletSummaryDto uses one schema of derived projection fields and MinorUnitString. This is a computed business response, not a manually copied Prisma entity. Explicit adapters use .toString and preserve nullable values. Nested entity projections use the same composition with t.Omit and t.Composite. A generic deep mapper is optional only after the explicit adapters demonstrate its need. It must have a mapped return type, preserve Date types, reject unsupported object types, and receive standalone type/runtime tests. A JSON hook with an unchanged T is rejected.

Canonical strings permit zero and negative aggregates. They reject leading zeroes, -0, exponent notation, whitespace, and fractional cents. External operation inputs preserve existing positive safe-integer limits. They convert to bigint immediately after validation. Changing display precision does not authorize higher checkout/provider transaction limits.

Commission and allocations use bigint multiplication/division. Percentages and quantities remain bounded integers. Revenue sorting compares bigint values and returns -1, 0, or 1, then uses the existing stable ID tie break. Debt uses `economicBalance < 0n ? -economicBalance : 0n`. Payout comparisons use bigint(input.amount) against a bigint balance.

The shared formatter parses the validated string to bigint, separates whole units and a two-digit remainder, and uses Intl.formatToParts on the bigint whole amount. It replaces only the fraction part. Negative amounts smaller than one unit use a -0 sign probe so -1 cent displays -0.01. It preserves the existing THB display policy rather than adding a currency conversion feature. SEO price output uses an exact plain decimal string.

Internal caches need a versioned lossless codec before bigint services use them. One concrete design stores an envelope with `version`, ordinary JSON `data`, and a list of paths that originated as bigint. Decoding restores only those paths. ISO dates use the existing date handling. The envelope separates codec metadata from arbitrary model JSON and string IDs. A cache key version prevents old numeric/string entries entering the new typed path. This helper owns encode/decode as one operation. Callers keep remember(key, fetcher) and do not coordinate codec stages.

Boundary Discipline keeps representation changes at repository, cache, transport, and display boundaries. Type System Discipline replaces the current false Prisma T with runtime-agreeing bigint and string signatures. Migrate Callers Then Delete Legacy APIs requires the old global conversion and local Number display wrappers to disappear in the same coordinated application release.

## Migration scope and cost

This is a coordinated API representation change. It changes every money field in application responses, including derived wallet, analytics, order, and seller totals. It also changes exposed BigInt coin counts to exact integer strings unless their DTO explicitly checks a safe Number bound. Coins are units, not two-decimal money, and require their own integer display.

The inventory search found 240 Number calls in production backend modules and 29 frontend matches for currency formatting/division patterns. These counts include non-money ratings, pagination, and quantities. They are inspection inventories, not the number of required edits. Prisma has 61 BigInt fields. The first implementation inventory must associate each field with its repository arithmetic, cache, service DTO, route schema, Eden caller, form population, export, and test fixture.

| Unit | Concrete migration and final gate |
|---|---|
| Storage and cache | Remove the query serializer. Introduce versioned typed cache encoding. Assert raw Prisma bigint and cached bigint equal on miss/hit, with dates and null preserved. Regenerate only if Prisma annotations/config change. |
| Ledger and payouts | Change both repository aggregate interfaces to bigint. Change economic debt and comparison arithmetic. Keep transaction locks and existing per-withdrawal safe bounds. Test signed totals beyond safe range and an exact 1-cent difference. |
| Refund and checkout | Audit safe inputs at their first conversion. Keep original snapshot and allocation arithmetic bigint. Remove guarded round trips to Number where no external contract needs them. Prove rollback and same refund amounts with current fixtures. |
| Analytics and discovery | Sum and compare revenue/price bigint. Preserve count/rating ratios as Number. Rank before transport conversion. Test two rows whose revenue differs by 1 cent above safe range across two pages. |
| HTTP contracts | Compose generated schemas for monetary fields. Return typed string DTOs for every money response. Keep webhook protocol numeric and bounded unless provider integration contract is explicitly changed. Do not silently alter signed webhook bytes. |
| Frontend and exports | Move the exact formatter into a shared non-client utility, adapt useFormatters, remove local Number wrappers, update derived Eden callers, form defaults, SEO and CSV. Validate canonical strings without performing business arithmetic. |
| Final application gate | Prisma generation, complete typecheck, all unit/integration suites, real HTTP API/DB/browser money parity and production runtime verification. Temporary half-migrated application states cannot ship. |

No SQL column migration is required to restore exact bigint reads. PostgreSQL BigInt columns remain signed 64-bit. A single row above that database limit remains invalid. PostgreSQL SUM(bigint) returns numeric; Prisma's actual aggregate mapping beyond the signed 64-bit total requires a real DB test before any promise about an unbounded ledger sum. Rejecting a conversion at a checked external boundary must occur before financial writes and must roll back if invoked inside a transaction.

Historical data already persisted from rounded Numbers cannot be repaired by this representation change. Correct existing BigInt rows become readable exactly. Historical reconciliation remains an explicit separate operation with evidence, not a guessed backfill.

## Literal boundary experiment

[prototype-result.json](money-exact/prototype-result.json) records 12 input/display cases through an actual local Elysia response schema and Eden client. [typecheck.log](money-exact/typecheck.log) records the standalone typecheck with exit 0. The prototype infers the amount from Treaty.Data and verifies it extends string.

The literal values include MAX_SAFE -1, MAX_SAFE, MAX_SAFE +1, MAX_SAFE +2, all corresponding negatives, signed aggregate 18,014,398,509,481,981, -1, and zero. Six malformed display inputs reject. The positive aggregate derives from two independently safe rows of 9,007,199,254,740,991 minus one, but the expected total and decimal are literals. A negative aggregate plus a positive reserved payout produces literal debt 9,007,199,254,740,990.

The old Prisma replacer maps 9,007,199,254,740,993 to 9,007,199,254,740,992. The old Intl display at MAX_SAFE maps exact cents .91 to displayed .90 in the current Bun runtime. Both failures are recorded beside the passing candidate. The old cache replacer returns string after JSON decode rather than the original bigint.

Commands run from the repository root:

```powershell
bun docs/test-evidence/2026-10-04-audit-completion/money-exact/prototype.ts
bunx tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck docs/test-evidence/2026-10-04-audit-completion/money-exact/prototype.ts
```

The experiment performs no DB queries, Redis calls, application endpoint execution, or browser rendering. It demonstrates candidate transport/type/display agreement. Full DB to application UI proof remains required after implementation. No transaction safety conclusion comes from this isolated route.

## Alternatives and red flag screen

| Candidate | Exactness | Transaction safety | Type/runtime agreement | Compatibility and cost | Full-path proof |
|---|---|---|---|---|---|
| This bigint plus exact-string candidate | Preserves signed cents beyond safe Number range. Plain strings must never be sorted lexically as money. | Preserves existing locks. Arithmetic remains bigint before all writes. Requires real DB rollback/race validation. | Prisma runtime matches generated bigint. DTO schema and inferred Eden return both say string. Versioned cache restores bigint. | Largest caller migration. JSON number becomes JSON string. No DB column migration. Public consumers need coordinated release/version decision. | Local Elysia/Eden/display sketch passes. Application DB/cache/browser proof remains. |
| Checked bounded Number at repository | Rejects every unsafe read/sum. Exact safe cents still require the shared formatter. | Failure before mutations is clear, but lifetime ledger growth can make otherwise valid payouts/refunds unreadable. | Can use derived mapped Number record types with verified conversion, replacing false T. | Smaller application migration. Keeps JSON numbers and most current callers. Adds an operational balance ceiling. | Must test literal rejection and rollback at actual routes/DB. Does not prove support above MAX_SAFE. |
| Exact companion fields beside old amounts | Exact field is usable only by migrated callers. Existing fields can still be rounded. | Internal bigint still required. Duplicate output values risk consumers choosing the wrong field. | Types agree per field, but two monetary contracts persist. | Smaller first UI change, permanent dual contract or another migration. | Requires a caller census to prove every financial decision uses the exact field. |
| Global JSON bigint string replacer | Wire bytes are exact only after any prior Number losses. | Does not repair aggregation or financial comparisons. | Inferred Eden types stay bigint/number while runtime is string. | Minimal edits, latent runtime bugs across every caller. | Rejected by source trace and cache type mismatch. |

The exact-string helper hides only the unavoidable transport encoding. A new Money class, general policy registry, or service pass-through layer does not earn its cost here. Explicit DTOs keep monetary projection knowledge close to each route. The shared formatter removes display duplication. Cache encoding stays private to CacheService. This avoids exposing serialization stages to service callers.

## Synthesis decision and remaining risks

The parent owns synthesis with candidate B. This candidate recommends exact-string transport when the completion requirement includes successful lifetime aggregates beyond MAX_SAFE. A bounded Number solution can close silent rounding by rejecting it, but cannot claim successful processing of those aggregates.

External consumers of number-valued APIs may require a versioned deployment. That is a compatibility fact to inventory, not a new business policy. Provider numeric webhook/handoff contracts need explicit safe conversion and preserved signatures. Existing persisted rows may contain historical arithmetic damage. Aggregate mappings beyond the database column range, JSON cache metadata, signed zero display, and all Eden consumers need actual execution gates.

The first implementation step is a failing application test for a literal signed wallet aggregate above MAX_SAFE and matching API/DB/UI cents, followed by the typed repository/DTO/cache/formatter migration.
