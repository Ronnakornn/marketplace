# Commerce numeric audit notes

This reference records source inspection of baseline commit `ed2093b` on 2026-10-04. It covers cart, checkout, catalog, inventory, shipment quantities, order projections, and buyer amount displays. The inventory and findings describe that baseline. Verification after changes appears at the end. Source evidence proves implementation choices. Runtime outcomes remain hypotheses until a regression or integration test reproduces them.

## Formula and rule inventory

All money examples use integer satang. One baht is 100 satang. Prisma stores money in `BigInt` columns. `server/lib/prisma.ts:14` converts every result `bigint` to a JavaScript number.

| Flow | Current formula or rule | Source |
| --- | --- | --- |
| Cart quantity | Add uses existing quantity plus requested quantity. Quantity must be a positive integer. | `server/modules/cart/cart.service.ts:95`, `:154` |
| Cart stock | Available quantity is the larger of zero and on-hand minus reserved. Missing inventory means zero. | `server/modules/cart/cart.service.ts:180` |
| Cart amounts | Line total is captured `CartItem.unitPrice` times quantity. Shop subtotal sums line totals. Cart subtotal sums shops. | `server/modules/cart/cart.service.ts:209` |
| Checkout selection | Only selected cart item IDs count. Empty, duplicated, or unknown IDs reject. | `server/modules/checkout/checkout.service.ts:247` |
| Checkout pricing | Current variant price replaces captured cart price. An active flash sale replaces it only when its price is positive and lower. | `server/modules/checkout/checkout-quote.evaluator.ts:133` |
| Checkout currency | Every selected item must use THB. | `server/modules/checkout/checkout-quote.evaluator.ts:106` |
| Checkout subtotal | Sum of trusted unit price times quantity. | `server/modules/checkout/checkout-quote.evaluator.ts:110` |
| Checkout shipping | Charge each selected shop's configured fee once. Missing or negative fees become zero. An applied free-shipping coupon waives only its returned shop IDs. | `server/modules/checkout/checkout-quote.evaluator.ts:111` |
| Shipping settings | Reject non-finite values, negative values, values above 100,000 baht, and values with more than two decimal places. Store rounded baht times 100. | `server/modules/seller-shop/seller-shop.service.ts:262` |
| Checkout discount | Clamp coupon discount plus redeemed coins times 100 between zero and item subtotal. | `server/modules/checkout/checkout-quote.evaluator.ts:73`, `:124` |
| Coin cap | Maximum coins is the smaller of floor of 20% of item subtotal divided by 100 and floor of remaining post-coupon subtotal divided by 100. Requested coins above balance or cap reject. | `server/modules/checkout/checkout-quote.evaluator.ts:183` |
| Checkout tax | Zero. No nonzero tax calculation exists in this evaluator. | `server/modules/checkout/checkout-quote.evaluator.ts:129` |
| Checkout total | Item subtotal minus discount plus shipping, clamped to zero. | `server/modules/checkout/checkout-quote.evaluator.ts:130` |
| Order snapshots | Order items store trusted unit price and its exact `BigInt` product with quantity. Parent totals copy the accepted quote. Payment amount copies grand total. | `server/modules/checkout/checkout.repository.ts:368`, `:385`, `:450` |
| Shop discount allocation | Apply a shop coupon only to its shop. Allocate platform coupon and coin discount across remaining shop subtotals. Floor each proportional allocation against remaining discount and remaining capacity. | `server/modules/checkout/checkout.repository.ts:333` |
| Inventory reservation | Reserve increments reserved quantity only. Checkout SQL requires on-hand minus reserved to be at least requested quantity in the same update. | `server/modules/checkout/checkout.repository.ts:260` |
| Flash quota | Remaining quota equals stock limit minus sold count minus active unexpired reservations. Per-user usage includes committed and active unexpired reservations plus the new quantity. | `server/modules/checkout/checkout.repository.ts:291` |
| Inventory adjustment | Next on-hand equals current on-hand plus adjustment. Reject below reserved. Seller absolute updates also reject below reserved. | `server/modules/inventory/inventory.service.ts:94`, `:123` |
| Generic reservation close | Commit decrements on-hand and reserved. Release or expiration decrements reserved only. Return restock increments on-hand only. | `server/modules/inventory/inventory.service.ts:175`, `:193`, `:206` |
| Inventory ledger | Mutation records before and after quantities, delta, and mutation type. The inventory repository increments version. | `server/modules/inventory/inventory.repository.ts:163`, `:177` |
| Shipment quantities | Create one shipment for each missing order shop. Copy each order item's full quantity to its shipment item. | `server/modules/shipment/shipment.service.ts:122` |
| Order buyer totals | Return stored parent subtotal, discount, shipping, tax, and grand total. Return stored item line totals. | `server/modules/order/order.service.ts:233` |
| Catalog price | Variant price must be a positive integer. Currency normalizes to THB. No safe-integer upper bound exists. | `server/modules/catalog/catalog.service.ts:1464`, `:1496` |
| Catalog stock display | Buyer normalization computes variant stock from on-hand minus reserved, clamped at zero. Product stock sums variant stock. | `app/features/product/queries.ts:1038`, `:1054` |
| Catalog price display | Buyer normalization uses smallest and largest positive variant prices for missing price-range fields. First variant determines `price`. | `app/features/product/queries.ts:1051` |
| Discount badge | Round original-minus-current price divided by original price times 100. | `app/features/product/queries.ts:1418` |
| Rating and sales counts | Repository averages ratings to two decimals and sums purchased item quantities by product. | `server/modules/catalog/catalog.repository.ts:827`, `:843` |
| Buyer checkout display | Grand total, discount, and shipping render the quote response. Selected shop subtotal and line totals use captured cart prices and browser multiplication. | `app/features/checkout/components/CheckoutPage.tsx:56`, `:127`, `:161`, `:253` |

