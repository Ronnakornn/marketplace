import { Prisma } from '#generated/client/client.ts'
import type { ReportFilters } from './reporting.filters.ts'

export interface ReportRow {
  key: string
  label: string
  currency: string
  orders: bigint
  units: bigint
  gmv: string
  paidMerchandise: string
  shipping: string
  tax: string
  discount: string
  refund: string
  originalCommission: string
  commissionReversal: string
  platformFunding: string
  fundingReversal: string
  contribution: string
  snapshotMissing: bigint
  totalCount: bigint
}
const zeroMetrics = Prisma.sql`0::numeric AS "gmv", 0::numeric AS "paidMerchandise", 0::numeric AS "shipping", 0::numeric AS "tax", 0::numeric AS "discount"`

function group(filters: ReportFilters, date: Prisma.Sql) {
  switch (filters.group) {
    case 'shop':
      return {
        key: Prisma.sql`i."shopId"::text`,
        label: Prisma.sql`i."shopName"`,
      }
    case 'product':
      return {
        key: Prisma.sql`v."productId"::text`,
        label: Prisma.sql`i."productTitle"`,
      }
    case 'category':
      return {
        key: Prisma.sql`COALESCE(p."categoryId"::text, 'uncategorized')`,
        label: Prisma.sql`COALESCE(c."name", 'Uncategorized')`,
      }
    case 'region':
      return {
        key: Prisma.sql`COALESCE(o."shippingRegion", o."shippingCountry")`,
        label: Prisma.sql`COALESCE(o."shippingRegion", o."shippingCountry")`,
      }
    case 'day':
      return {
        key: Prisma.sql`to_char(${date} AT TIME ZONE 'UTC' AT TIME ZONE ${filters.timeZone}, 'YYYY-MM-DD')`,
        label: Prisma.sql`to_char(${date} AT TIME ZONE 'UTC' AT TIME ZONE ${filters.timeZone}, 'YYYY-MM-DD')`,
      }
    case 'month':
      return {
        key: Prisma.sql`to_char(${date} AT TIME ZONE 'UTC' AT TIME ZONE ${filters.timeZone}, 'YYYY-MM')`,
        label: Prisma.sql`to_char(${date} AT TIME ZONE 'UTC' AT TIME ZONE ${filters.timeZone}, 'YYYY-MM')`,
      }
  }
}
const joins = Prisma.sql`JOIN "Order" o ON o."id" = i."orderId" JOIN "ProductVariant" v ON v."id" = i."variantId" JOIN "Product" p ON p."id" = v."productId" LEFT JOIN "Category" c ON c."id" = p."categoryId"`
function scope(filters: ReportFilters) {
  return Prisma.sql`
  ${filters.shopId ? Prisma.sql`AND i."shopId" = ${filters.shopId}::uuid` : Prisma.empty}
  ${filters.categoryId ? Prisma.sql`AND p."categoryId" = ${filters.categoryId}::uuid` : Prisma.empty}
  ${filters.productId ? Prisma.sql`AND v."productId" = ${filters.productId}::uuid` : Prisma.empty}
  ${filters.region ? Prisma.sql`AND o."shippingRegion" = ${filters.region}` : Prisma.empty}`
}

