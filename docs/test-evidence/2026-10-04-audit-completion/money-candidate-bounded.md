# Bounded numeric money candidate

This candidate preserves numeric money in the current API. It accepts exact integer minor units between -9007199254740991 and 9007199254740991. It rejects a result outside that range before conversion to `number`. Rejection prevents silent rounding. Rejection does not support arbitrary lifetime aggregates.

This is a source investigation and design proposal. No application code, database contents, tests, or commits changed for this candidate. The literal outcomes below are the proposed acceptance contract, rather than measured implementation results.

## Work stages

- [x] Ground. Trace the Prisma client, repository transaction bindings, arithmetic, API types, and UI formatting.
- [x] Sketch. Write caller usage, derive types, and screen the candidate against the architect red flags.
- [ ] Agree. The parent compares this candidate with the exact-string candidate.
- [ ] Implement. Skip for this read-only assignment.
- [ ] Scrap. Skip until the parent evaluates the candidates.

The throughput checkpoint is one structural numeric boundary, one exact formatter, and a mechanical migration inventory. A local `Number.isSafeInteger` sweep alone cannot repair already rounded database results. The parent must choose the aggregate contract before distributing implementation work.

## Problem and observed runtime

`server/lib/prisma.ts:14` uses `JSON.stringify` with `Number(bigint)` and then `JSON.parse`. Its query extension runs that conversion after `await query(args)`. The exported client uses an `as unknown as PrismaClient` cast, so a money property is declared `bigint` while the application receives `number`. The round trip also converts `Date` into a string and converts `Prisma.Decimal` through its JSON representation. It does not preserve those prototypes.

`prisma/schema.prisma` declares money and coin balances as `BigInt`. Decimal fields also exist for ratings and latitude/longitude. `generated/prismabox/ProductVariant.ts:16` describes `price` as `t.Integer()`, while generated Prisma model fields remain `bigint`. Those are separate storage and numeric wire contracts. Changing generated files manually is forbidden. A transport projection must make the distinction explicit.

`server/context/app-context.ts` injects the shared exported client into repositories. `PrismaWalletRepository.transaction` binds the interactive transaction client to a new repository and sets `inTransaction = true`. Its `sumLedger` and `sumReservedPayouts` aggregate `BigInt` amount columns, then call `Number` at `wallet.repository.ts:117` and `:124`. `WalletService.getSellerWallet` locks the wallet before reading both sums. That lock protects consistency but cannot repair rounding that occurred inside the client extension.

The same transaction seam exists in Checkout, Payment, Refund, Return, Inventory, and Payout. Lock queries use `$queryRaw`. Search and Catalog use array `$transaction` reads for groups and price ranges. A new wrapper must preserve Prisma promises for those array transactions. Replacing all delegate methods with ordinary `async` functions can lose the transaction protocol and is not an acceptable adapter.

Raw SQL currently supplies lock rows, health checks, and a vector-search score. `server/modules/ai-search/vector-search.adapter.ts:160` calls `$queryRawUnsafe<VectorRow[]>` and casts the SQL score to `float8`. Its score is not money. No production raw `SUM` money query was found by `rg -n 'SUM\(|sum\(|\$queryRaw' server --glob '*.ts' --glob '!*.test.*'`. This search does not prove future raw money queries are safe. PostgreSQL `SUM(bigint)` can return `numeric`, so a future raw aggregate must parse an exact integer string or Decimal without passing through `Number` first.

Scripts such as `scripts/verify-numeric-snapshots.ts` and `scripts/production-load-test.ts` construct an independent Prisma client. Their storage results do not pass through the application extension. Integration tests that construct raw clients cannot establish production extension behavior by themselves.

## Caller usage

Repository records retain generated storage types and exact `bigint` values. A service exposes bounded numeric money only at a declared DTO boundary.

```ts
const exactBalance = await walletRepository.sumLedger(walletId, currency);
const exactReserved = await walletRepository.sumReservedPayouts(walletId, currency);
return {
	walletId,
	currency,
	availableBalanceCents: toSafeMinor(exactBalance),
	sellerDebtCents: toSafeMinor(max(0n, -(exactBalance + exactReserved))),
};
```

`sumLedger` and `sumReservedPayouts` become `Promise<bigint>`. Payout comparison uses the exact balance while the wallet lock is held. A representable payout request can remain valid even when the exact account aggregate exceeds the numeric display limit. A bounded DTO failure does not authorize changing the ledger or returning zero.