## Independent expected examples

These literal expectations follow marketplace rules. They do not call application calculation helpers.

| Scenario | Input | Expected values |
| --- | --- | --- |
| Two shops, multiple lines | Shop A has 1299 times 3 and 250 times 2, shipping 350. Shop B has 999 times 2, shipping 450. | Item line totals 3897, 500, and 1998. A subtotal 4397. B subtotal 1998. Parent subtotal 6395. Shipping 800. Tax 0. Total 7195. |
| Platform discount plus coins | Same basket. Coupon 640. Request 12 coins. Wallet balance at least 12. | Maximum coin redemption is 12. Discount is 1840. Total is 5355. Requesting 13 coins rejects. |
| Rounding into shop totals | Same discounted basket and shop order A before B. | A discount 1265, total 3482. B discount 575, total 1873. Discounts sum to 1840. Totals sum to 5355. |
| Shop coupon scope | Same basket. Shop A coupon 1000. Redeem 10 coins. | Total discount 2000. A discount 1629, total 3118. B discount 371, total 2077. Parent total 5195. |
| Free shipping scope | Original basket. Shop A free-shipping coupon. No item discount. | A shipping 0. B shipping 450. Parent total 6845. |
| Partial selection | Select only Shop B's 999 times 2 line. | Subtotal 1998. Shipping 450. Total 2448. Shop A inventory and cart lines stay unchanged. |
| Satang edge | Price 1, quantity 1, shipping 0, no discounts. | Subtotal and total 1. No rounding to zero. Zero price and fractional price reject seller input. |
| Coin cap boundary | Subtotal 499. Wallet 10. | Maximum coins 0. Requesting 1 rejects. At subtotal 500, 1 coin yields total 400 before shipping. |
| Post-coupon coin cap | Subtotal 5000, coupon 4901, wallet 10. | Maximum coins 0 because only 99 satang remains. Requesting 1 rejects. |
| Shipping decimal | Seller submits 49.95 baht. | Store 4995 satang. Read 49.95 baht. Reject 49.951 baht. Accept 0 and 100000 baht. Reject 100000.01. |
| Reservation lifecycle | On-hand 10, reserved 2. New reservation 3. | After reserve on-hand 10, reserved 5, available 5. After its payment commit on-hand 7, reserved 2, available 5. |
| Reservation expiration | On-hand 10, reserved 5. Expire one reservation of 3. | On-hand 10, reserved 2, available 8. A repeated close must not change quantities again. |
| Seller adjustment boundary | On-hand 10, reserved 3. | Setting on-hand 3 succeeds. Setting 2 rejects and preserves all quantities. |
| Concurrent last stock | On-hand 1, reserved 0. Two different buyers each submit quantity 1. | One order and payment succeed. One stock rejection. On-hand remains 1 and reserved becomes 1. |
| Concurrent same cart | One selected line, quantity 2. Two simultaneous checkout submissions. | One order, one payment, one reservation of 2. One submission rejects. |
| Flash sale quantities | Sale stock limit 5, sold 2, active unexpired reservations 2. | Remaining quota 1. Quantity 1 succeeds and quantity 2 rejects. Expired reservations do not consume flash quota. |
| Failed checkout rollback | Reserve first line then fail on a later line or payment insert. | No order, payment, checkout, coupon redemption, coin ledger, or new reservation remains. Original stock, wallet balances, and cart items persist. |
| Unsafe money | Database amount 9007199254740993 satang. | Preserve exactly or reject before accepting the amount. Conversion to number must not silently report 9007199254740992. |

