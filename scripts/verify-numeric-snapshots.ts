import { numericSnapshotInvariantSql } from "./numeric-snapshot-invariants.ts"
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
  const violations = await db.$queryRawUnsafe<Array<{ check: string; violations: bigint }>>(numericSnapshotInvariantSql)
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
