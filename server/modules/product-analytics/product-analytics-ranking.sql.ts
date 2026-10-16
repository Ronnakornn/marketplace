import { Prisma } from '#generated/client/client.ts'
import { moneyInteger, moneyNumber } from '#server/lib/money.ts'
import { localeSortKey } from '#server/lib/sql-locale-order.ts'
import { paidAnalyticsItems } from './product-analytics-facts.sql.ts'
import type { AnalyticsDateRange, AnalyticsRankingOptions, AnalyticsRankingPage } from './product-analytics.repository.ts'

export interface RawAnalyticsRankingRow {
  id: string | null
  views: string | null
  addToCart: string | null
  addToCartQuantity: string | null
  orders: string | null
  unitsSold: string | null
  revenue: string | null
  conversionRate: number | null
  currency: string | null
  total: string
}

export function decodeRankingPage(rows: RawAnalyticsRankingRow[]): AnalyticsRankingPage {
  return {
    total: moneyNumber(rows[0]?.total ?? '0'),
    items: rows.flatMap((row) => row.id === null ? [] : [{
      id: row.id,
      views: moneyNumber(row.views!),
      addToCart: moneyNumber(row.addToCart!),
      addToCartQuantity: moneyNumber(row.addToCartQuantity!),
      orders: moneyNumber(row.orders!),
      unitsSold: moneyNumber(row.unitsSold!),
      revenue: moneyInteger(row.revenue!),
      conversionRate: row.conversionRate!,
      currency: row.currency,
    }]),
  }
}

export function productRankingQuery(shopIds: string[], range: AnalyticsDateRange, options: AnalyticsRankingOptions & { q?: string }): Prisma.Sql {
  const pattern = options.q ? `%${options.q}%` : undefined
  const candidates = Prisma.sql`
    SELECT p.id, p.title AS label FROM "Product" p
    WHERE p."shopId" IN (${Prisma.join(shopIds.map((id) => Prisma.sql`${id}::uuid`))}) AND p."deletedAt" IS NULL
      ${pattern ? Prisma.sql`AND (p.title ILIKE ${pattern} OR p.slug ILIKE ${pattern})` : Prisma.empty}
  `
  return rankingQuery('product', candidates, shopIds, range, options)
}

export function variantRankingQuery(shopIds: string[], range: AnalyticsDateRange, options: AnalyticsRankingOptions & { productId?: string }): Prisma.Sql {
  const candidates = Prisma.sql`
    SELECT v.id, v.sku AS label FROM "ProductVariant" v
    JOIN "Product" p ON p.id = v."productId"
    WHERE p."shopId" IN (${Prisma.join(shopIds.map((id) => Prisma.sql`${id}::uuid`))}) AND p."deletedAt" IS NULL
      ${options.productId ? Prisma.sql`AND v."productId" = ${options.productId}::uuid` : Prisma.empty}
  `
  return rankingQuery('sku', candidates, shopIds, range, options)
}

function rankingOrder(sort: string, dimension: 'product' | 'sku'): Prisma.Sql {
  const key = sort.startsWith('-') ? sort.slice(1) : sort
  const labelSort = dimension === 'product' ? 'title' : 'sku'
  const columns: Record<string, Prisma.Sql> = dimension === 'product'
    ? { views: Prisma.sql`m.views`, addToCart: Prisma.sql`m."addToCart"`, orders: Prisma.sql`m.orders`, unitsSold: Prisma.sql`m."unitsSold"`, revenue: Prisma.sql`m.revenue`, conversionRate: Prisma.sql`m."conversionRate"`, title: localeSortKey(Prisma.sql`m.label`) }
    : { addToCart: Prisma.sql`m."addToCart"`, orders: Prisma.sql`m.orders`, unitsSold: Prisma.sql`m."unitsSold"`, revenue: Prisma.sql`m.revenue`, sku: localeSortKey(Prisma.sql`m.label`) }
  const column = columns[key]
  if (!column) throw new RangeError('Unsupported analytics ranking sort')
  const direction = sort.startsWith('-') || key !== labelSort ? Prisma.sql`DESC` : Prisma.sql`ASC`
  return Prisma.sql`${column} ${direction}, m.id ASC`
}

function rankingQuery(dimension: 'product' | 'sku', candidates: Prisma.Sql, shopIds: string[], range: AnalyticsDateRange, options: AnalyticsRankingOptions & { productId?: string }): Prisma.Sql {
  const shops = Prisma.join(shopIds.map((id) => Prisma.sql`${id}::uuid`))
  const cartId = dimension === 'product' ? Prisma.sql`l."productId"` : Prisma.sql`l."variantId"`
  const paidId = dimension === 'product' ? Prisma.sql`i."productId"` : Prisma.sql`i."variantId"`
  const views = dimension === 'product' ? Prisma.sql`
    UNION ALL
    SELECT l."productId", NULL, 1, 0, 0, NULL, 0, 0, NULL FROM "ProductViewLog" l
    WHERE l."shopId" IN (${shops}) AND l."createdAt" BETWEEN ${range.from} AND ${range.to}
  ` : Prisma.empty
  const order = rankingOrder(options.sort, dimension)
  return Prisma.sql`
    WITH candidates AS (${candidates}), facts AS (
      SELECT id, label, 0::bigint AS views, 0::bigint AS "addToCart", 0::numeric AS "addToCartQuantity",
        NULL::uuid AS "orderId", 0::numeric AS "unitsSold", 0::numeric AS revenue, NULL::text AS currency FROM candidates
      ${views}
      UNION ALL
      SELECT ${cartId}, NULL, 0, 1, l.quantity, NULL, 0, 0, NULL
      FROM "ProductAddToCartLog" l
      WHERE l."shopId" IN (${shops}) AND l."createdAt" BETWEEN ${range.from} AND ${range.to}
        ${options.productId ? Prisma.sql`AND l."productId" = ${options.productId}::uuid` : Prisma.empty}
      UNION ALL
      SELECT ${paidId}, NULL, 0, 0, 0, i."orderId", i.quantity, i."lineTotal"::numeric, i.currency
      FROM (${paidAnalyticsItems(shopIds, range, options.productId)}) i
    ), aggregated AS (
      SELECT id, MAX(label) AS label, SUM(views) AS views, SUM("addToCart") AS "addToCart",
        SUM("addToCartQuantity") AS "addToCartQuantity", COUNT(DISTINCT "orderId") AS orders,
        SUM("unitsSold") AS "unitsSold", SUM(revenue) AS revenue,
        CASE WHEN COUNT(DISTINCT currency) = 1 THEN MIN(currency) ELSE NULL END AS currency
      FROM facts GROUP BY id HAVING MAX(label) IS NOT NULL
    ), metrics AS (
      SELECT *, CASE WHEN views > 0 THEN orders::double precision / views::double precision ELSE 0::double precision END AS "conversionRate"
      FROM aggregated
    ), page AS (
      SELECT m.* FROM metrics m
      ORDER BY ${order} LIMIT ${options.limit} OFFSET ${BigInt((options.page - 1) * options.limit)}
    )
    SELECT m.id::text AS id, m.views::text AS views, m."addToCart"::text AS "addToCart",
      m."addToCartQuantity"::text AS "addToCartQuantity", m.orders::text AS orders,
      m."unitsSold"::text AS "unitsSold", m.revenue::text AS revenue, m."conversionRate", m.currency, totals.total::text AS total
    FROM (SELECT COUNT(*) AS total FROM candidates) totals LEFT JOIN page m ON true ORDER BY ${order}
  `
}
