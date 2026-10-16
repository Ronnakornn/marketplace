import { Prisma } from '#generated/client/client.ts'
import { localeSortKey } from '#server/lib/sql-locale-order.ts'
import { analyticsFacts, analyticsTotals } from './product-analytics-facts.sql.ts'
import type { AnalyticsDateRange } from './product-analytics.repository.ts'

export function analyticsSummaryQuery(shopIds: string[], range: AnalyticsDateRange, productId?: string): Prisma.Sql {
  const shops = Prisma.join(shopIds.map((id) => Prisma.sql`${id}::uuid`))
  return Prisma.sql`
    WITH facts AS MATERIALIZED (${analyticsFacts(shopIds, range, productId)}),
    summary AS (SELECT ${analyticsTotals} FROM facts),
    product_metrics AS (
      SELECT "productId" AS id, ${analyticsTotals} FROM facts GROUP BY "productId"
    ), sku_metrics AS (
      SELECT "variantId" AS id, ${analyticsTotals}
      FROM facts WHERE "variantId" IS NOT NULL GROUP BY "variantId"
    ), low_products AS (
      SELECT m.*, ROW_NUMBER() OVER (ORDER BY m.views::numeric DESC, m."conversionRate" ASC, ${localeSortKey(Prisma.sql`p.title`)}, m.id) AS position
      FROM product_metrics m JOIN "Product" p ON p.id = m.id
      WHERE p."shopId" IN (${shops}) AND p."deletedAt" IS NULL
        AND m.views::numeric >= 10 AND m."conversionRate" < 0.01
      ORDER BY position LIMIT 5
    ), top_skus AS (
      SELECT m.*, ROW_NUMBER() OVER (ORDER BY m.revenue::numeric DESC, m.id) AS position
      FROM sku_metrics m JOIN "ProductVariant" v ON v.id = m.id JOIN "Product" p ON p.id = v."productId"
      WHERE p."shopId" IN (${shops}) AND p."deletedAt" IS NULL
      ORDER BY position LIMIT 5
    )
    SELECT 'summary' AS kind, NULL::text AS id, s.*, 0::bigint AS position FROM summary s
    UNION ALL SELECT 'product', id::text, views, "addToCart", "addToCartQuantity", orders, "unitsSold", revenue, "conversionRate", currency, position FROM low_products
    UNION ALL SELECT 'sku', id::text, views, "addToCart", "addToCartQuantity", orders, "unitsSold", revenue, "conversionRate", currency, position FROM top_skus
    ORDER BY kind, position
  `
}