Existing numeric services can keep their public numbers and replace unsafe arithmetic with one exact operation at the calculation boundary.

```ts
const lineTotal = multiplyMinor(toSafeMinor(item.unitPrice), item.quantity);
const shopSubtotal = sumMinor(shopItems.map((item) => item.lineTotal));
const total = sumMinor(shopSubtotals);
```

Each helper performs its operation with `bigint`, then validates the final numeric result. A signed sum validates the final total rather than every intermediate partial sum. `[9007199254740991, 1, -1]` has a valid final result of 9007199254740991 and must not fail because of iteration order.

All money display callers use the same formatter.

```ts
formatMinorCurrency(9007199254740991, "en-US", "THB");
// Expected amount digits are 90,071,992,547,409.91.
formatMinorCurrency(-1, "en-US", "THB");
// Expected amount digits are -0.01, with locale-specific currency placement.
minorToDecimalText(9007199254740991);
// Expected SEO/input text is "90071992547409.91".
```

Currency presentation never computes `Number(cents) / 100`. The formatter validates numeric inputs, converts the safe integer to `bigint`, and formats whole units and the two minor-unit digits separately. The API still defines one hundred minor units per currency. Supporting currency-specific exponents would be a separate contract change.

## Shape and ownership

The shape contains exact storage values and one bounded transport representation. Boundary Discipline places conversion at the numeric DTO boundary. Type System Discipline keeps Prisma storage records as generated `bigint` and derives projected records instead of casting a transformed client back to `PrismaClient`. Model the Domain gives every numeric amount the same range contract.

```ts
declare const safeMinorBrand: unique symbol;
type SafeMinor = number & { readonly [safeMinorBrand]: true };

type BoundedDto<T> =
	T extends bigint ? SafeMinor :
	T extends Date | Prisma.Decimal | Uint8Array ? T :
	T extends readonly (infer Item)[] ? BoundedDto<Item>[] :
	T extends object ? { [Key in keyof T]: BoundedDto<T[Key]> } :
	T;

function toSafeMinor(value: bigint | number): SafeMinor;
function sumMinor(values: readonly SafeMinor[]): SafeMinor;
function multiplyMinor(value: SafeMinor, integerQuantity: number): SafeMinor;
function toBoundedDto<T extends PrismaResult>(value: T): BoundedDto<T>;
function formatMinorCurrency(value: SafeMinor | bigint, locale: string, currency: string): string;
function minorToDecimalText(value: SafeMinor | bigint): string;
```

These are design signatures, not compiled declarations. `PrismaResult` must be restricted to the actual scalar, array, and plain-record shapes returned by Prisma, including its opaque scalar classes. It must not claim to transform every possible JavaScript class. Generic conditional mapping alone cannot distinguish an arbitrary class from a plain record.

The structural projector handles bigint scalars, arrays, and plain records. It retains `Date`, `Prisma.Decimal`, and `Uint8Array` values without JSON conversion. Plain records preserve their null or Object prototype. Unknown class instances fail at this boundary, unless an explicit scalar adapter supports them. Do not reconstruct a class with `Object.create` because private state and internal slots may be lost. Input values stay unchanged. Missing properties and `undefined` stay missing and undefined. Cyclic input rejects instead of recursing forever.

The preferred storage client removes the lossy serializer entirely. Generated types then describe actual repository values. Existing pure settlement calculations retain their bigint records. Services that already project individual money fields replace `Number` with `toSafeMinor`. Service endpoints that currently return generated rows directly use a typed `toBoundedDto` before their result reaches Elysia. Their declared result becomes `BoundedDto<Prisma.GetPayload<...>>`, rather than the original generated payload. Eden then sees numeric output for numeric DTO fields. The exact model shape still comes from Prisma.

A query extension that only validates and returns the original object can preserve storage types. It is optional and insufficient by itself. A global rejection of every out-of-range bigint also rejects unrelated lifetime counters when an operation needs only a small current balance. A per-field policy at the DTO boundary avoids that coupling. Reads used only for exact financial decisions remain bigint.

No module should return an unsafe number, clip an amount, replace an overflow with zero, or use a fallback product price after a money conversion error. Network/cache parsers must reject unsafe money separately from ordinary fractional scores and ratings.

