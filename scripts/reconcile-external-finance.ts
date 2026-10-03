import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { PrismaPg } from '@prisma/adapter-pg'
import { Value } from '@sinclair/typebox/value'
import { t, type Static } from 'elysia'
import { PrismaClient, type Payment, type Refund, type SellerPayout } from '../generated/client/client.ts'
import { PaymentPlain } from '../generated/prismabox/Payment.ts'
import { RefundPlain } from '../generated/prismabox/Refund.ts'
import { SellerPayoutPlain } from '../generated/prismabox/SellerPayout.ts'
import { MinorUnitString } from '../server/lib/money.ts'

const uuidPattern = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
const Id = t.String({ ...PaymentPlain.properties.id, pattern: uuidPattern })
const Currency = t.String({ ...PaymentPlain.properties.currency, pattern: '^[A-Z]{3}$' })
const common = {
  id: Id,
  recordId: t.String({ minLength: 1, maxLength: 200 }),
  sourceSequence: t.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
  amount: t.String({ ...MinorUnitString, pattern: '^(0|[1-9][0-9]*)$', maxLength: 19 }),
  currency: Currency,
  externalReference: t.String({ minLength: 1, maxLength: 200 }),
}
const PaymentRecord = t.Object({ ...t.Pick(PaymentPlain, ['provider', 'status']).properties, ...common, kind: t.Literal('PAYMENT'), orderId: Id }, { additionalProperties: false })
const RefundRecord = t.Object({ ...t.Pick(RefundPlain, ['status']).properties, provider: PaymentPlain.properties.provider, ...common, kind: t.Literal('REFUND'), orderId: Id, paymentId: Id }, { additionalProperties: false })
const PayoutRecord = t.Object({ ...t.Pick(SellerPayoutPlain, ['status']).properties, ...common, kind: t.Literal('PAYOUT'), walletId: Id, shopId: Id }, { additionalProperties: false })
export const FinanceManifestSchema = t.Object({
  formatVersion: t.Literal(1),
  source: t.Object({ kind: t.Union([t.Literal('fixture'), t.Literal('operator_supplied')]), name: t.String({ minLength: 1, maxLength: 200 }), originalSha256: t.String({ pattern: '^[0-9a-f]{64}$' }), mappingDescription: t.String({ minLength: 1, maxLength: 2000 }) }, { additionalProperties: false }),
  scope: t.Object({ paymentIds: t.Array(Id, { maxItems: 10000, uniqueItems: true }), refundIds: t.Array(Id, { maxItems: 10000, uniqueItems: true }), payoutIds: t.Array(Id, { maxItems: 10000, uniqueItems: true }) }, { additionalProperties: false }),
  records: t.Array(t.Union([PaymentRecord, RefundRecord, PayoutRecord]), { maxItems: 10000 }),
}, { additionalProperties: false })
export type FinanceManifest = Static<typeof FinanceManifestSchema>
type ExternalRecord = FinanceManifest['records'][number]
type Kind = ExternalRecord['kind']
export type LocalFinanceRecord = (
  | (Pick<Payment, 'id' | 'orderId' | 'provider' | 'status' | 'currency'> & { kind: 'PAYMENT' })
  | (Pick<Refund, 'id' | 'orderId' | 'paymentId' | 'status'> & Pick<Payment, 'provider' | 'currency'> & { kind: 'REFUND' })
  | (Pick<SellerPayout, 'id' | 'walletId' | 'shopId' | 'status' | 'currency'> & { kind: 'PAYOUT' })
) & Pick<Refund, 'amount' | 'externalReference'>
export type FinanceDiscrepancy = { code: string; kind?: Kind; id?: string; field?: string; expected?: string; received?: string }
const scopeFields = { PAYMENT: 'paymentIds', REFUND: 'refundIds', PAYOUT: 'payoutIds' } as const
const key = (record: { kind: Kind; id: string }) => `${record.kind}:${record.id}`
const signature = (record: ExternalRecord) => JSON.stringify(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)))
const immutableSignature = (record: ExternalRecord) => JSON.stringify(Object.entries(record).filter(([field]) => !['recordId', 'sourceSequence', 'status'].includes(field)).sort(([a], [b]) => a.localeCompare(b)))