## Findings to reproduce

1. Checkout line and shop subtotals can disagree with the quoted amount after repricing or a flash sale. The cart service renders captured price. The evaluator uses live price. `CheckoutPage` renders captured-price arithmetic for its line and shop rows. A captured price of 1000, current price of 1200, quantity 2, and shipping 0 produce displayed line subtotal 2000 and authoritative grand total 2400 by source inspection. The quote response contains no priced line or shop details for the UI. This also contradicts `docs/adr/0001-amounts-are-computed-server-side-only.md`.

2. A catalog stock mutation bypasses inventory rules. `CatalogService.updateSellerInventory` at `server/modules/catalog/catalog.service.ts:1106` directly calls `updateVariantInventory`. That repository method at `server/modules/catalog/catalog.repository.ts:1291` performs an unguarded upsert. It can accept on-hand 1 with reserved 3, writes no inventory movement, and does not increment inventory version. Catalog and inventory modules both register `PATCH /api/seller/variants/:variantId/inventory`. `server/index.ts:147` mounts catalog before inventory at `:174`. Production handler precedence requires an actual composed-route test before declaring HTTP exposure. The direct catalog service defect is source-confirmed.

3. Concurrent cart adds can lose quantity. `CartService.addItem` reads existing quantity then performs absolute assignment through `PrismaCartRepository.updateItemQuantity` at `server/modules/cart/cart.repository.ts:208`. Two adds of 1 to existing quantity 1 can both set 2 when the expected result is 3. Two simultaneous first adds to an empty cart can also hit the unique cart/variant index. Existing cart concurrency tests cover first-cart creation, not item increments. This is a source-based race hypothesis.

4. Generic `InventoryService.commitReservation`, `releaseReservation`, and `expireReservation` can read the same ACTIVE reservation before either transaction closes it. `findReservationById` and `findInventoryById` have no locks. Updates use reservation ID without comparing its status. Concurrent release can decrement reserved twice and concurrent commit can decrease on-hand twice. These methods currently have no production callers outside the inventory module by source search. Payment and jobs implement separate repository transitions, so this finding must not be reported as proof of a webhook race.