## Actual arithmetic paths to migrate

| Source | Observed operation | Required bounded behavior |
|---|---|---|
| `server/modules/wallet/wallet.repository.ts:115` | `_sum.amount`, then `Number` | Keep sum exact and convert only the public summary. |
| `server/modules/payout/payout.repository.ts:96` | Ledger aggregate for withdrawal decisions | Compare exact bigint while holding wallet lock. |
| `server/modules/wallet/wallet.service.ts:90` | Legacy `lineTotal` number reduction | Sum exact values and validate before creating ledger entries. |
| `server/modules/wallet/wallet.service.ts:266` | `balance + reserved` debt calculation | Use exact signed sum before bounded output. |
| `server/modules/cart/cart.service.ts:230` | Price conversion, price times quantity, grouped subtotals | Validate each source price and calculate exact line/group/final totals. |
| `server/modules/checkout/checkout-quote.evaluator.ts:139` | Numeric subtotal and shipping accumulation | Preserve existing policy but use exact sum and multiplication. |
| `server/modules/promotion/promotion.service.ts:533` | Shop subtotal addition and multiplication | Use safe total helpers before coupon comparisons. |
| `server/modules/payment/payment.repository.ts:315` | Cashback from subtotal minus discount, debt offset | Compute exact differences and integer ratios before conversion. |
| `server/modules/affiliate/affiliate.service.ts:217` | Item subtotal reduction and discount subtraction | Keep commission base exact, then bound the numeric API. |
| `server/modules/admin/admin.repository.ts:564` | Lifetime order/refund/payout/commission aggregates | Reject out-of-range numeric DTOs explicitly. Exact-string alternative preserves availability. |
| `server/modules/seller/seller-dashboard.service.ts:284` | Lifetime/daily/monthly sales and recent-order totals | Use exact sums. Apply Asia/Bangkok date boundaries independently. |
| `server/modules/product-analytics/product-analytics.service.ts:393` | Repeated `revenue += Number(lineTotal)` | Keep each bucket and global total exact until output. |
| `server/modules/search/search.repository.ts:319` | Price min/max conversion | Validate exact scalar price before numeric output. |
| `server/modules/catalog/catalog.repository.ts:984` | Price min/max conversion | Apply the same exact bound. |
| `server/modules/fraud/fraud.repository.ts:132` | Order/refund amount conversion before rule evaluation | Use exact threshold comparison or explicit bounded rejection. |
| `server/modules/promotion/promotion.service.ts:141` | Coin balance and lifetime totals | Bound displayed values, keep exact spend/restoration decisions. |
| `app/features/product/queries.ts:1399` | Permissive numeric/bigint/string parsing | Use money-specific strict parsing. Leave score/rating parsers separate. |

`server/modules/wallet/wallet.service.ts:186` already converts a bigint calculated earning and checks `Number.isSafeInteger`. That check cannot recover original precision after the shared client has rounded a source field. Removing the serializer makes its bigint calculations operate on original data.

`server/modules/cache/cache.service.ts` encodes bigint as strings and revives date-shaped strings. It does not revive bigint. Therefore cache only fully projected DTOs in this candidate. Do not return raw storage payloads from a cache whose generic type still claims `bigint`. Change the cache key version or evict old numeric payloads after migration so old rounded values cannot bypass the new boundary.

## Current display callers

The inspected search was `rg -n 'formatMoney|formatCurrency|toFixed\(2\)|/ 100|Intl.NumberFormat' app --glob '*.ts' --glob '*.tsx' --glob '!*.test.*'`. The following formatter owners need the shared exact implementation.