// Each shop amount uses cumulative floor allocation across its original lines.
// Allocation runs before filters, so selecting one category cannot take another's shipping or fee.
function allocatedItems(filters: ReportFilters) {
  return Prisma.sql`WITH item_weights AS (
  SELECT i.*, candidate."shippingTotal" AS "legacyShippingTotal", candidate."discountTotal" AS "legacyDiscountTotal", candidate."reportedTaxTotal" AS "legacyReportedTaxTotal", candidate."taxTotal" AS "legacyTaxTotal",
    SUM(i."lineTotal"::numeric) OVER (PARTITION BY i."orderId" ORDER BY i."id") AS order_cumulative,
    SUM(i."lineTotal"::numeric) OVER (PARTITION BY i."orderId") AS order_weight,
    ROW_NUMBER() OVER (PARTITION BY i."orderId" ORDER BY i."id") AS order_position,
    COUNT(*) OVER (PARTITION BY i."orderId") AS order_lines,
    SUM(i."lineTotal"::numeric) OVER (PARTITION BY i."orderId", i."shopId" ORDER BY i."id") AS cumulative,
    SUM(i."lineTotal"::numeric) OVER (PARTITION BY i."orderId", i."shopId") AS weight,
    ROW_NUMBER() OVER (PARTITION BY i."orderId", i."shopId" ORDER BY i."id") AS position,
    COUNT(*) OVER (PARTITION BY i."orderId", i."shopId") AS lines
  FROM "OrderItem" i JOIN "Order" candidate ON candidate."id" = i."orderId"
  WHERE (candidate."createdAt" >= ${filters.from.toISOString()}::timestamp AND candidate."createdAt" < ${filters.to.toISOString()}::timestamp)
    OR EXISTS (SELECT 1 FROM "Refund" changed WHERE changed."orderId" = candidate."id" AND changed."status" = 'SUCCESS' AND changed."completedAt" >= ${filters.from.toISOString()}::timestamp AND changed."completedAt" < ${filters.to.toISOString()}::timestamp)
), allocated AS (
  SELECT i.*, so."id" AS "shopOrderId", COALESCE(so."shippingTotal", i."legacyShippingTotal") AS "shippingTotal", COALESCE(so."reportedTaxTotal", i."legacyReportedTaxTotal") AS "reportedTaxTotal", COALESCE(so."taxTotal", i."legacyTaxTotal") AS "taxTotal", COALESCE(so."discountTotal", i."legacyDiscountTotal") AS "discountTotal",
    ss."originalCommission", ss."platformShippingSubsidy", ss."policyVersion",
    CASE WHEN so."id" IS NULL THEN CASE WHEN i.order_weight > 0 THEN i.order_cumulative ELSE i.order_position::numeric END ELSE CASE WHEN i.weight > 0 THEN i.cumulative ELSE i.position::numeric END END AS upper_units,
    CASE WHEN so."id" IS NULL THEN CASE WHEN i.order_weight > 0 THEN i.order_cumulative - i."lineTotal" ELSE (i.order_position - 1)::numeric END ELSE CASE WHEN i.weight > 0 THEN i.cumulative - i."lineTotal" ELSE (i.position - 1)::numeric END END AS lower_units,
    CASE WHEN so."id" IS NULL THEN CASE WHEN i.order_weight > 0 THEN i.order_weight ELSE i.order_lines::numeric END ELSE CASE WHEN i.weight > 0 THEN i.weight ELSE i.lines::numeric END END AS total_units
  FROM item_weights i LEFT JOIN "ShopOrder" so ON so."orderId" = i."orderId" AND so."shopId" = i."shopId"
  LEFT JOIN "ShopSaleSnapshot" ss ON ss."shopOrderId" = so."id"
)`
}
function allocate(amount: Prisma.Sql) {
  return Prisma.sql`(div(COALESCE(${amount}, 0)::numeric * i.upper_units, i.total_units) - div(COALESCE(${amount}, 0)::numeric * i.lower_units, i.total_units))`
}