5. Money can lose satang beyond the JavaScript safe-integer limit. Seller variant validation uses `Number.isInteger`, which accepts unsafe integers. `server/lib/prisma.ts` coerces all BigInt results into number. A safe unit price multiplied by a valid quantity can also produce an unsafe total. No explicit bound or exact arithmetic guard exists in checkout totals. Numeric input, database representation, API serialization, and totals each need boundary tests.

6. Seller order projection filters items and shipments but retains parent-wide totals. `OrderService.toSellerOrderResponse` at `server/modules/order/order.service.ts:214` calls `toOrderResponse` with a parent order and filtered rows. Seller A can therefore receive only its own items with the total of all shops. Shop-order snapshots already exist. This is a source-confirmed projection choice and requires a product-contract or seller-consumer check before labeling the total field erroneous.

7. Checkout estimates apply flash-sale price before checking flash quota or the per-user limit. `findActiveFlashSaleItemForCheckout` returns any active timed row. The commit repository checks quota later. A sold-out promotion can still produce a discounted estimate followed by checkout rejection. Quotes are documented estimates, so this is a usability gap rather than an established pricing bug.

## Existing tests and gaps

| Area | Evidence present | Missing proof |
| --- | --- | --- |
| Cart | `server/modules/cart/cart.service.test.ts` checks captured prices, grouped totals, positive quantities, and stock. `cart-concurrency.integration.test.ts` checks first-cart creation. | Concurrent adds to an existing line. Empty-line concurrent adds. Repricing agreement with checkout. Real UI totals. |
| Checkout totals | `server/modules/checkout/checkout.service.test.ts` covers trusted repricing, coupons, shipping per selected shop, flash prices, free shipping, and coin redemption. | Three-shop remainder allocation, unsafe integer totals, malformed persisted quantities, and independent end-to-end UI/API/DB comparisons. |
| Checkout persistence | `server/modules/checkout/checkout.repository.test.ts:180` checks shop-sum equality with the parent. | Literal per-shop values, one-satang remainder cases, nonzero quantities, and real persisted parent/payment/shop/item equality. |
| Checkout concurrency | `server/modules/checkout/checkout-concurrency.integration.test.ts` checks same selected cart submission, disjoint selections, and locked edits/inserts. It requires `COMMERCE_TEST_DATABASE_URL`. | Two different buyers competing for the last unit. Actual rollback assertions after partial writes. |
| Rollback | `server/modules/checkout/checkout.service.test.ts:679` makes mocked commit reject and checks the error. | Database state proves no partial reservation, wallet debit, or coupon redemption survives. The unit test cannot prove a database rollback. |
| Inventory | `server/modules/inventory/inventory.service.test.ts` checks overselling, adjustment boundaries, and mutation payloads. Repository test checks lock-before-reread in `ensureInventory`. | Concurrent reservation closes, duplicate closes, mixed commit/expiration, and inventory method races with checkout. |
| Inventory lifecycle mock | `inventory.service.test.ts:196` releases, commits, and expires the same mocked reservation. The mock continues returning ACTIVE. | An actual closed reservation rejects subsequent state transitions and leaves stock unchanged. |
| Catalog stock | `catalog.service.test.ts:1768` mock-returns on-hand 12 and reserved 3. | On-hand below reserved rejection, ledger/version changes, and duplicate-route composition behavior. |
| Catalog pricing | Catalog tests reject non-positive variant price and verify shipping dimensions. | Unsafe integer price, overflow through quantity multiplication, and API satang preservation. |
| Checkout UI | `app/features/checkout/components/CheckoutPage.test.tsx` checks quote loading/failure, repeat-submit suppression, coupons, coins, and discount/shipping rendering. | Updated price and flash-sale subtotal consistency. Current coin mock accepts 5 coins on a 1200-satang subtotal although the real 20% cap allows only 2. |
| Shipment concurrency | `server/modules/shipment/shipment-concurrency.integration.test.ts` checks sibling dispatch and delivery. It requires the disposable commerce database URL. | Quantity conservation across order item and shipment item persistence. Partial fulfillment is documented but this creation path copies full quantities. |