- `app/i18n/client.tsx:83` owns `formatCurrency` and `useFormatters().currency`.
- `app/features/buyer/api.ts:659` owns buyer formatting used by product, checkout, cart, wishlist, deals, followed shops, payment return, and orders.
- `app/features/affiliate/api.ts:112` formats commission amounts.
- `app/features/seller/components/SellerProductPages.tsx:736` formats catalog prices and price ranges.
- `app/features/seller/components/SellerManagePages.tsx:61` formats dashboard, wallet, and flash-sale amounts.
- `app/features/seller/components/SellerProductAnalyticsPage.tsx:224` formats revenue.
- `app/features/admin/components/AdminFlashSaleManager.tsx:23` formats sale prices.
- `app/features/catalog/components/AdminCatalogManager.tsx:76` and `AdminCatalogEditPage.tsx:86` format variant prices.
- `app/features/admin/components/AdminBackofficeTables.tsx:41` formats payouts and lifetime reports.
- `app/features/admin/components/AdminOperationsTables.tsx:77` formats order and refund amounts.
- `app/features/admin/components/AdminProductModerationDetail.tsx:146` converts prices before calling the i18n formatter.
- `app/features/marketplace/components/MarketplaceGuestHome.tsx:67` defines a separate locale formatter. Signed-in MarketplaceHome uses the i18n formatter.
- `app/lib/seo.ts:48` produces a decimal price string with floating division and `toFixed`.
- `app/features/admin/components/AdminSettlementRefundActions.tsx:20` already splits bigint units and fraction for positive cash refunds. Reuse the shared implementation rather than retaining a special refund formatter.

The shared formatter must handle negative amounts below one whole unit. Feeding `minorUnits / 100n` directly to Intl loses the sign for `-1n`. Render the negative sign with locale-aware parts and the absolute whole amount, then replace the fraction with localized minor digits. The existing refund helper also computes a negative remainder without taking its absolute value, so it cannot become the general signed formatter unchanged.

`app/lib/input-decimal.ts` already parses decimal input with bigint before checking MAX_SAFE. Its `minorUnitsToDecimalInput` accepts arbitrary bigint/string, so its input policy must agree with the chosen DTO and formatter. Money charts, chart tooltips, and copied values also need inspection after the call sites migrate. A chart's numeric coordinate can be approximate, but the displayed amount must use the exact source field. A generic `toLocaleString()` on a fractional whole-unit conversion is not evidence of exact money display.

## Literal acceptance contract

| Input or operation | Expected result |
|---|---|
| `9007199254740991n` | Exact numeric DTO 9007199254740991. Display amount digits `90,071,992,547,409.91`. |
| `-9007199254740991n` | Exact numeric DTO -9007199254740991. Display amount digits `-90,071,992,547,409.91`. |
| `9007199254740992n` | Explicit `MONEY_OUT_OF_RANGE`. No numeric DTO. |
| `9007199254740993n` | Explicit `MONEY_OUT_OF_RANGE`. Never return 9007199254740992. |
| `-9007199254740992n` or `-9007199254740993n` | Explicit `MONEY_OUT_OF_RANGE`. No clipping. |
| Numeric `9007199254740992` | Explicit `MONEY_OUT_OF_RANGE`, even though that particular integer is representable in IEEE-754. |
| Numeric fraction, NaN, or Infinity | Explicit invalid-money error. |
| Safe signed entries `[9007199254740991, 1]` | Aggregate rejection. Individual safety is insufficient. |
| Safe signed entries `[9007199254740991, 1, -1]` | Exact aggregate 9007199254740991. |
| `9007199254740991` cents times quantity 2 | Exact intermediate 18014398509481982n, then aggregate rejection. |
| `-1` cent | Exact decimal `-0.01`, including the negative sign in currency display. |
| Row containing Date, Decimal rating, byte array, and safe bigint | Same scalar instances/prototypes and an exact projected integer. No JSON round trip. |
| Unsafe amount reached before a second write inside an interactive transaction | Throw and verify rollback of all writes. |
| Post-query validation failure after an autocommit write | The failure alone does not prove rollback. Move the write and validation into a transaction. |
| Coin lifetime counter above MAX_SAFE with small spendable balance | Exact internal coin decisions remain valid. Its bounded lifetime display rejects. |
| Historical aggregate above MAX_SAFE | Explicit report failure. This candidate does not produce an exact numeric API total. |

The production-path proof must call the actual exported client, ordinary reads, nested selected relations, aggregates, callback transactions, and array transactions. It must also exercise a bound repository from inside a refund/checkout transaction, not only a raw test Prisma client. Literal totals above establish expected behavior independently of the implementation under test.

## Transactions and error semantics

The monetary conversion error needs one stable domain code, such as `MONEY_OUT_OF_RANGE`, and must survive service/route error handling. HTTP mutation input should reject unsafe integers with 400 or the existing validation status. An inconsistent stored order amount can be a 409 conflict. A lifetime report overflow is a representation limit, not a fabricated zero balance. The API must return a typed explicit failure and UI must display a translated failure state.

