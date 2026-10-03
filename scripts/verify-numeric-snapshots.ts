import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#generated/client/client.ts'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')
const url = new URL(databaseUrl)
if (!['localhost', '127.0.0.1'].includes(url.hostname)
  || !/^\/(marketplace_test_|marketplace_e2e_)/.test(url.pathname)) {
  throw new Error('Numeric verification requires a disposable local marketplace test database')
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
try {
  const violations = await db.$queryRaw<Array<{ check: string; violations: bigint }>>`
    SELECT 'order_equation' AS "check", COUNT(*) AS violations FROM "Order"
      WHERE "grandTotal" <> "subtotal" - "discountTotal" + "shippingTotal" + "taxTotal"
    UNION ALL
    SELECT 'item_equation', COUNT(*) FROM "OrderItem" WHERE "lineTotal" <> "unitPrice" * quantity
    UNION ALL
    SELECT 'item_subtotal', COUNT(*) FROM "Order" o
      WHERE o.subtotal <> (SELECT COALESCE(SUM(i."lineTotal"),0) FROM "OrderItem" i WHERE i."orderId"=o.id)
    UNION ALL
    SELECT 'shop_snapshot_completeness', COUNT(*) FROM "Order" o
      WHERE NOT EXISTS (SELECT 1 FROM "ShopOrder" s WHERE s."orderId"=o.id)
        OR EXISTS (SELECT 1 FROM "OrderItem" i WHERE i."orderId"=o.id
          AND NOT EXISTS (SELECT 1 FROM "ShopOrder" s WHERE s."orderId"=o.id AND s."shopId"=i."shopId"))
        OR EXISTS (SELECT 1 FROM "ShopOrder" s WHERE s."orderId"=o.id
          AND (s.currency <> o.currency OR NOT EXISTS (SELECT 1 FROM "OrderItem" i WHERE i."orderId"=o.id AND i."shopId"=s."shopId")))
    UNION ALL
    SELECT 'shop_snapshot_totals', COUNT(*) FROM "Order" o
      WHERE EXISTS (SELECT 1 FROM "ShopOrder" s WHERE s."orderId"=o.id)
        AND (o."grandTotal" <> (SELECT SUM(s."grandTotal") FROM "ShopOrder" s WHERE s."orderId"=o.id)
          OR o.subtotal <> (SELECT SUM(s.subtotal) FROM "ShopOrder" s WHERE s."orderId"=o.id)
          OR o."discountTotal" <> (SELECT SUM(s."discountTotal") FROM "ShopOrder" s WHERE s."orderId"=o.id)
          OR o."shippingTotal" <> (SELECT SUM(s."shippingTotal") FROM "ShopOrder" s WHERE s."orderId"=o.id)
          OR o."taxTotal" <> (SELECT SUM(s."taxTotal") FROM "ShopOrder" s WHERE s."orderId"=o.id)
          OR EXISTS (SELECT 1 FROM "ShopOrder" s WHERE s."orderId"=o.id
            AND (s."grandTotal" <> s.subtotal - s."discountTotal" + s."shippingTotal" + s."taxTotal"
              OR s.subtotal <> (SELECT COALESCE(SUM(i."lineTotal"),0) FROM "OrderItem" i WHERE i."orderId"=o.id AND i."shopId"=s."shopId"))))
    UNION ALL
    SELECT 'payment_snapshot_amount', COUNT(*) FROM "Payment" p JOIN "Order" o ON o.id=p."orderId"
      WHERE p.amount <> o."grandTotal" OR p.currency <> o.currency
    UNION ALL
    SELECT 'inventory_bounds', COUNT(*) FROM "Inventory"
      WHERE "quantityOnHand" < 0 OR "quantityReserved" < 0 OR "quantityReserved" > "quantityOnHand"
    UNION ALL
    SELECT 'duplicate_seller_earnings', COUNT(*) FROM
      (SELECT "orderId","shopId" FROM "WalletLedgerEntry" WHERE type='order_earning' AND "orderId" IS NOT NULL
        GROUP BY "orderId","shopId" HAVING COUNT(*)>1) duplicates
  `
  const counts = await db.$queryRaw<Array<{ orders: bigint; payments: bigint; items: bigint; shop_orders: bigint }>>`
    SELECT (SELECT COUNT(*) FROM "Order") AS orders,
      (SELECT COUNT(*) FROM "Payment") AS payments,
      (SELECT COUNT(*) FROM "OrderItem") AS items,
      (SELECT COUNT(*) FROM "ShopOrder") AS shop_orders
  `
  process.stdout.write(JSON.stringify({ database: url.pathname.slice(1), checkedAt: new Date().toISOString(), counts, violations },
    (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2) + '\n')
  if (violations.some(row => row.violations !== 0n)) process.exitCode = 1
} finally {
  await db.$disconnect()
}