export function parseFinanceManifest(value: unknown): FinanceManifest {
  if (!Value.Check(FinanceManifestSchema, value)) throw new Error('INPUT_SCHEMA_INVALID')
  if (Object.values(value.scope).every((ids) => ids.length === 0)) throw new Error('EMPTY_SCOPE')
  if (value.records.some((record) => BigInt(record.amount) > 9223372036854775807n)) throw new Error('INPUT_AMOUNT_OUT_OF_RANGE')
  return value
}

export function assertLocalFinanceDatabase(connectionString: string): void {
  const url = new URL(connectionString)
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/(marketplace_test_|marketplace_e2e_|e2e_)[A-Za-z0-9_]+$/.test(url.pathname) || url.search || url.hash) throw new Error('DISPOSABLE_LOCAL_DATABASE_REQUIRED')
}

export function reconcileFinance(manifest: FinanceManifest, local: LocalFinanceRecord[], supportedCurrencies: readonly string[], snapshotDiscrepancies: readonly FinanceDiscrepancy[] = []) {
  const discrepancies: FinanceDiscrepancy[] = [...snapshotDiscrepancies]
  const events = new Map<string, ExternalRecord>()
  const latest = new Map<string, ExternalRecord>()
  const sequences = new Map<string, ExternalRecord>()
  const references = new Map<string, string>()
  let duplicateRecords = 0
  for (const record of manifest.records) {
    const event = events.get(record.recordId)
    if (event) {
      if (signature(event) === signature(record)) duplicateRecords += 1
      else discrepancies.push({ code: 'CONFLICTING_DUPLICATE', kind: record.kind, id: record.id, field: 'recordId', received: record.recordId })
      continue
    }
    events.set(record.recordId, record)
    if (!supportedCurrencies.includes(record.currency)) discrepancies.push({ code: 'UNSUPPORTED_CURRENCY', kind: record.kind, id: record.id, received: record.currency })
    if (!manifest.scope[scopeFields[record.kind]].includes(record.id)) {
      discrepancies.push({ code: 'OUT_OF_SCOPE', kind: record.kind, id: record.id })
      continue
    }
    const operationKey = key(record)
    const sequenceKey = `${operationKey}:${record.sourceSequence}`
    const prior = sequences.get(sequenceKey)
    if (prior && signature({ ...prior, recordId: record.recordId }) !== signature(record)) discrepancies.push({ code: 'CONFLICTING_SEQUENCE', kind: record.kind, id: record.id })
    sequences.set(sequenceKey, record)
    const existing = latest.get(operationKey)
    if (existing && immutableSignature(existing) !== immutableSignature(record)) discrepancies.push({ code: 'INCONSISTENT_OPERATION_RECORD', kind: record.kind, id: record.id })
    if (!existing || record.sourceSequence > existing.sourceSequence) latest.set(operationKey, record)
    const referenceKey = JSON.stringify([record.kind, record.kind === 'PAYOUT' ? 'bank' : record.provider, record.externalReference])
    const referenceOwner = references.get(referenceKey)
    if (referenceOwner && referenceOwner !== operationKey) discrepancies.push({ code: 'REFERENCE_REUSED', kind: record.kind, id: record.id, received: record.externalReference })
    references.set(referenceKey, operationKey)
  }
  const byId = new Map(local.map((record) => [key(record), record]))
  const rejectedOperations = new Set(discrepancies.flatMap((item) => item.kind && item.id ? [`${item.kind}:${item.id}`] : []))
  let matchedOperations = 0
  for (const kind of ['PAYMENT', 'REFUND', 'PAYOUT'] as const) {
    for (const id of manifest.scope[scopeFields[kind]]) {
      const operationKey = `${kind}:${id}`
      const expected = byId.get(operationKey)
      const received = latest.get(operationKey)
      if (!expected) discrepancies.push({ code: 'LOCAL_ROW_MISSING', kind, id })
      if (!received) discrepancies.push({ code: 'EXTERNAL_ROW_MISSING', kind, id })
      if (!expected || !received) continue
      const before = discrepancies.length
      if (!supportedCurrencies.includes(expected.currency)) discrepancies.push({ code: 'UNSUPPORTED_CURRENCY', kind, id, expected: expected.currency })
      const pairs: Array<[string, string | null, string]> = [['amount', expected.amount.toString(), received.amount], ['currency', expected.currency, received.currency], ['status', expected.status, received.status], ['externalReference', expected.externalReference, received.externalReference]]
      if (expected.kind === 'PAYMENT' && received.kind === 'PAYMENT') pairs.push(['orderId', expected.orderId, received.orderId], ['provider', expected.provider, received.provider])
      if (expected.kind === 'REFUND' && received.kind === 'REFUND') pairs.push(['orderId', expected.orderId, received.orderId], ['paymentId', expected.paymentId, received.paymentId], ['provider', expected.provider, received.provider])
      if (expected.kind === 'PAYOUT' && received.kind === 'PAYOUT') pairs.push(['walletId', expected.walletId, received.walletId], ['shopId', expected.shopId, received.shopId])
      for (const [field, expectedValue, receivedValue] of pairs) {
        if (expectedValue !== receivedValue) discrepancies.push({ code: expectedValue === null ? 'LOCAL_REFERENCE_MISSING' : 'FIELD_MISMATCH', kind, id, field, expected: expectedValue ?? '', received: receivedValue })
      }
      if (before === discrepancies.length && !rejectedOperations.has(operationKey)) matchedOperations += 1
    }
  }
  const totals = new Map<string, { kind: Kind; currency: string; local: bigint; records: bigint }>()
  for (const [side, records] of [['local', local], ['records', [...latest.values()]]] as const) {
    for (const record of records) {
      const totalKey = `${record.kind}:${record.currency}`
      const bucket = totals.get(totalKey) ?? { kind: record.kind, currency: record.currency, local: 0n, records: 0n }
      bucket[side] += BigInt(record.amount)
      totals.set(totalKey, bucket)
    }
  }
  return {
    localComparison: discrepancies.length === 0 ? 'MATCHED' : 'DISCREPANCIES',
    externalVerification: 'NOT_VERIFIED',
    source: manifest.source,
    inputRecords: manifest.records.length,
    duplicateRecords,
    finalOperations: latest.size,
    matchedOperations,
    discrepancies,
    totals: [...totals.values()].sort((a, b) => `${a.kind}:${a.currency}`.localeCompare(`${b.kind}:${b.currency}`)).map((item) => ({ kind: item.kind, currency: item.currency, localAmount: item.local.toString(), recordAmount: item.records.toString(), difference: (item.records - item.local).toString() })),
  }
}

