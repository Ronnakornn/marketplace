import { Client } from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { normalizeReportFilters } from './reporting.filters.ts'
import { reportQuery } from './reporting.sql.ts'

const database = process.env.REPORTING_TEST_DATABASE_URL
describe.skipIf(!database)('report SQL against isolated PostgreSQL', () => {
  const client = new Client({ connectionString: database })
  beforeAll(async () => {
    await client.connect()
    await client.query('BEGIN')
    await client.query(`
      CREATE TEMP TABLE "Order" (id uuid PRIMARY KEY,"createdAt" timestamp,"shippingRegion" text,"shippingCountry" text,"shippingTotal" bigint DEFAULT 0,"discountTotal" bigint DEFAULT 0,"reportedTaxTotal" bigint DEFAULT 0,"taxTotal" bigint DEFAULT 0) ON COMMIT DROP;
      CREATE TEMP TABLE "OrderItem" (id uuid PRIMARY KEY,"orderId" uuid,"shopId" uuid,"variantId" uuid,"quantity" int,"lineTotal" bigint,"fulfillmentStatus" text,currency text,"shopName" text,"productTitle" text) ON COMMIT DROP;
      CREATE TEMP TABLE "ProductVariant" (id uuid PRIMARY KEY,"productId" uuid) ON COMMIT DROP;
      CREATE TEMP TABLE "Product" (id uuid PRIMARY KEY,"categoryId" uuid) ON COMMIT DROP;
      CREATE TEMP TABLE "Category" (id uuid PRIMARY KEY,name text) ON COMMIT DROP;
      CREATE TEMP TABLE "ShopOrder" (id uuid PRIMARY KEY,"orderId" uuid,"shopId" uuid,"shippingTotal" bigint,"reportedTaxTotal" bigint,"taxTotal" bigint,"discountTotal" bigint DEFAULT 0) ON COMMIT DROP;
      CREATE TEMP TABLE "ShopSaleSnapshot" ("shopOrderId" uuid,"originalCommission" bigint,"platformShippingSubsidy" bigint,"policyVersion" int) ON COMMIT DROP;
      CREATE TEMP TABLE "ItemSaleSnapshot" ("orderItemId" uuid,"buyerMerchandiseNet" bigint,"buyerMerchandiseTax" bigint,"buyerMerchandise" bigint,"sellerCouponDiscount" bigint,"platformCouponDiscount" bigint,"coinDiscount" bigint,"platformCouponNet" bigint,"platformCouponTax" bigint,"coinFundingNet" bigint,"coinFundingTax" bigint) ON COMMIT DROP;
      CREATE TEMP TABLE "Payment" ("orderId" uuid,status text) ON COMMIT DROP;
      CREATE TEMP TABLE "Refund" (id uuid,"orderId" uuid,status text,"completedAt" timestamp) ON COMMIT DROP;
      CREATE TEMP TABLE "RefundItemAllocation" ("refundId" uuid,"orderItemId" uuid,"cashMerchandise" bigint,"buyerTaxRefund" bigint,"platformCouponReversal" bigint,"platformCouponTaxReversal" bigint,"coinFundingReversal" bigint,"coinTaxReversal" bigint) ON COMMIT DROP;
      CREATE TEMP TABLE "RefundShopAllocation" ("refundId" uuid,"shopOrderId" uuid,"buyerShippingRefund" bigint,"buyerShippingTaxRefund" bigint,"commissionReversal" bigint,"platformShippingReversal" bigint,"platformShippingTaxReversal" bigint) ON COMMIT DROP;
    `)
    const uuid = (id: number) =>
      `00000000-0000-4000-8000-${id.toString().padStart(12, '0')}`
    const orderId = uuid(100),
      shop1 = uuid(11),
      shop2 = uuid(12),
      shop3 = uuid(13)
    await client.query(
      'INSERT INTO "Order" (id,"createdAt","shippingRegion","shippingCountry") VALUES($1,$2,$3,$4)',
      [orderId, '2026-09-30 17:00:00', 'Bangkok', 'TH'],
    )
    await client.query(
      "INSERT INTO \"Payment\" VALUES($1,'SUCCEEDED'),($1,'SUCCEEDED')",
      [orderId],
    )
    for (let index = 1; index <= 4; index++) {
      const lineTotal = [100, 200, 300, 60][index - 1]!,
        shop = index < 3 ? shop1 : index === 3 ? shop2 : shop3
      await client.query('INSERT INTO "Product" VALUES($1,$2)', [
        uuid(200 + index),
        uuid(500),
      ])
      await client.query('INSERT INTO "ProductVariant" VALUES($1,$2)', [
        uuid(300 + index),
        uuid(200 + index),
      ])
      await client.query(
        'INSERT INTO "OrderItem" VALUES($1,$2,$3,$4,1,$5,$6,\'THB\',$7,$8)',
        [
          uuid(index),
          orderId,
          shop,
          uuid(300 + index),
          lineTotal,
          index === 4 ? 'CANCELED' : 'PENDING',
          `Shop ${shop}`,
          `Product ${index}`,
        ],
      )
      await client.query(
        'INSERT INTO "ItemSaleSnapshot" VALUES($1,NULL,NULL,$2,$3,$4,$5,NULL,NULL,NULL,NULL)',
        [
          uuid(index),
          [80, 160, 250, 50][index - 1],
          [9, 18, 17, 0][index - 1],
          [10, 20, 30, 10][index - 1],
          [1, 2, 3, 0][index - 1],
        ],
      )
    }
    await client.query(
      'INSERT INTO "Category" VALUES($1,\'Current category\')',
      [uuid(500)],
    )
    for (const [id, shop, shipping, fee, subsidy] of [
      [21, shop1, 5, 3, 1],
      [22, shop2, 7, 6, 2],
      [23, shop3, 0, 5, 0],
    ]) {
      await client.query('INSERT INTO "ShopOrder" VALUES($1,$2,$3,$4,0,0)', [
        uuid(Number(id)),
        orderId,
        shop,
        shipping,
      ])
      await client.query('INSERT INTO "ShopSaleSnapshot" VALUES($1,$2,$3,1)', [
        uuid(Number(id)),
        fee,
        subsidy,
      ])
    }
    for (const [
      id,
      item,
      shopOrder,
      cash,
      coupon,
      coin,
      shipping,
      fee,
      subsidy,
    ] of [
      [41, 1, 21, 10, 2, 1, 1, 1, 0],
      [42, 1, 21, 20, 4, 2, 2, 1, 1],
      [43, 4, 23, 50, 10, 0, 0, 5, 0],
    ]) {
      await client.query(
        "INSERT INTO \"Refund\" VALUES($1,$2,'SUCCESS','2026-10-01 00:00:00')",
        [uuid(id!), orderId],
      )
      await client.query(
        'INSERT INTO "RefundItemAllocation" VALUES($1,$2,$3,0,$4,0,$5,0)',
        [uuid(id!), uuid(item!), cash, coupon, coin],
      )
      await client.query(
        'INSERT INTO "RefundShopAllocation" VALUES($1,$2,$3,0,$4,$5,0)',
        [uuid(id!), uuid(shopOrder!), shipping, fee, subsidy],
      )
    }
    await client.query(
      'INSERT INTO "Order" (id,"createdAt","shippingRegion","shippingCountry") VALUES($1,\'2026-10-01 17:00:00\',\'Bangkok\',\'TH\')',
      [uuid(101)],
    )
    await client.query('INSERT INTO "Payment" VALUES($1,\'SUCCEEDED\')', [
      uuid(101),
    ])
    await client.query(
      "INSERT INTO \"OrderItem\" VALUES($1,$2,$3,$4,1,9007199254740993123,'PENDING','USD','Shop','Large')",
      [uuid(9), uuid(101), shop1, uuid(301)],
    )
    await client.query('INSERT INTO "ShopOrder" VALUES($1,$2,$3,0,0,0)', [
      uuid(29),
      uuid(101),
      shop1,
    ])
  })
  afterAll(async () => {
    await client.query('ROLLBACK')
    await client.end()
  })
  it('counts multi-shop orders once, preserves exact sums and avoids multiplying refunds', async () => {
    const sql = reportQuery(
      normalizeReportFilters({
        from: '2026-10-01',
        to: '2026-10-02',
        group: 'day',
      }),
    )
    const { rows } = await client.query(sql.text, sql.values)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      key: '2026-10-01',
      currency: 'THB',
      orders: '1',
      units: '3',
      gmv: '600',
      paidMerchandise: '490',
      shipping: '12',
      tax: '0',
      discount: '110',
      refund: '83',
      originalCommission: '14',
      commissionReversal: '7',
      platformFunding: '79',
      fundingReversal: '20',
      contribution: '-52',
      snapshotMissing: '0',
    })
  })
  it('allocates shop metrics before product filtering with exact remainders', async () => {
    const sql = reportQuery(
      normalizeReportFilters({
        from: '2026-10-01',
        to: '2026-10-02',
        group: 'product',
        productId: '00000000-0000-4000-8000-000000000201',
      }),
    )
    const { rows } = await client.query(sql.text, sql.values)
    expect(rows[0]).toMatchObject({
      gmv: '100',
      shipping: '1',
      originalCommission: '1',
      refund: '30',
      commissionReversal: '0',
      platformFunding: '11',
      fundingReversal: '9',
    })
  })
  it('includes the lower boundary, excludes upper boundary and keeps large money exact', async () => {
    const sql = reportQuery(
      normalizeReportFilters({
        from: '2026-10-02',
        to: '2026-10-03',
        group: 'day',
      }),
    )
    const { rows } = await client.query(sql.text, sql.values)
    expect(rows[0]).toMatchObject({
      key: '2026-10-02',
      currency: 'USD',
      gmv: '9007199254740993123',
      snapshotMissing: '1',
    })
  })
})
