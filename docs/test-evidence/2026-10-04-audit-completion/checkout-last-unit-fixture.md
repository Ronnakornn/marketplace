# Last-unit checkout fixture diagnosis

The failed full run had1,737 tests with one failure in `checkout-concurrency.integration.test.ts`. The two fulfilled checkouts bought different variants of the same product. This failure did not demonstrate overselling of one shared inventory row.

## Actual failed fixture rows

Both variants belong to product `309f5206-a666-4655-870c-1f807a025e05`.

| Buyer | Order | Selected variant | Quantity | Inventory onHand/reserved |
| --- | --- | --- | --- | --- |
| Checkout race `c8993270-0dae-40b2-b8cb-c9593979b02b` | `05d0059a-5267-4297-8f58-a6a75574a781` | Variant2 `554d524a-281e-46cc-9efc-4599ae4d101f` | 1 | 10/1 |
| Second last-unit buyer `fdc62fed-4f1f-416e-b151-4326cad1a5bf` | `71bfa345-dafb-4182-bbfb-a4ba86f817ec` | Variant1 `a8054980-8388-4254-bb1f-b3fed60d4d31` | 1 | 1/1 |

Both orders have one PENDING payment of10,000 minor units. The first cart `a68d19fc-e2a0-47c2-bd07-db05f24d67d9` retains Variant1 at quantity2. The actual order bought Variant2 at quantity1.

The fixture creates two variants, then nested cart items. It selects `cart.items[0]` from a query ordered only by `createdAt`. It separately lowered stock of `variants[0]`, whose creation-array order differs from the returned cart-item order when creation timestamps tie. The first buyer therefore selected Variant2, while the second buyer targeted Variant1. Cart-item creation order is not a contract tying these independent arrays together.

[DB cart excerpt](checkout-last-unit-db-cart.json) preserves the observed failed first cart, order and inventory rows from the diagnosis tool output. [DB variants](checkout-last-unit-db-variants.json) adds the two exact productId relations from a read-only lookup. [Focused red log](checkout-last-unit-before.log) includes both observed buyer orders and payments before the focused reproduction.

## Reproduction and correction

The focused reproduction before the fixture fix failed the unchanged assertion at line113. It observed two fulfilled results instead of one. The other four tests were filtered out by `-t`, not skipped because an integration environment was unavailable.

```powershell
$env:DATABASE_URL='postgresql://postgres@127.0.0.1:55439/marketplace_test_completion'
$env:COMMERCE_TEST_DATABASE_URL=$env:DATABASE_URL
bunx vitest run server/modules/checkout/checkout-concurrency.integration.test.ts -t 'allows only one of two distinct buyers to reserve the last unit'
```

The correction reads the actual selected CartItem by `first.input.cartItemIds[0]`, uses its variantId to lower inventory and construct the second buyer's cart, and checks that both carts target that same variant. It changes only this integration test. The two-cart snapshot barrier is unchanged. The assertions remain one successful buyer, one409/INSUFFICIENT_STOCK, one order/payment/checkout/reservation and final inventory1/1.

After that change, the full owned file passed5/5 on the same PostgreSQL completion database.

```powershell
bunx vitest run server/modules/checkout/checkout-concurrency.integration.test.ts
```

| Artifact | Actual result | Provenance |
| --- | --- | --- |
| [Full failure excerpt](checkout-last-unit-full-failure.json) | 1,737 total, one failed last-unit case | Extracted unchanged fields and owned testResults from root `full-tests-verified.json`. This is an excerpt, not a new run. |
| [Focused before JSON](checkout-last-unit-before.json) / [log](checkout-last-unit-before.log) | Exit1, one failed, four filtered tests; start07:14:06 and duration1.12s | Exact structured command tool result `e129ae` and its output. |
| [Focused after JSON](checkout-last-unit-after.json) / [log](checkout-last-unit-after.log) | Exit0, five passed; start07:15:14 and duration2.42s | Exact structured command tool result `41eca4` and its output. |

The focused JSON files are captured command results with `exit_code` and exact `output`. They are not fabricated Vitest JSON reporter files. Their output was recovered from the active marketplace worker session, where those exact commands ran. The before log also contains the actual read-only DB query output issued immediately before the failing command.

Other `variants[0]` uses in this file add a new cart item after both variants were purchased, or read a productId shared by both variants. The cart-edit race uses `cart.items[1]` while its selected item is `cart.items[0]`, so it edits an unselected item. These uses do not share the faulty cross-array identity assumption.

Source review found the reservation uses a PostgreSQL conditional UPDATE of the targeted Inventory row with `quantityOnHand - quantityReserved >= requestedQuantity` inside the checkout transaction. No business logic change was made. This artifact proves the fixture diagnosis and the focused5-test result. It does not claim a final full-suite, browser or provider pass. Root owns those subsequent gates.
