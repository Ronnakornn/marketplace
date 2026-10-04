import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { Client } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#generated/client/client.ts'
import { numericThresholdFixture, thresholdSale } from '#server/test-support/numeric-threshold.fixture.ts'
import { auditConnection, auditNumericDatabase, withAuditSnapshot, type AuditConnection } from './audit-numeric-database.ts'

const adminUrl = process.env['AUDIT_TEST_DATABASE_URL']

describe.skipIf(!adminUrl)('read-only numeric audit on actual disposable PostgreSQL', () => {
  const suffix = randomUUID().replaceAll('-', '')
  const reader = `audit_reader_${suffix}`
  const writer = `audit_writer_${suffix}`
  const inherited = `audit_member_${suffix}`
  const owner = `audit_owner_${suffix}`
  const relationOwner = `audit_relation_${suffix}`
  const columnWriter = `audit_column_${suffix}`
  const password = randomUUID()
  let admin: Client
  let db: PrismaClient
  let connection: AuditConnection
  let fixture: Awaited<ReturnType<typeof numericThresholdFixture>>
  let large: Awaited<ReturnType<typeof thresholdSale>>
  let baselineReport: Awaited<ReturnType<typeof auditNumericDatabase>>
  const observations: Array<Record<string, unknown>> = []
  const roles = [reader, writer, inherited, owner, relationOwner, columnWriter]

  function roleEnvironment(role = reader) {
    const url = new URL(adminUrl!)
    url.username = role; url.password = password
    return { ...process.env, AUDIT_DATABASE_URL: url.toString(), AUDIT_EXPECTED_HOST: url.hostname,
      AUDIT_EXPECTED_DATABASE: url.pathname.slice(1), AUDIT_EXPECTED_ROLE: role }
  }
  async function fingerprint() {
    const rows = (await admin.query<{ source: string; rows: string; digest: string }>(`
      SELECT 'Order' AS source,COUNT(*)::text AS rows,md5(COALESCE(string_agg(t::text,',' ORDER BY id),'')) AS digest FROM "Order" t
      UNION ALL SELECT 'OrderItem',COUNT(*)::text,md5(COALESCE(string_agg(t::text,',' ORDER BY id),'')) FROM "OrderItem" t
      UNION ALL SELECT 'ShopOrder',COUNT(*)::text,md5(COALESCE(string_agg(t::text,',' ORDER BY id),'')) FROM "ShopOrder" t
      UNION ALL SELECT 'Payment',COUNT(*)::text,md5(COALESCE(string_agg(t::text,',' ORDER BY id),'')) FROM "Payment" t
      UNION ALL SELECT 'Refund',COUNT(*)::text,md5(COALESCE(string_agg(t::text,',' ORDER BY id),'')) FROM "Refund" t
      UNION ALL SELECT 'SellerPayout',COUNT(*)::text,md5(COALESCE(string_agg(t::text,',' ORDER BY id),'')) FROM "SellerPayout" t
      UNION ALL SELECT 'WalletLedgerEntry',COUNT(*)::text,md5(COALESCE(string_agg(t::text,',' ORDER BY id),'')) FROM "WalletLedgerEntry" t
      UNION ALL SELECT 'ShopWallet',COUNT(*)::text,md5(COALESCE(string_agg(t::text,',' ORDER BY id),'')) FROM "ShopWallet" t
      UNION ALL SELECT 'Inventory',COUNT(*)::text,md5(COALESCE(string_agg(t::text,',' ORDER BY id),'')) FROM "Inventory" t
      UNION ALL SELECT 'ItemSaleSnapshot',COUNT(*)::text,md5(COALESCE(string_agg(t::text,',' ORDER BY "orderItemId"),'')) FROM "ItemSaleSnapshot" t
      UNION ALL SELECT 'ShopSaleSnapshot',COUNT(*)::text,md5(COALESCE(string_agg(t::text,',' ORDER BY "shopOrderId"),'')) FROM "ShopSaleSnapshot" t
      UNION ALL SELECT 'RefundItemAllocation',COUNT(*)::text,md5(COALESCE(string_agg(t::text,',' ORDER BY id),'')) FROM "RefundItemAllocation" t
      UNION ALL SELECT 'RefundShopAllocation',COUNT(*)::text,md5(COALESCE(string_agg(t::text,',' ORDER BY id),'')) FROM "RefundShopAllocation" t
      ORDER BY source`)).rows
    return rows
  }
  beforeAll(async () => {
    const url = new URL(adminUrl!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/(marketplace_test_|marketplace_e2e_)[a-zA-Z0-9_]+$/.test(url.pathname)) {
      throw new Error('Audit role fixtures require a disposable local test database')
    }
    admin = new Client({ connectionString: adminUrl }); await admin.connect()
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: adminUrl }) })
    for (const role of roles) {
      await admin.query(`CREATE ROLE "${role}" LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT`)
      await admin.query(`GRANT CONNECT ON DATABASE "${url.pathname.slice(1)}" TO "${role}"`)
      await admin.query(`GRANT USAGE ON SCHEMA public TO "${role}"`)
      await admin.query(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${role}"`)
    }
    await admin.query(`GRANT UPDATE ON "Order" TO "${writer}"`)
    await admin.query(`GRANT "${writer}" TO "${inherited}"`)
    await admin.query(`GRANT CREATE ON SCHEMA public TO "${owner}"`)
    await admin.query(`GRANT CREATE ON SCHEMA public TO "${relationOwner}"`)
    await admin.query(`CREATE VIEW "audit_ownership_probe_${suffix}" AS SELECT 1 AS fixture_value`)
    await admin.query(`ALTER VIEW "audit_ownership_probe_${suffix}" OWNER TO "${relationOwner}"`)
    await admin.query(`REVOKE CREATE ON SCHEMA public FROM "${relationOwner}"`)
    await admin.query(`GRANT UPDATE ("grandTotal") ON "Order" TO "${columnWriter}"`)
    connection = auditConnection(roleEnvironment())
    baselineReport = await auditNumericDatabase(connection)
    expect(baselineReport.audit).toBe('PASS')
    fixture = await numericThresholdFixture(db)
    large = await thresholdSale(db, fixture, { amount: 9007199254740993n })
    await thresholdSale(db, fixture, { amount: 7n })
    const usd = await thresholdSale(db, fixture, { amount: 13n, paymentState: 'PENDING' })
    await db.$transaction([
      db.order.update({ where: { id: usd.order.id }, data: { currency: 'USD' } }),
      db.shopOrder.update({ where: { id: usd.shopOrder.id }, data: { currency: 'USD' } }),
      db.payment.update({ where: { id: usd.payment.id }, data: { currency: 'USD' } }),
    ])
    const refund = await db.refund.create({ data: { orderId: large.order.id, paymentId: large.payment.id, status: 'SUCCESS', amount: 9007199254740991n } })
    const wallet = await db.shopWallet.create({ data: { shopId: fixture.shop.id, currency: 'THB' } })
    await db.sellerPayout.create({ data: { walletId: wallet.id, shopId: fixture.shop.id, requestedById: fixture.owner.id, status: 'paid', amount: 9007199254740990n, currency: 'THB' } })
    await db.walletLedgerEntry.create({ data: { walletId: wallet.id, shopId: fixture.shop.id, type: 'order_earning', amount: 9007199254740989n, currency: 'THB', orderId: large.order.id, refundId: refund.id } })
  }, 30000)
  afterAll(async () => {
    if (fixture && db) {
      await db.walletLedgerEntry.deleteMany({ where: { shopId: fixture.shop.id } })
      await db.sellerPayout.deleteMany({ where: { shopId: fixture.shop.id } })
      await db.refund.deleteMany({ where: { order: { userId: fixture.buyer.id } } })
      await db.shopWallet.deleteMany({ where: { shopId: fixture.shop.id } })
      await db.order.deleteMany({ where: { userId: fixture.buyer.id } })
      await db.checkout.deleteMany({ where: { userId: fixture.buyer.id } })
      await db.cart.deleteMany({ where: { userId: fixture.buyer.id } })
      await db.user.deleteMany({ where: { id: { in: [fixture.owner.id, fixture.buyer.id] } } })
      await db.category.delete({ where: { id: fixture.category.id } })
      await db.brand.delete({ where: { id: fixture.brand.id } })
    }
    if (admin) {
      for (const role of [...roles].reverse()) {
        await admin.query(`DROP OWNED BY "${role}"`)
        await admin.query(`DROP ROLE "${role}"`)
      }
      await admin.end()
    }
    await db?.$disconnect()
    if (process.env['AUDIT_TEST_EVIDENCE_PATH']) {
      await mkdir('docs/test-evidence/2026-10-05-production-readiness', { recursive: true })
      await writeFile(process.env['AUDIT_TEST_EVIDENCE_PATH'], JSON.stringify({ environment: 'Disposable local PostgreSQL fixtures. No production/provider/bank connection.', observations }, null, 2))
    }
  }, 30000)

  it.each([
    ['administrator', () => auditConnection({ ...roleEnvironment(), AUDIT_DATABASE_URL: adminUrl!, AUDIT_EXPECTED_ROLE: new URL(adminUrl!).username }), 'ADMINISTRATOR_ROLE_REJECTED'],
    ['direct writer', () => auditConnection(roleEnvironment(writer)), 'TABLE_WRITER_ROLE_REJECTED'],
    ['NOINHERIT writer membership', () => auditConnection(roleEnvironment(inherited)), 'TABLE_WRITER_ROLE_REJECTED'],
    ['schema creator', () => auditConnection(roleEnvironment(owner)), 'OWNER_OR_CREATOR_ROLE_REJECTED'],
    ['relation owner without schema CREATE', () => auditConnection(roleEnvironment(relationOwner)), 'OWNER_OR_CREATOR_ROLE_REJECTED'],
    ['column writer', () => auditConnection(roleEnvironment(columnWriter)), 'TABLE_WRITER_ROLE_REJECTED'],
  ] as const)('rejects %s before entering the numeric scan', async (name, selectedConnection, code) => {
    const before = await fingerprint()
    let scanned = false
    await expect(withAuditSnapshot(selectedConnection(), async () => { scanned = true })).rejects.toThrow(code)
    expect(scanned).toBe(false)
    expect(await fingerprint()).toEqual(before)
    observations.push({ case: name, rejected: code, numericScanEntered: scanned, rowsUnchanged: true })
  })

  it('passes twelve checks, retaining literal large amounts and separate currencies/statuses', async () => {
    const before = await fingerprint()
    const report = await auditNumericDatabase(connection)
    expect(report.audit).toBe('PASS')
    expect(report.violations).toHaveLength(12)
    expect(report.violations.every(row => row.violations === '0')).toBe(true)
    for (const [currency, status, increment] of [['THB', 'SUCCEEDED', '9007199254741000'], ['USD', 'PENDING', '13']] as const) {
      const prior = baselineReport.aggregates.find(row => row.source === 'Payment' && row.currency === currency && row.status === status)
      expect(report.aggregates.find(row => row.source === 'Payment' && row.currency === currency && row.status === status)).toMatchObject({
        amount: (BigInt(prior?.amount ?? '0') + BigInt(increment)).toString(), rows: (BigInt(prior?.rows ?? '0') + BigInt(currency === 'THB' ? 2 : 1)).toString(),
      })
    }
    for (const [source, status, increment, groupedBy] of [
      ['Refund', 'SUCCESS', '9007199254740991', 'status'],
      ['SellerPayout', 'paid', '9007199254740990', 'status'],
      ['WalletLedgerEntry', 'order_earning', '9007199254740989', 'type'],
    ] as const) {
      const prior = baselineReport.aggregates.find(row => row.source === source && row.currency === 'THB' && row.status === status)
      expect(report.aggregates.find(row => row.source === source && row.currency === 'THB' && row.status === status)).toMatchObject({
        amount: (BigInt(prior?.amount ?? '0') + BigInt(increment)).toString(), rows: (BigInt(prior?.rows ?? '0') + 1n).toString(), grouped_by: groupedBy,
      })
    }
    expect(await fingerprint()).toEqual(before)
    observations.push({ case: 'exact groups and twelve invariants', report, rowsUnchanged: true,
      literalFixturePaymentTotals: [{ currency: 'THB', status: 'SUCCEEDED', amount: '9007199254741000', rows: '2' }, { currency: 'USD', status: 'PENDING', amount: '13', rows: '1' }] })
  })

  it('exits one on an actual one-minor-unit stored discrepancy without modifying it', async () => {
    await db.payment.update({ where: { id: large.payment.id }, data: { amount: 9007199254740994n } })
    try {
      const before = await fingerprint()
      const result = spawnSync('bun', ['run', 'scripts/run-numeric-audit.ts'], { env: roleEnvironment(), encoding: 'utf8', timeout: 30000 })
      if (result.error) throw result.error
      expect(result.status).toBe(1)
      expect(result.stderr).toBe('')
      const report: unknown = JSON.parse(result.stdout)
      expect(report).toMatchObject({ audit: 'DISCREPANCIES',
        violations: expect.arrayContaining([{ check: 'payment_snapshot_amount', violations: '1' }]) })
      expect(await fingerprint()).toEqual(before)
      observations.push({ case: 'one cent stored payment mismatch', exit: result.status, report, rowsUnchanged: true })
    } finally { await db.payment.update({ where: { id: large.payment.id }, data: { amount: 9007199254740993n } }) }
  })

  it('actually prohibits writes at the role and READ ONLY transaction boundaries', async () => {
    const before = await fingerprint()
    const ordinary = new Client({ host: connection.host, port: connection.port, database: connection.database, user: reader, password })
    await ordinary.connect()
    try {
      await expect(ordinary.query('UPDATE "Payment" SET amount = amount + 1 WHERE id=$1', [large.payment.id])).rejects.toMatchObject({ code: '42501' })
    } finally { await ordinary.end() }
    const code = await withAuditSnapshot(connection, async client => {
      try { await client.query('UPDATE "Payment" SET amount = amount + 1 WHERE id=$1', [large.payment.id]) }
      catch (error) {
        if (error instanceof Error && 'code' in error && typeof error.code === 'string') return error.code
        throw error
      }
      throw new Error('A real write unexpectedly succeeded')
    })
    expect(code).toBe('25006')
    expect(await fingerprint()).toEqual(before)
    observations.push({ case: 'actual prohibited updates', ordinaryTransactionSqlState: '42501', readOnlyTransactionSqlState: code, rowsUnchanged: true })
  })

  it('uses one repeatable snapshot despite a concurrent authorized fixture writer', async () => {
    const amounts = await withAuditSnapshot(connection, async client => {
      const first = (await client.query<{ amount: string }>('SELECT amount::text FROM "Payment" WHERE id=$1', [large.payment.id])).rows[0]!.amount
      await db.payment.update({ where: { id: large.payment.id }, data: { amount: 9007199254740994n } })
      const second = (await client.query<{ amount: string }>('SELECT amount::text FROM "Payment" WHERE id=$1', [large.payment.id])).rows[0]!.amount
      return [first, second]
    }).finally(async () => { await db.payment.update({ where: { id: large.payment.id }, data: { amount: 9007199254740993n } }) })
    expect(amounts).toEqual(['9007199254740993', '9007199254740993'])
    observations.push({ case: 'concurrent fixture writer snapshot', amounts, isolation: 'repeatable read' })
  })

  it('exits zero for a valid reader and two for a writer without printing credentials/PII', async () => {
    for (const [role, exit] of [[reader, 0], [writer, 2]] as const) {
      const before = await fingerprint()
      const result = spawnSync('bun', ['run', 'scripts/run-numeric-audit.ts'], { env: roleEnvironment(role), encoding: 'utf8', timeout: 30000 })
      if (result.error) throw result.error
      expect(result.status).toBe(exit)
      expect(result.stderr).toBe('')
      expect(result.stdout).not.toContain(password)
      expect(result.stdout).not.toContain(fixture.buyer.email)
      expect(result.stdout).not.toContain(large.payment.id)
      expect(await fingerprint()).toEqual(before)
      observations.push({ case: `CLI ${role === reader ? 'reader' : 'writer'}`, exit, report: JSON.parse(result.stdout), rowsUnchanged: true })
    }
  })

  it('rejects apply arguments and ignores the global writer URL when explicit audit identity is absent', async () => {
    const before = await fingerprint()
    const apply = spawnSync('bun', ['run', 'scripts/run-numeric-audit.ts', '--apply'], { env: roleEnvironment(), encoding: 'utf8', timeout: 30000 })
    expect(apply.status).toBe(2)
    expect(JSON.parse(apply.stdout)).toMatchObject({ audit: 'REJECTED', code: 'AUDIT_ARGUMENTS_NOT_SUPPORTED' })
    const environment: NodeJS.ProcessEnv = { ...roleEnvironment(), DATABASE_URL: adminUrl! }
    delete environment.AUDIT_DATABASE_URL
    const missing = spawnSync('bun', ['run', 'scripts/run-numeric-audit.ts'], { env: environment, encoding: 'utf8', timeout: 30000 })
    expect(missing.status).toBe(2)
    expect(JSON.parse(missing.stdout)).toMatchObject({ audit: 'REJECTED', code: 'EXPLICIT_AUDIT_IDENTITY_REQUIRED' })
    expect(await fingerprint()).toEqual(before)
    observations.push({ case: 'no apply or writer fallback', applyExit: apply.status, missingExplicitUrlExit: missing.status, rowsUnchanged: true })
  })

  it('detects a missing item snapshot for an actual version2 shop sale', async () => {
    const sale = await thresholdSale(db, fixture, { amount: 100n })
    await db.shopSaleSnapshot.create({ data: { shopOrderId: sale.shopOrder.id, policyVersion: 2, currency: 'THB',
      commissionBase: 100n, commissionBps: 1000, originalCommission: 10n, originalShipping: 0n,
      buyerShipping: 0n, sellerShippingWaiver: 0n, platformShippingSubsidy: 0n } })
    try {
      const before = await fingerprint()
      const report = await auditNumericDatabase(connection)
      const cli = spawnSync('bun', ['run', 'scripts/run-numeric-audit.ts'], { env: roleEnvironment(), encoding: 'utf8', timeout: 30000 })
      if (cli.error) throw cli.error
      const cliReport: unknown = JSON.parse(cli.stdout)
      expect(cli.status).toBe(1)
      expect(cli.stderr).toBe('')
      expect(cliReport).toMatchObject({ audit: 'DISCREPANCIES', additionalViolations: expect.arrayContaining([
        { check: 'original_v2_item_snapshot_completeness', violations: '1' },
      ]) })
      expect(report.violations.every(row => row.violations === '0')).toBe(true)
      expect(report).toMatchObject({ audit: 'DISCREPANCIES', additionalViolations: [
        { check: 'original_v2_item_snapshot_completeness', violations: '1' },
        { check: 'shipping_only_refund_cash', violations: '0' },
      ] })
      expect(await fingerprint()).toEqual(before)
      observations.push({ case: 'version2 missing ItemSaleSnapshot', report, cliExit: cli.status, missingItemSnapshotRows: 1, rowsUnchanged: true })
      await db.itemSaleSnapshot.create({ data: { orderItemId: sale.item.id, shopOrderId: sale.shopOrder.id,
        originalQuantity: 1, grossMerchandise: 100n, sellerCouponDiscount: 0n, platformCouponDiscount: 0n,
        coinDiscount: 0n, buyerMerchandise: 100n, buyerMerchandiseNet: 100n, buyerMerchandiseTax: 0n,
        platformCouponNet: 0n, platformCouponTax: 0n, coinFundingNet: 0n, coinFundingTax: 0n,
        originalCashbackEligibleNet: 100n, originalAffiliateEligibleNet: 100n } })
      const repaired = await auditNumericDatabase(connection)
      expect(repaired.audit).toBe('PASS')
      expect(repaired.additionalViolations).toEqual([
        { check: 'original_v2_item_snapshot_completeness', violations: '0' },
        { check: 'shipping_only_refund_cash', violations: '0' },
      ])
      observations.push({ case: 'complete version2 fixture', report: repaired })
    } finally { await db.shopSaleSnapshot.delete({ where: { shopOrderId: sale.shopOrder.id } }) }
  })

  it('accepts a valid shipping-only refund and detects its one-cent discrepancy', async () => {
    const sale = await thresholdSale(db, fixture, { amount: 100n })
    await db.$transaction([
      db.checkout.update({ where: { id: sale.checkout.id }, data: { shippingTotal: 20n, grandTotal: 120n } }),
      db.order.update({ where: { id: sale.order.id }, data: { shippingTotal: 20n, grandTotal: 120n } }),
      db.shopOrder.update({ where: { id: sale.shopOrder.id }, data: { shippingTotal: 20n, grandTotal: 120n } }),
      db.payment.update({ where: { id: sale.payment.id }, data: { amount: 120n } }),
    ])
    await db.shopSaleSnapshot.create({ data: { shopOrderId: sale.shopOrder.id, currency: 'THB',
      commissionBase: 100n, commissionBps: 1000, originalCommission: 10n, originalShipping: 20n,
      buyerShipping: 20n, sellerShippingWaiver: 0n, platformShippingSubsidy: 0n } })
    const refund = await db.refund.create({ data: { orderId: sale.order.id, paymentId: sale.payment.id, status: 'SUCCESS', amount: 20n } })
    await db.refundShopAllocation.create({ data: { refundId: refund.id, shopOrderId: sale.shopOrder.id, buyerShippingRefund: 20n, shippingCause: 'SELLER_FAULT' } })
    try {
      const validBefore = await fingerprint()
      const valid = await auditNumericDatabase(connection)
      expect(valid.audit).toBe('PASS')
      expect(await fingerprint()).toEqual(validBefore)
      await db.refund.update({ where: { id: refund.id }, data: { amount: 21n } })
      const before = await fingerprint()
      const report = await auditNumericDatabase(connection)
      const cli = spawnSync('bun', ['run', 'scripts/run-numeric-audit.ts'], { env: roleEnvironment(), encoding: 'utf8', timeout: 30000 })
      if (cli.error) throw cli.error
      const cliReport: unknown = JSON.parse(cli.stdout)
      expect(cli.status).toBe(1)
      expect(cli.stderr).toBe('')
      expect(cliReport).toMatchObject({ audit: 'DISCREPANCIES', additionalViolations: expect.arrayContaining([
        { check: 'shipping_only_refund_cash', violations: '1' },
      ]) })
      expect(report.violations.every(row => row.violations === '0')).toBe(true)
      expect(report).toMatchObject({ audit: 'DISCREPANCIES', additionalViolations: [
        { check: 'original_v2_item_snapshot_completeness', violations: '0' },
        { check: 'shipping_only_refund_cash', violations: '1' },
      ] })
      expect(await fingerprint()).toEqual(before)
      observations.push({ case: 'shipping-only refund cash21 versus allocation20', validReport: valid, report, cliExit: cli.status, itemAllocationRows: 0, buyerShippingRefund: '20', storedRefund: '21', rowsUnchanged: true })
    } finally {
      await db.refund.delete({ where: { id: refund.id } })
      await db.shopSaleSnapshot.delete({ where: { shopOrderId: sale.shopOrder.id } })
    }
  })
})
