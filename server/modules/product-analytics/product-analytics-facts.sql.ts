import { Prisma } from '#generated/client/client.ts'
import { REPORTING_TIME_ZONE } from '#server/lib/reporting-calendar.ts'
import type { AnalyticsDateRange } from './product-analytics.repository.ts'

export function paidAnalyticsItems(shopIds: string[], range: AnalyticsDateRange, productId?: string): Prisma.Sql {
  return Prisma.sql`
    SELECT v."productId", i."variantId", i."orderId", i.quantity, i."lineTotal", i.currency, o."createdAt"
    FROM "OrderItem" i
    JOIN "ProductVariant" v ON v.id = i."variantId"
    JOIN "Order" o ON o.id = i."orderId"
    WHERE i."shopId" IN (${Prisma.join(shopIds.map((id) => Prisma.sql`${id}::uuid`))})
      AND i."fulfillmentStatus" <> 'CANCELED' AND o."paymentStatus" = 'SUCCEEDED'
      AND o.status IN ('PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'PARTIALLY_FULFILLED', 'FULFILLED')
      AND o."createdAt" BETWEEN ${range.from} AND ${range.to}
      AND EXISTS (SELECT 1 FROM "Payment" payment WHERE payment."orderId" = o.id AND payment.status = 'SUCCEEDED')
      ${productId ? Prisma.sql`AND v."productId" = ${productId}::uuid` : Prisma.empty}
  `
}

export function analyticsFacts(shopIds: string[], range: AnalyticsDateRange, productId?: string): Prisma.Sql {
  const shops = Prisma.join(shopIds.map((id) => Prisma.sql`${id}::uuid`))
  const productFilter = productId ? Prisma.sql`AND l."productId" = ${productId}::uuid` : Prisma.empty
  return Prisma.sql`
    SELECT l."productId", NULL::uuid AS "variantId", l."createdAt", 1::bigint AS views,
      0::bigint AS "addToCart", 0::numeric AS "addToCartQuantity", NULL::uuid AS "orderId",
      0::numeric AS "unitsSold", 0::numeric AS revenue, NULL::text AS currency
    FROM "ProductViewLog" l
    WHERE l."shopId" IN (${shops}) AND l."createdAt" BETWEEN ${range.from} AND ${range.to} ${productFilter}
    UNION ALL
    SELECT l."productId", l."variantId", l."createdAt", 0, 1, l.quantity, NULL, 0, 0, NULL
    FROM "ProductAddToCartLog" l
    WHERE l."shopId" IN (${shops}) AND l."createdAt" BETWEEN ${range.from} AND ${range.to} ${productFilter}
    UNION ALL
    SELECT i."productId", i."variantId", i."createdAt", 0, 0, 0, i."orderId", i.quantity, i."lineTotal"::numeric, i.currency
    FROM (${paidAnalyticsItems(shopIds, range, productId)}) i
  `
}

export const analyticsTotals = Prisma.sql`
  COALESCE(SUM(views), 0)::text AS views, COALESCE(SUM("addToCart"), 0)::text AS "addToCart",
  COALESCE(SUM("addToCartQuantity"), 0)::text AS "addToCartQuantity", COUNT(DISTINCT "orderId")::text AS orders,
  COALESCE(SUM("unitsSold"), 0)::text AS "unitsSold", COALESCE(SUM(revenue), 0)::text AS revenue,
  CASE WHEN SUM(views) > 0 THEN COUNT(DISTINCT "orderId")::double precision / SUM(views)::double precision ELSE 0::double precision END AS "conversionRate",
  CASE WHEN COUNT(DISTINCT currency) = 1 THEN MIN(currency) ELSE NULL END AS currency
`

export function analyticsDailyQuery(shopIds: string[], range: AnalyticsDateRange, productId?: string): Prisma.Sql {
  return Prisma.sql`
    WITH facts AS (${analyticsFacts(shopIds, range, productId)})
    SELECT to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${REPORTING_TIME_ZONE}, 'YYYY-MM-DD') AS date,
      ${analyticsTotals}
    FROM facts GROUP BY date ORDER BY date
  `
}