export async function readFinanceSnapshot(db: PrismaClient, scope: FinanceManifest['scope']) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`
    const settings = await tx.$queryRaw<Array<{ readOnly: string }>>`SELECT current_setting('transaction_read_only') AS "readOnly"`
    const [payments, refunds, payouts] = await Promise.all([
      tx.payment.findMany({ where: { id: { in: scope.paymentIds } }, select: { id: true, orderId: true, provider: true, providerIntentId: true, status: true, amount: true, currency: true, order: { select: { currency: true, grandTotal: true } } } }),
      tx.refund.findMany({ where: { id: { in: scope.refundIds } }, select: { id: true, orderId: true, paymentId: true, status: true, amount: true, externalReference: true, payment: { select: { orderId: true, provider: true, currency: true } }, order: { select: { currency: true } } } }),
      tx.sellerPayout.findMany({ where: { id: { in: scope.payoutIds } }, select: { id: true, walletId: true, shopId: true, status: true, amount: true, currency: true, externalReference: true, wallet: { select: { shopId: true, currency: true } } } }),
    ])
    const rows: LocalFinanceRecord[] = []
    const discrepancies: FinanceDiscrepancy[] = []
    for (const row of payments) {
      rows.push({ kind: 'PAYMENT', id: row.id, orderId: row.orderId, provider: row.provider, status: row.status, amount: row.amount, currency: row.currency, externalReference: row.providerIntentId })
      if (row.order.currency !== row.currency || row.order.grandTotal !== row.amount) discrepancies.push({ code: 'LOCAL_RELATION_INCONSISTENT', kind: 'PAYMENT', id: row.id })
    }
    for (const row of refunds) {
      rows.push({ kind: 'REFUND', id: row.id, orderId: row.orderId, paymentId: row.paymentId, provider: row.payment.provider, status: row.status, amount: row.amount, currency: row.payment.currency, externalReference: row.externalReference })
      if (row.payment.orderId !== row.orderId || row.order.currency !== row.payment.currency) discrepancies.push({ code: 'LOCAL_RELATION_INCONSISTENT', kind: 'REFUND', id: row.id })
    }
    for (const row of payouts) {
      rows.push({ kind: 'PAYOUT', id: row.id, walletId: row.walletId, shopId: row.shopId, status: row.status, amount: row.amount, currency: row.currency, externalReference: row.externalReference })
      if (row.wallet.shopId !== row.shopId || row.wallet.currency !== row.currency) discrepancies.push({ code: 'LOCAL_RELATION_INCONSISTENT', kind: 'PAYOUT', id: row.id })
    }
    return { rows, discrepancies, databaseReadOnly: settings[0]?.readOnly === 'on' }
  }, { isolationLevel: 'RepeatableRead' })
}

async function boundedFile(path: string) {
  if ((await stat(path)).size > 10 * 1024 * 1024) throw new Error('INPUT_FILE_TOO_LARGE')
  return readFile(path)
}

export async function runFinanceCli(args = process.argv.slice(2)): Promise<number> {
  try {
    const { values } = parseArgs({ args, options: { input: { type: 'string' }, original: { type: 'string' }, currencies: { type: 'string' } }, strict: true, allowPositionals: false })
    const connectionString = process.env['COMMERCE_TEST_DATABASE_URL']
    if (!connectionString || !values.input || !values.original || !values.currencies) throw new Error('REQUIRE_LOCAL_DATABASE_INPUT_ORIGINAL_CURRENCIES')
    assertLocalFinanceDatabase(connectionString)
    const currencies = values.currencies.split(',')
    if (currencies.some((currency) => !/^[A-Z]{3}$/.test(currency))) throw new Error('INVALID_CURRENCY_ALLOWLIST')
    const manifest = parseFinanceManifest(JSON.parse((await boundedFile(values.input)).toString('utf8')))
    const originalSha256 = createHash('sha256').update(await boundedFile(values.original)).digest('hex')
    if (manifest.source.originalSha256 !== originalSha256) throw new Error('ORIGINAL_FILE_HASH_MISMATCH')
    let writeStatementsAttempted = 0
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }), log: [{ emit: 'event', level: 'query' }] })
    db.$on('query', (event) => { if (/^\s*(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|CREATE|ALTER|DROP|COPY)\b/i.test(event.query)) writeStatementsAttempted += 1 })
    try {
      const snapshot = await readFinanceSnapshot(db, manifest.scope)
      const result = reconcileFinance(manifest, snapshot.rows, currencies, snapshot.discrepancies)
      const discrepancies = result.discrepancies
      const failed = discrepancies.length > 0 || !snapshot.databaseReadOnly || writeStatementsAttempted > 0
      process.stdout.write(`${JSON.stringify({ ...result, localComparison: failed ? 'DISCREPANCIES' : 'MATCHED', discrepancies, databaseReadOnly: snapshot.databaseReadOnly, writeStatementsAttempted }, null, 2)}\n`)
      return failed ? 1 : 0
    } finally { await db.$disconnect() }
  } catch (error) {
    const knownCodes = ['INPUT_SCHEMA_INVALID', 'EMPTY_SCOPE', 'INPUT_AMOUNT_OUT_OF_RANGE', 'DISPOSABLE_LOCAL_DATABASE_REQUIRED', 'INPUT_FILE_TOO_LARGE', 'REQUIRE_LOCAL_DATABASE_INPUT_ORIGINAL_CURRENCIES', 'INVALID_CURRENCY_ALLOWLIST', 'ORIGINAL_FILE_HASH_MISMATCH']
    const code = error instanceof Error && knownCodes.includes(error.message) ? error.message : 'RUNNER_ERROR'
    process.stdout.write(`${JSON.stringify({ localComparison: 'ERROR', externalVerification: 'NOT_VERIFIED', discrepancies: [{ code }] })}\n`)
    return 2
  }
}

if (import.meta.main) process.exitCode = await runFinanceCli()
