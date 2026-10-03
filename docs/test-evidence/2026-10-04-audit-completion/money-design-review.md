# Money design review

Use candidate A, exact bigint calculation with decimal-string money responses, as the base. Graft candidate B's bounded mutation inputs, transaction checks, scalar preservation, and caller inventory. A numeric-only response contract cannot satisfy successful lifetime totals above `Number.MAX_SAFE_INTEGER`.

This is an independent same-family review. Both candidate documents were read end to end. Key application sources and candidate A's saved prototype code and results were inspected. This reviewer did not run tests, query a database, implement application code, or commit. The candidate prototype is measured evidence supplied by its author. The application conclusions below are source findings or design judgments.

## Review stages

- [x] Ground the original storage, calculation, cache, transport, and frontend ownership.
- [x] Compare the two complete sketches against the stated rubric and architect red flags.
- [x] Recommend a base and concrete grafts to the parent.
- [ ] Implement. This review owns only this document.
- [ ] Verify the final application. Candidate evidence cannot replace that gate.

## Scores and recommendation

Scores range from 1, weak, to 5, strong. Design capability and executed proof are scored separately. Compatibility measures migration cost, so a higher score means a smaller change.

| Criterion | A, exact strings | B, bounded numbers | Reason |
|---|---:|---:|---|
| Exactness, including successful lifetime totals above MAX_SAFE | 5 | 2 | A preserves signed cents. B explicitly rejects otherwise legitimate aggregate displays beyond its numeric bound. |
| Financial transaction safety | 4 | 4 | Both keep exact decisions and existing locks. Both still require actual transaction and rollback proof. B explains the autocommit trap particularly well. |
| Type, runtime, and cache agreement | 4 | 4 | Both remove the false Prisma return type and derive transport types. A's versioned cache codec and B's projected-only cache are proposed designs, not application proof. |
| Compatibility and migration cost | 2 | 4 | A changes money response types throughout the current application. B preserves successful numeric payloads, but adds report failures. Both require more than a formatter replacement. |
| Runnable application proof | 3 | 1 | A supplies an executed isolated Elysia/Eden/display sketch and typecheck result. B supplies acceptance expectations only. Neither supplies production-client, database, Redis, or browser proof for this migration. |

The scores total 18 for A and 15 for B. This sum is secondary to the required behavior. B cannot win the successful aggregate requirement by having lower compatibility cost.

No external API consumers were observed in the supplied context. That does not prove there are none. The current Eden application can migrate in one coordinated release. Record the response change in the API documentation and migrate every observed application caller. Preserve bounded provider protocol fields separately.

## Traced model

The database owns signed integer storage. The repository owns exact selected records and sums. The service owns money rules and financial writes. The HTTP adapter owns decimal-string responses. The frontend owns locale presentation. CacheService owns lossless persistence of the service values it caches.

The current runtime crosses these boundaries in the wrong shape.

1. [server/lib/prisma.ts](../../../../server/lib/prisma.ts) converts every bigint to Number through a JSON round trip, then declares the result as the original generic type. The exported extended client is asserted back to `PrismaClient`. Dates also become strings. Source findings confirm both candidates' core diagnosis.
2. [wallet.repository.ts](../../../../server/modules/wallet/wallet.repository.ts) and [payout.repository.ts](../../../../server/modules/payout/payout.repository.ts) return Number aggregates. A wallet lock protects the read sequence but cannot recover a rounded cent.
3. [wallet.service.ts](../../../../server/modules/wallet/wallet.service.ts) later reconstructs snapshot amounts with BigInt and converts earnings and ledger entries back to Number. Reconstruction cannot repair precision lost in step 1. Legacy reductions and debt calculation require an explicit arithmetic migration.
4. [cache.service.ts](../../../../server/modules/cache/cache.service.ts) turns bigint into decimal strings and revives only ISO dates. Its `get<T>` assertion therefore gives bigint callers different runtime types on a miss and a hit.
5. [checkout.routes.ts](../../../../server/modules/checkout/checkout.routes.ts) validates money response fields as numbers or integers. [payment.types.ts](../../../../server/modules/payment/payment.types.ts) also defines numeric mock detail and webhook amounts. A global response replacer would conflict with these schemas and inferred client types.
6. [app/lib/eden.ts](../../../../app/lib/eden.ts) derives from the application routes. The frontend has no custom exact money decoder. [app/i18n/client.tsx](../../../../app/i18n/client.tsx), local formatters, and [app/lib/seo.ts](../../../../app/lib/seo.ts) divide Number cents before display.

Candidate A's [prototype result](money-exact/prototype-result.json) records the literal amount `9007199254740993` surviving Elysia and Eden as a string and displaying `.93`. It records the old serializer producing `9007199254740992` and the old MAX_SAFE formatter displaying `.90` instead of `.91`. The prototype code checks a string-inferred Eden field. Its stated limits correctly exclude application endpoints, PostgreSQL, Redis, and browser execution.

