# Buy again

`POST /api/orders/:orderId/buy-again` requires the existing authentication macro.
The server filters the historical Order by the authenticated buyer ID. Administrators cannot use buyer cart operations. Missing and foreign orders return `404 ORDER_NOT_FOUND`.

CartService aggregates original OrderItem quantities by variant ID. Inside the existing locked-cart transaction, it loads current variants, products, shops, and inventory in one query. The quantity target is `max(existing cart quantity, historical quantity)`. Repeated and concurrent requests converge to that target. A larger existing cart quantity remains unchanged.

Only ACTIVE variants, ACTIVE non-deleted products, and ACTIVE non-deleted shops qualify. Current prices must be positive bigint minor units, and currency must be THB, matching the marketplace catalog and checkout. Existing qualifying cart rows receive the current price and currency.

Available stock is `max(0, quantityOnHand - quantityReserved)`. When availability covers only part of the historical target, the server adds the available quantity and returns `partial` with `STOCK_LIMIT`. It skips an existing line above available stock, preserves its quantity, and refreshes its price and currency. A cart addition does not reserve stock. Checkout validates availability and prices again.

The response contains `cartId` and one item per historical variant. Each item includes historical titles, `requestedQuantity`, `existingQuantity`, `targetQuantity`, `addedQuantity`, `finalQuantity`, `availableQuantity`, `unitPrice`, and `currency`. HTTP prices are exact canonical integer strings. Missing variants return a null current price and currency.

The item `kind` is `added`, `partial`, `already_in_cart`, or `skipped`. Skipped reasons identify missing or inactive variants, unavailable products or shops, invalid current prices, unsupported currency, exhausted stock, or existing quantities above stock. Known availability refusals do not cancel successful items. Unexpected database failures roll back every cart change in the batch.

Order detail displays the button, pending state, per-item result, and current prices in Thai or English. A synchronous guard prevents immediate duplicate clicks. A successful request invalidates the buyer cart query. The buyer can open the cart when at least one item is ready. All-skipped results stay on the order page.

This operation changes CartItem rows only. It does not change the historical Order or its snapshots, create a checkout or payment, reserve stock, or mutate inventory.

Focused verification runs with `bun run test server/modules/cart/cart.service.test.ts server/modules/order/order.routes.test.ts app/features/order/api.test.ts app/features/order/components/BuyAgainButton.test.tsx`. The PostgreSQL test at `server/modules/cart/buy-again.integration.test.ts` runs only when `COMMERCE_TEST_DATABASE_URL` names a local disposable `marketplace_test_*` database with repository migrations applied. It proves concurrent retries, original SKU aggregation, current money, reserved stock, foreign-order isolation, and rollback after a first real cart write followed by an injected database failure.