export function reportQuery(filters: ReportFilters, all = false): Prisma.Sql {
  const sales = group(filters, Prisma.sql`o."createdAt"`),
    refunds = group(filters, Prisma.sql`r."completedAt"`)
  const cte = Prisma.sql`${allocatedItems(filters)}, facts AS (
    SELECT ${sales.key} AS key, ${sales.label} AS label, i."currency", CASE WHEN i."fulfillmentStatus" <> 'CANCELED' THEN i."orderId" ELSE NULL END AS "orderId", CASE WHEN i."fulfillmentStatus" <> 'CANCELED' THEN i."quantity" ELSE 0 END::bigint AS units,
      CASE WHEN i."fulfillmentStatus" <> 'CANCELED' THEN i."lineTotal" ELSE 0 END::numeric AS "gmv", CASE WHEN i."fulfillmentStatus" <> 'CANCELED' THEN COALESCE(s."buyerMerchandiseNet" + s."buyerMerchandiseTax", s."buyerMerchandise", i."lineTotal" - ${allocate(Prisma.sql`i."discountTotal"`)}) ELSE 0 END::numeric AS "paidMerchandise",
      CASE WHEN i."fulfillmentStatus" <> 'CANCELED' THEN ${allocate(Prisma.sql`i."shippingTotal"`)} ELSE 0 END AS shipping,
      CASE WHEN i."fulfillmentStatus" <> 'CANCELED' THEN ${allocate(Prisma.sql`COALESCE(i."reportedTaxTotal", i."taxTotal")`)} ELSE 0 END AS tax,
      CASE WHEN i."fulfillmentStatus" <> 'CANCELED' THEN COALESCE(s."sellerCouponDiscount" + s."platformCouponDiscount" + s."coinDiscount", ${allocate(Prisma.sql`i."discountTotal"`)}) ELSE 0 END::numeric AS discount,
      0::numeric AS refund, ${allocate(Prisma.sql`i."originalCommission"`)} AS "originalCommission",
      0::numeric AS "commissionReversal", (COALESCE(s."platformCouponNet" + s."platformCouponTax", s."platformCouponDiscount", 0) + COALESCE(s."coinFundingNet" + s."coinFundingTax", s."coinDiscount", 0) + ${allocate(Prisma.sql`i."platformShippingSubsidy"`)})::numeric AS "platformFunding",
      0::numeric AS "fundingReversal", CASE WHEN s."orderItemId" IS NULL OR i."policyVersion" IS NULL THEN 1 ELSE 0 END::bigint AS "snapshotMissing"
    FROM allocated i ${joins} LEFT JOIN "ItemSaleSnapshot" s ON s."orderItemId" = i."id"
    WHERE o."createdAt" >= ${filters.from.toISOString()}::timestamp AND o."createdAt" < ${filters.to.toISOString()}::timestamp
      AND EXISTS (SELECT 1 FROM "Payment" pay WHERE pay."orderId" = o."id" AND pay."status" IN ('SUCCEEDED', 'REFUNDED')) ${scope(filters)}
    UNION ALL
    SELECT ${refunds.key}, ${refunds.label}, i."currency", NULL::uuid, 0::bigint,
      ${zeroMetrics}, (a."cashMerchandise" + a."buyerTaxRefund")::numeric AS refund, 0::numeric AS "originalCommission", 0::numeric AS "commissionReversal", 0::numeric AS "platformFunding",
      (a."platformCouponReversal" + a."platformCouponTaxReversal" + a."coinFundingReversal" + a."coinTaxReversal")::numeric AS "fundingReversal", 0::bigint AS "snapshotMissing"
    FROM "RefundItemAllocation" a JOIN "Refund" r ON r."id" = a."refundId" JOIN allocated i ON i."id" = a."orderItemId" ${joins}
    WHERE r."status" = 'SUCCESS' AND r."completedAt" >= ${filters.from.toISOString()}::timestamp AND r."completedAt" < ${filters.to.toISOString()}::timestamp ${scope(filters)}
    UNION ALL
    SELECT ${refunds.key}, ${refunds.label}, i."currency", NULL::uuid, 0::bigint,
      ${zeroMetrics}, ${allocate(Prisma.sql`a."buyerShippingRefund" + a."buyerShippingTaxRefund"`)} AS refund, 0::numeric AS "originalCommission",
      ${allocate(Prisma.sql`a."commissionReversal"`)} AS "commissionReversal", 0::numeric AS "platformFunding",
      ${allocate(Prisma.sql`a."platformShippingReversal" + a."platformShippingTaxReversal"`)} AS "fundingReversal", 0::bigint AS "snapshotMissing"
    FROM "RefundShopAllocation" a JOIN "Refund" r ON r."id" = a."refundId" JOIN allocated i ON i."shopOrderId" = a."shopOrderId" ${joins}
    WHERE r."status" = 'SUCCESS' AND r."completedAt" >= ${filters.from.toISOString()}::timestamp AND r."completedAt" < ${filters.to.toISOString()}::timestamp ${scope(filters)}
  ), grouped AS (
    SELECT key, MIN(label) AS label, currency, COUNT(DISTINCT "orderId")::bigint AS orders, SUM(units)::bigint AS units,
      SUM(gmv)::text AS gmv, SUM("paidMerchandise")::text AS "paidMerchandise", SUM(shipping)::text AS shipping,
      SUM(tax)::text AS tax, SUM(discount)::text AS discount, SUM(refund)::text AS refund,
      SUM("originalCommission")::text AS "originalCommission", SUM("commissionReversal")::text AS "commissionReversal",
      SUM("platformFunding")::text AS "platformFunding", SUM("fundingReversal")::text AS "fundingReversal",
      (SUM("originalCommission") - SUM("commissionReversal") - SUM("platformFunding") + SUM("fundingReversal"))::text AS contribution,
      SUM("snapshotMissing")::bigint AS "snapshotMissing"
    FROM facts GROUP BY key, currency
  )`
  return Prisma.sql`${cte} SELECT *, COUNT(*) OVER()::bigint AS "totalCount" FROM grouped
    ORDER BY ${filters.group === 'day' || filters.group === 'month' ? Prisma.sql`key ASC` : Prisma.sql`gmv::numeric DESC, key ASC`}, currency ASC
    LIMIT ${all ? 10_001 : filters.limit} OFFSET ${all ? 0 : (filters.page - 1) * filters.limit}`
}

export function searchQueriesQuery(filters: ReportFilters) {
  return Prisma.sql`SELECT "normalizedQuery" AS query, COUNT(*)::bigint AS count, COUNT(*) FILTER (WHERE "resultCount" = 0)::bigint AS "zeroResults"
    FROM "SearchQueryLog" WHERE "createdAt" >= ${filters.from.toISOString()}::timestamp AND "createdAt" < ${filters.to.toISOString()}::timestamp
    GROUP BY "normalizedQuery" ORDER BY COUNT(*) DESC, "normalizedQuery" ASC LIMIT 20`
}