## Grafts and revisions

Retain these parts of A.

- Keep Prisma rows, monetary sums, funding allocations, debt, and payout comparisons exact as bigint.
- Return canonical signed decimal minor-unit strings for application money responses. Schema, runtime bytes, and Eden types must all agree.
- Use one exact shared currency formatter and one exact decimal-text formatter. Keep zero, negative subunit amounts, nullable values, and THB's existing two minor digits explicit.
- Compare bigint prices and revenue before pagination. Money strings must not use lexical ordering or Number subtraction.
- Version cache storage and preserve bigint on both cache misses and hits.

Graft these constraints from B.

- Keep individual checkout, coupon, withdrawal, provider, and other transactional inputs bounded where their existing contract requires it. A larger reporting capability does not silently enlarge a payment operation.
- Validate final monetary writes inside their existing transaction before commit. Throwing after an autocommit mutation has completed does not prove rollback.
- Preserve Prisma promises in array transactions and reuse explicitly bound transaction repositories. Do not replace delegate methods with ordinary async proxy functions.
- Define the admitted scalar types for a structural adapter. Dates, Decimal ratings and coordinates, bytes, null, and missing properties require explicit preservation. Reject unsupported classes instead of casting their transformed values back to their original type.
- Distinguish money, coin counts, ratings, percentages, quantities, and pagination during the migration. A search for Number calls is an inventory, not a replacement script.

A's cache envelope with bigint paths is viable. It must keep arbitrary JSON data separate from codec metadata and validate decoded paths. Numeric-looking IDs or user strings must stay strings. If a cached payload includes Decimal, preserve its actual runtime contract or project it deliberately before caching. Date-shaped free-text strings must not acquire a Date merely because the existing reviver recognizes their pattern. These are type-agreement checks, not a new business rule.

## Missing conversions and route gotchas

The following source findings need explicit implementation inventory entries.

| Area | Source finding | Required treatment |
|---|---|---|
| Buyer adapters | [buyer/api.ts](../../../../app/features/buyer/api.ts) reads prices, coupon money, order amounts, and checkout totals through `readNumber` or `optionalNumber`. Cart fallback totals also multiply and sum prices on the frontend. | Migrate money fields to Eden-derived exact response values. Eliminate fallback business calculations rather than retaining rounded substitute totals. Counts can retain their separate numeric parser. |
| Product adapters | [product/queries.ts](../../../../app/features/product/queries.ts) accepts bigint and string through Number, uses Math.min/Math.max on variant prices, and derives discounts from these values. | Use strict money parsing and exact comparisons. Preserve fractional rating and score handling separately. Displayed discount calculations need an explicit presentation-only contract. |
| Catalog frontend | [AdminCatalogManager.tsx](../../../../app/features/catalog/components/AdminCatalogManager.tsx) and [AdminCatalogEditPage.tsx](../../../../app/features/catalog/components/AdminCatalogEditPage.tsx) sort variants through Number subtraction. | Compare exact values. Format and populate edit inputs without a floating major-unit round trip. |
| Seller wallet | [SellerManagePages.tsx](../../../../app/features/seller/components/SellerManagePages.tsx) converts available balance through Number and compares debt numerically. | Pass the exact amount to the shared formatter and use an exact sign comparison for the debt indicator. |
| Admin events and audit | [admin.service.ts](../../../../server/modules/admin/admin.service.ts) converts refund money inside audit metadata and notification payloads. | Include these JSON payloads in the money contract inventory. Stringify the amount deliberately before persistence or delivery. Exact UI responses alone do not cover audit evidence. |
| Search and catalog price filters | [search.routes.ts](../../../../server/modules/search/search.routes.ts) and [catalog.routes.ts](../../../../server/modules/catalog/catalog.routes.ts) accept `t.Number` minimum and maximum prices. | Require exact integral minor units with a declared bound, or an exact string query parser. Reject fractions and unsafe values before query construction. |
| Generated model schemas | ProductVariant and WalletLedgerEntry generated Prismabox schemas define bigint fields as `t.Integer`. Catalog create/update picks inherit that shape. | Compose response string schemas from generated models. Override or constrain mutation money fields through composition. Never edit generated files manually. |
| Checkout response | The quote has explicit numeric amount schemas, including nested item and shop fields. Checkout commitment has numeric `totalCents`. | Change every monetary response member together. A typed helper on an unrelated wallet route cannot fix these schemas. |
| Payment detail and webhook | Mock detail and provider webhook share numeric monetary schema patterns. | Convert the application's mock detail response to exact strings. Retain a separately bounded provider webhook protocol and unchanged signed bytes. Numeric webhook validation must reject fractional or unsafe amounts. |
| Major-unit inputs | Promotion `salePriceBaht` and seller `shippingFeeBaht` originate as Number form values. The flash-sale route accepts a Number major-unit price. | Use a decimal string or safe integer cents payload from the original input text. At the safe-cent ceiling, Number major-unit transport has already lost cents before the backend receives it. |
| Coins | Promotion and checkout convert BuyerCoinWallet bigint fields to Number. Lifetime counters can exceed safe range even when the requested spend is small. | Keep spend and restoration decisions exact. Display exact integer coin strings using an integer formatter. Do not format coins as two-decimal currency. |
| Analytics and reports | Product analytics buckets sum Number line totals. Admin reports and affiliate reports convert aggregate sums. | Keep sums and ordering exact until response conversion. Test one-cent differences above MAX_SAFE across pagination. |
| DTO passthrough | Several routes return service records without explicit response schemas. | Give adapters mapped or schema-derived return types that Eden can infer. Check nested relations and nullable amounts. Returning raw bigint to Elysia fails JSON serialization. |