Principle choices applied in this partition were Prove It Works and Test Behavior, Not Implementation. Source inspection is labeled separately from runtime verification. Expected amounts are independent literals. Existing sum-equality and mock-call tests are recorded as limited evidence rather than end-to-end proof.

## Checkout changes and verification

The quote now returns authoritative priced item and shop summaries. `CheckoutPage` renders their amounts. It no longer multiplies cart prices or sums them for checkout rows. Regular repricing and flash-sale line and shop displays passed focused UI regression tests.

The evaluator rejects unsafe, fractional, negative, and non-finite monetary values before committing checkout. It also validates quantities, coin requests, and wallet balances. Exact integer division computes coin limits. A zero-priced legacy flash row still falls back to regular pricing.

`docs/test-evidence/2026-10-04-numeric/commerce-red.log` contains the pre-fix run. It had 17 failures and 36 passes. Failures reproduced missing authoritative line amounts, stale UI rows, and absent input or overflow guards. `commerce-green.log` records focused tests after repairs. Full-tree typecheck passed after the cart follow-up; `commerce-typecheck.log` is empty with exit 0. An intermediate attempt encountered generated Next validator output while the browser run rewrote it; the subsequent retry passed.

`e2e/numeric-commerce.spec.ts` defines three literal end-to-end comparisons. It covers repricing, platform coupon plus coins, and flash pricing plus coupon and coins. Each compares UI, quote API, payment amount, order and item snapshots, shop allocations, stock, and coin state. The root agent owns the browser and database run.

Cart snapshot pricing, concurrent cart item additions, composed duplicate inventory routes, and seller order total semantics were separate baseline findings. The follow-up below repairs cart concurrency and seller response totals. The root browser run verified that the existing composed InventoryService route protects active holds; no route precedence repair was required.

## Seller and cart follow-up

The seller order API filtered items and shipments by shop while retaining the multi-shop parent totals. It now sums the authorized `ShopOrder` snapshots, including allocated discounts and shipping. Buyer parent totals remain unchanged. Owner and staff projections passed 10 focused service and route tests in `order-green.log`; `order-red.log` retains the pre-fix failures. The current seller orders UI is a shipment list without monetary totals, so its display did not require a change.

The root agent reproduced a real PostgreSQL lost addition: initial quantity 1 plus two simultaneous additions of 1 produced 2 instead of the independent expected 3. `cart-followup-red.json` and its log retain the failure. Cart mutations now lock the parent cart and then its ordered item rows, matching checkout, before checking current quantities, ownership and stock. This also serializes the first insertion of a variant and protects update, remove and clear from stale reads during checkout.

`cart-followup-green.log` records 24 passing tests across three files, including eight real PostgreSQL scenarios. They prove initial empty cart plus two additions creates one item at quantity 2 and subtotal 2000; initial quantity 1 reaches 3 and subtotal 3000; available stock 1 rejects a second addition; and update, remove and clear wait for checkout locks and observe consumed items after commit. A queued addition whose cart changes from `ACTIVE` to `CHECKED_OUT` returns controlled 409 `CART_STATE_CONFLICT` after rereading the locked snapshot, leaving the checked-out cart empty and stock unchanged. All four mutation paths validate active status after acquiring locks.

The three browser comparisons also assert seller-scoped totals, signed one-satang-underpayment rejection with payment and stock unchanged, exact literal successful payment, identical signed webhook replay, stock 8 with reserved 0 per shop, two shipments, coupon `REDEEMED`, spent coin ledger `USED`, and zero pending coins. Checkout screenshots are captured after exact UI amount assertions. The root agent records the completed browser run separately. The composed HTTP error handler exposes the underpayment as `INVALID_REQUEST` with the exact message `Webhook amount does not match payment amount`.
