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
          OR o."includedTaxTotal" <> (SELECT SUM(s."includedTaxTotal") FROM "ShopOrder" s WHERE s."orderId"=o.id)
          OR o."reportedTaxTotal" <> (SELECT SUM(s."reportedTaxTotal") FROM "ShopOrder" s WHERE s."orderId"=o.id)
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
    UNION ALL
    SELECT 'tax_disclosure_equation', COUNT(*) FROM "Order"
      WHERE "taxTotal" < 0 OR "includedTaxTotal" < 0
        OR "reportedTaxTotal" <> "includedTaxTotal" + "taxTotal"
    UNION ALL
    SELECT 'original_v2_atomic_tax', COUNT(*) FROM "ItemSaleSnapshot" i
      JOIN "ShopSaleSnapshot" s ON s."shopOrderId"=i."shopOrderId"
      WHERE s."policyVersion"=2 AND (
        i."buyerMerchandiseNet" IS NULL OR i."buyerMerchandiseTax" IS NULL
        OR i."platformCouponNet" IS NULL OR i."platformCouponTax" IS NULL
        OR i."coinFundingNet" IS NULL OR i."coinFundingTax" IS NULL
        OR i."buyerMerchandiseNet" < 0 OR i."buyerMerchandiseTax" < 0
        OR i."platformCouponNet" < 0 OR i."platformCouponTax" < 0
        OR i."coinFundingNet" < 0 OR i."coinFundingTax" < 0
        OR i."buyerMerchandise" <> i."buyerMerchandiseNet" + i."buyerMerchandiseTax"
        OR i."platformCouponDiscount" <> i."platformCouponNet" + i."platformCouponTax"
        OR i."coinDiscount" <> i."coinFundingNet" + i."coinFundingTax"
        OR i."originalCashbackEligibleNet" IS DISTINCT FROM i."buyerMerchandiseNet"
        OR i."originalAffiliateEligibleNet" IS DISTINCT FROM i."buyerMerchandiseNet")
    UNION ALL
    SELECT 'planned_refund_cash', COUNT(*) FROM "Refund" r
      WHERE EXISTS (SELECT 1 FROM "RefundItemAllocation" a WHERE a."refundId"=r.id)
        AND r.amount <> COALESCE((SELECT SUM(a."cashMerchandise" + a."buyerTaxRefund")
          FROM "RefundItemAllocation" a WHERE a."refundId"=r.id),0)
          + COALESCE((SELECT SUM(a."buyerShippingRefund" + a."buyerShippingTaxRefund")
            FROM "RefundShopAllocation" a WHERE a."refundId"=r.id),0)
    UNION ALL
    SELECT 'original_quantity_capacity', COUNT(*) FROM "ItemSaleSnapshot" i
      WHERE COALESCE((SELECT SUM(a.quantity) FROM "RefundItemAllocation" a JOIN "Refund" r ON r.id=a."refundId"
        WHERE a."orderItemId"=i."orderItemId" AND r.status IN ('SUCCESS','PENDING','PROCESSING')),0) > i."originalQuantity"
        OR (SELECT COUNT(*) FROM "RefundItemAllocation" a JOIN "Refund" r ON r.id=a."refundId"
          WHERE a."orderItemId"=i."orderItemId" AND r.status IN ('PENDING','PROCESSING')) > 1
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
