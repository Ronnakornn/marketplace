import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, readFile, unlink, writeFile, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import type { PrismaClient } from '#generated/client/client.ts'
import { numericThresholdFixture, thresholdDatabase, thresholdSale } from '#server/test-support/numeric-threshold.fixture.ts'
import { parseFinanceManifest, type FinanceManifest } from './reconcile-external-finance.ts'

describe.skipIf(!process.env['COMMERCE_TEST_DATABASE_URL'])('external finance CLI on local PostgreSQL', () => {
  let db: PrismaClient
  let directory: string
  let manifest: FinanceManifest
  let baseline: Awaited<ReturnType<typeof financialRows>>
  const observations: Array<{ case: string; exit: number | null; report: unknown; rowsUnchanged?: boolean }> = []

  async function financialRows() {
    return {
      payments: await db.payment.findMany({ where: { id: { in: manifest.scope.paymentIds } } }),
      refunds: await db.refund.findMany({ where: { id: { in: manifest.scope.refundIds } } }),
      payouts: await db.sellerPayout.findMany({ where: { id: { in: manifest.scope.payoutIds } } }),
      wallets: await db.shopWallet.findMany({ where: { payouts: { some: { id: { in: manifest.scope.payoutIds } } } } }),
      ledgers: await db.walletLedgerEntry.count({ where: { payoutId: { in: manifest.scope.payoutIds } } }),
    }
  }
  async function run(name: string, input = manifest) {
    await writeFile(join(directory, 'manifest.json'), JSON.stringify(input))
    const result = spawnSync('bun', ['run', 'scripts/reconcile-external-finance.ts', '--input', join(directory, 'manifest.json'), '--original', join(directory, 'original.json'), '--currencies', 'THB'], { cwd: process.cwd(), env: process.env, encoding: 'utf8', timeout: 30000 })
    if (result.error) throw result.error
    const report: unknown = JSON.parse(result.stdout)
    observations.push({ case: name, exit: result.status, report })
    expect(result.stderr).toBe('')
    expect(report).toMatchObject({ externalVerification: 'NOT_VERIFIED', databaseReadOnly: true, writeStatementsAttempted: 0 })
    return { exit: result.status, report }
  }
  beforeAll(async () => {
    db = thresholdDatabase()
    directory = await mkdtemp(join(tmpdir(), 'marketplace-finance-fixture-'))
    const f = await numericThresholdFixture(db)
    const sale = await thresholdSale(db, f, { amount: 9007199254740993n })
    const refund = await db.refund.create({ data: { orderId: sale.order.id, paymentId: sale.payment.id, status: 'SUCCESS', amount: 9007199254740991n, externalReference: `refund-${f.tag}` } })
    const wallet = await db.shopWallet.create({ data: { shopId: f.shop.id, currency: 'THB' } })
    const payout = await db.sellerPayout.create({ data: { walletId: wallet.id, shopId: f.shop.id, requestedById: f.owner.id, status: 'paid', amount: 9007199254740990n, currency: 'THB', externalReference: `bank-${f.tag}` } })
    const original = JSON.stringify({ fixture: true, note: 'Literal generated test records. No provider or bank execution.', payment: '9007199254740993', refund: '9007199254740991', payout: '9007199254740990' })
    await writeFile(join(directory, 'original.json'), original)
    manifest = parseFinanceManifest({
      formatVersion: 1,
      source: { kind: 'fixture', name: 'PostgreSQL CLI fixture', originalSha256: createHash('sha256').update(original).digest('hex'), mappingDescription: 'Literal minor units and canonical database statuses from a generated fixture. No external protocol mapping claimed.' },
      scope: { paymentIds: [sale.payment.id], refundIds: [refund.id], payoutIds: [payout.id] },
      records: [
        { kind: 'PAYMENT', id: sale.payment.id, orderId: sale.order.id, provider: 'mock', amount: '9007199254740993', currency: 'THB', status: 'SUCCEEDED', externalReference: sale.payment.providerIntentId, recordId: 'fixture-payment', sourceSequence: 2 },
        { kind: 'REFUND', id: refund.id, orderId: sale.order.id, paymentId: sale.payment.id, provider: 'mock', amount: '9007199254740991', currency: 'THB', status: 'SUCCESS', externalReference: refund.externalReference, recordId: 'fixture-refund', sourceSequence: 1 },
        { kind: 'PAYOUT', id: payout.id, walletId: wallet.id, shopId: f.shop.id, amount: '9007199254740990', currency: 'THB', status: 'paid', externalReference: payout.externalReference, recordId: 'fixture-payout', sourceSequence: 1 },
      ],
    })
    baseline = await financialRows()
  })
  afterEach(async () => {
    const current = await financialRows()
    expect(current).toEqual(baseline)
    if (observations.length > 0) observations[observations.length - 1]!.rowsUnchanged = true
  })
  afterAll(async () => {
    await writeFile('docs/test-evidence/2026-10-04-audit-completion/external-finance-cli.json', JSON.stringify({ proof: 'Generated fixture comparison only. External provider and bank are not verified.', observations }, null, 2))
    await db?.$disconnect()
    if (directory) {
      for (const file of ['manifest.json', 'original.json']) { try { await unlink(join(directory, file)) } catch { } }
      await rmdir(directory)
    }
  })

  it('matches Payment/Refund/Payout above MAX_SAFE with unchanged financial rows and exact totals', async () => {
    const result = await run('matched')
    expect(result.exit).toBe(0)
    expect(result.report).toMatchObject({ localComparison: 'MATCHED', matchedOperations: 3, discrepancies: [], totals: [
      { kind: 'PAYMENT', currency: 'THB', localAmount: '9007199254740993', recordAmount: '9007199254740993', difference: '0' },
      { kind: 'PAYOUT', currency: 'THB', localAmount: '9007199254740990', recordAmount: '9007199254740990', difference: '0' },
      { kind: 'REFUND', currency: 'THB', localAmount: '9007199254740991', recordAmount: '9007199254740991', difference: '0' },
    ] })
  })
  it('exits nonzero and reports a literal one-minor-unit payout discrepancy', async () => {
    const input = structuredClone(manifest)
    input.records[2]!.amount = '9007199254740991'
    const result = await run('payout-one-unit-mismatch', input)
    expect(result.exit).toBe(1)
    expect(result.report).toMatchObject({ localComparison: 'DISCREPANCIES', discrepancies: [{ code: 'FIELD_MISMATCH', field: 'amount', expected: '9007199254740990', received: '9007199254740991' }], totals: [{ difference: '0' }, { kind: 'PAYOUT', difference: '1' }, { difference: '0' }] })
  })
  it('rejects unsupported currency without converting or writing any balance', async () => {
    const input = structuredClone(manifest)
    input.records[1]!.currency = 'ZZZ'
    const result = await run('unknown-currency', input)
    expect(result.exit).toBe(1)
    expect(result.report).toMatchObject({ discrepancies: [{ code: 'UNSUPPORTED_CURRENCY', received: 'ZZZ' }, { code: 'FIELD_MISMATCH', field: 'currency', expected: 'THB', received: 'ZZZ' }] })
  })
  it('rejects an unknown bank reference and a wrong refund payment relation', async () => {
    const input = structuredClone(manifest)
    input.records[2]!.externalReference = 'unknown-bank-reference'
    const refund = input.records[1]!
    if (refund.kind !== 'REFUND') throw new Error('Refund fixture required')
    refund.paymentId = randomUUID()
    const result = await run('unknown-reference-and-relation', input)
    expect(result.exit).toBe(1)
    expect(result.report).toMatchObject({ discrepancies: [{ code: 'FIELD_MISMATCH', field: 'paymentId' }, { code: 'FIELD_MISMATCH', field: 'externalReference', received: 'unknown-bank-reference' }] })
  })
  it('ignores exact duplicates and out-of-order history, counting each operation once', async () => {
    const input = structuredClone(manifest)
    const payment = input.records[0]!
    if (payment.kind !== 'PAYMENT') throw new Error('Payment fixture required')
    input.records.push({ ...payment }, { ...payment, recordId: 'fixture-old-payment', sourceSequence: 1, status: 'PENDING' })
    const result = await run('duplicate-and-out-of-order', input)
    expect(result.exit).toBe(0)
    expect(result.report).toMatchObject({ inputRecords: 5, duplicateRecords: 1, finalOperations: 3, matchedOperations: 3, discrepancies: [] })
  })
  it('rejects conflicting duplicate input and an unmatched scoped row', async () => {
    const input = structuredClone(manifest)
    input.records.push({ ...input.records[2]!, amount: '1' })
    input.scope.paymentIds.push(randomUUID())
    const result = await run('conflicting-duplicate-and-unmatched-row', input)
    expect(result.exit).toBe(1)
    expect(result.report).toMatchObject({ discrepancies: [{ code: 'CONFLICTING_DUPLICATE' }, { code: 'LOCAL_ROW_MISSING' }, { code: 'EXTERNAL_ROW_MISSING' }] })
  })
  it('exits with input error before connecting when original file hash differs', async () => {
    const input = structuredClone(manifest)
    input.source.originalSha256 = '0'.repeat(64)
    await writeFile(join(directory, 'manifest.json'), JSON.stringify(input))
    const result = spawnSync('bun', ['run', 'scripts/reconcile-external-finance.ts', '--input', join(directory, 'manifest.json'), '--original', join(directory, 'original.json'), '--currencies', 'THB'], { env: process.env, encoding: 'utf8', timeout: 30000 })
    const report: unknown = JSON.parse(result.stdout)
    observations.push({ case: 'original-hash-mismatch', exit: result.status, report })
    expect(result.status).toBe(2)
    expect(report).toEqual({ localComparison: 'ERROR', externalVerification: 'NOT_VERIFIED', discrepancies: [{ code: 'ORIGINAL_FILE_HASH_MISMATCH' }] })
    expect(await readFile(join(directory, 'original.json'), 'utf8')).toContain('No provider or bank execution')
  })
})