Candidate B's raw-SUM inventory was checked with its stated search. No production raw SQL money SUM was observed. The administrative commission conversions inspected are ordinary selected Prisma rows. PostgreSQL `SUM(bigint)` aggregate behavior beyond signed 64-bit still needs a real database test. A promise of arbitrary exact aggregate totals cannot rest on a TypeScript return type alone.

Historical persisted amounts may already contain errors caused by previous Number arithmetic. Removing the serializer repairs future reads of exact rows. It does not infer the original value of damaged rows. Keep reconciliation evidence and mutation decisions separate.

## Architect red flags

| Red flag | A | B | Synthesis rule |
|---|---|---|---|
| Shallow module | Explicit DTOs and a single formatter hide useful encoding behavior. A Money class is unnecessary. | A single converter hides range checks. Helper-per-feature variants repeat the policy. | Use one shared representation module and small route-owned projections. Do not add wrapper layers that forward unchanged records. |
| Information leakage | Encoding details can leak if every caller invents string validation or cache metadata handling. | Range policy can leak through repeated safe checks and ad hoc fallback amounts. | Parse at boundaries. Keep cache codec private and expose money values, not encoding stages. |
| Temporal decomposition | A separate load/encode/cache/decode sequence would force callers to coordinate representation. | A proxy validation stage can separate checks from mutation commit. | CacheService completes cache encoding itself. Financial services complete validation and writes under the existing transaction. |
| Pass-through methods | A DTO adapter earns its place by changing and typing the wire representation. | A converter earns its place by establishing an exact numeric bound. | Reject unchanged forwarding classes or service methods added only for migration choreography. |

Both candidates reject the global JSON replacer as a complete solution. Both reject assertions that declare transformed Prisma records as unchanged. Those rejections are correct.

## Implementation ownership and verification

Give backend ownership of exact repository arithmetic, wallet and payout gates, cache codec, response schemas, typed DTO adapters, and provider-bound conversions. Give frontend ownership of shared formatters, Eden-derived money callers, comparisons, form text, structured data, and display fixtures. Share only the documented decimal-string contract and the money representation module. The two owners must coordinate the exported signatures before migration starts.

Backend services should not depend on frontend formatters. Frontend adapters should not import Prisma entities as their response contract. Both sides must finish before the application can be reviewed as runnable. Split commits only at verified units that preserve this final coordinated behavior.

The final gate needs these actual application observations.

- Read an exact row and a signed aggregate through the exported production Prisma client, including selected relations, callback transactions, and array transactions. Prove Date and Decimal behavior.
- Store independently safe ledger rows with literal sum `18014398509481981`. Read the wallet through the actual API and browser. Match the database, decimal-string response, and `.81` display. Repeat for a negative balance and nonzero reserved payouts.
- Execute a bounded payout from an above-MAX_SAFE positive exact wallet balance. Verify its exact one-cent decision under the existing lock. Test a negative/debt case and rollback after a late failure.
- Compare cold and warm Redis results through actual catalog, search, and seller handlers. Prove types, cents, dates, nulls, and invalidation agree.
- Exercise ranking and pagination for two literal revenues differing by one cent above MAX_SAFE. Stable ties require the existing deterministic ID ordering.
- Test the actual request schemas at accepted limits, fractional cents, unsafe numeric inputs, decimal text inputs, and signed webhook verification. Keep the provider signature protocol separate.
- Run the complete typecheck, unit tests, integration tests, build, and UI parity checks. Include signed subunit amounts, MAX_SAFE `.91`, above-MAX_SAFE amounts, locale changes, and edit-form text.

The controlling principles were read in full. Type System Discipline changes the choice from a false generic Prisma T to exact storage and schema-derived string responses. Boundary Discipline places conversions and input checks at database, cache, protocol, and display boundaries. Unslop and Technical Writing shape this review as an evidence-based explanation with separate measured, proposed, and unverified claims.