Validation after `await query(args)` does not roll back an autocommit mutation. A write returning an out-of-range computed value may already be persisted. Input validation alone also does not protect `increment` results or ledger sums. Every money mutation that claims a numeric bound must validate the relevant final value under its transaction/lock before commit. Keep the existing explicit transaction binding flags. Do not create nested transactions to implement conversion.

Keeping exact internal wallet sums reduces this risk. It also means this bounded candidate must not define the database as bounded if only the wire representation is bounded. Requiring every stored lifetime counter and ledger sum to fit MAX_SAFE would change business availability and needs a documented account limit. It would prevent a shop from receiving otherwise valid earnings once its lifetime/account aggregate exceeds the limit.

## Comparison with exact-string migration

| Rubric | Bounded numeric DTO | Exact-string money DTO |
|---|---|---|
| Exactness | Exact for accepted values, explicit rejection otherwise. | Exact for values within PostgreSQL storage capacity and arbitrary exact aggregate totals. |
| Transaction safety | Exact storage plus rollback-aware numeric boundaries. Global post-query coercion is rejected. | Exact storage plus string projection avoids conversion overflow. Business transaction checks remain necessary. |
| Runtime/type agreement | Generated bigint storage records plus derived bounded DTOs. | Generated bigint storage records plus derived decimal-string DTOs. |
| Compatibility | Public successful payloads remain numbers. Overflow becomes a new explicit failure. | Public money fields become strings. All consumers and validators must migrate. |
| Lifetime report availability | A growing report eventually exceeds MAX_SAFE and fails. | Report can continue to show the exact amount. |
| Display cost | Shared exact formatter and all money parsers still need migration. | Shared exact formatter and all money parsers need migration. |
| Actual-path proof | Shared client, repository/transaction, API, cache, and browser checks. | The same path checks, plus wire-schema and old-consumer compatibility checks. |

The bounded candidate has less API compatibility cost. It still requires the structural client repair, safe arithmetic, typed projections, strict cache/network parsing, and the full display migration. It is not a cheap global replacement of `Number` with `checkedNumber`.

For the user's request to close every numerical gap, exact-string lifetime aggregate DTOs are the stronger final contract. A bounded policy can be an explicit compatibility choice for transactional values, but rejection must remain a documented limitation for lifetime totals. Do not mark arbitrary lifetime aggregate support complete under this candidate.

## Design red-flag screen

- A typed DTO projector hides range conversion and object preservation behind one operation. Repeated route wrappers that expose raw storage and conversion stages would leak representation policy.
- A cast of an extended client back to `PrismaClient` fails runtime/type agreement and is rejected.
- A proxy that wraps each delegate and transaction method in ordinary promises risks losing Prisma transaction behavior and is rejected.
- A helper per feature would repeat the range and formatting policy. One money module replaces those helpers.
- A universal object serializer would transform unknown classes and Decimal fields without domain authority. Restrict the projector to declared Prisma result shapes and scalar adapters.
- A bounded global read guard would couple spendable balance operations to unrelated lifetime fields. Keep storage exact and project only the needed DTO.

## Minimum implementation sequence

1. Remove the lossy Prisma serializer. Keep exact generated storage types. Prove Dates, Decimal, bigint, callback transactions, and array transactions on the exported client.
2. Add the safe converter and exact sum/multiplication helpers. Add literal boundary cases and stable error mapping.
3. Migrate wallet/payout aggregates to bigint decisions. Convert public summaries only at output. Verify rollback and concurrent refund/payout behavior using the real repository transaction seam.
4. Migrate cart, checkout, promotion, affiliate, payment coins, seller dashboard, analytics, admin reports, search, catalog, and fraud amounts. Derive direct-row DTO types from generated payloads.
5. Add one exact locale formatter and exact decimal-text formatter. Replace every formatter owner listed above. Add negative-subunit and MAX_SAFE UI/SEO fixtures.
6. Change cache version and strict money parsers. Verify cold and warm cache payloads agree with API output and generated wire types.
7. Run API/browser flows on both signed and maximum accepted amounts. Retain explicit failure evidence for larger historical aggregates. Report that limit separately from exactness failures.

## Synthesis decision

Pending parent synthesis with candidate A. This candidate recommends preserving numbers only if numeric API compatibility is an explicit priority. It does not recommend a numeric-only final architecture for unbounded lifetime financial reporting.
