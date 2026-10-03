import { describe, expect, it } from 'vitest'
import { assertLocalFinanceDatabase, parseFinanceManifest, reconcileFinance, type FinanceManifest, type LocalFinanceRecord } from './reconcile-external-finance.ts'

const paymentId = '11111111-1111-4111-8111-111111111111'
const orderId = '22222222-2222-4222-8222-222222222222'
const otherId = '33333333-3333-4333-8333-333333333333'
const local: LocalFinanceRecord[] = [{ kind: 'PAYMENT', id: paymentId, orderId, provider: 'fixture-provider', status: 'SUCCEEDED', amount: 100n, currency: 'THB', externalReference: 'intent-1' }]
function manifest(): FinanceManifest {
  return { formatVersion: 1, source: { kind: 'fixture', name: 'Literal fixture', originalSha256: '0'.repeat(64), mappingDescription: 'Test-generated rows, no external evidence' }, scope: { paymentIds: [paymentId], refundIds: [], payoutIds: [] }, records: [{ kind: 'PAYMENT', id: paymentId, orderId, provider: 'fixture-provider', status: 'SUCCEEDED', amount: '100', currency: 'THB', externalReference: 'intent-1', recordId: 'event-1', sourceSequence: 2 }] }
}

describe('read-only external finance comparison rules', () => {
  it('matches literal amounts and separates local comparison from external verification', () => {
    const report = reconcileFinance(parseFinanceManifest(manifest()), local, ['THB'])
    expect(report).toMatchObject({ localComparison: 'MATCHED', externalVerification: 'NOT_VERIFIED', inputRecords: 1, duplicateRecords: 0, finalOperations: 1, matchedOperations: 1, discrepancies: [], totals: [{ kind: 'PAYMENT', currency: 'THB', localAmount: '100', recordAmount: '100', difference: '0' }] })
  })
  it.each([100, '01', '-1', '-0', '1.00', '1e2', ' 100', '9223372036854775808'])('rejects noncanonical or unrepresentable amount %s', (amount) => {
    const value = manifest()
    expect(() => parseFinanceManifest({ ...value, records: [{ ...value.records[0], amount }] })).toThrow(/INPUT_/)
  })
  it('adds above-safe-integer amounts exactly without currency conversion', () => {
    const value = manifest()
    value.scope.paymentIds.push(otherId)
    value.records[0]!.amount = '9007199254740993'
    value.records.push({ ...value.records[0]!, id: otherId, amount: '7', externalReference: 'intent-2', recordId: 'event-2' })
    const rows: LocalFinanceRecord[] = [{ ...local[0]!, amount: 9007199254740993n }, { ...local[0]!, id: otherId, amount: 7n, externalReference: 'intent-2' }]
    expect(reconcileFinance(value, rows, ['THB']).totals).toEqual([{ kind: 'PAYMENT', currency: 'THB', localAmount: '9007199254741000', recordAmount: '9007199254741000', difference: '0' }])
  })
  it('deduplicates exact events and accepts higher source sequence arriving before pending', () => {
    const value = manifest()
    const payment = value.records[0]!
    if (payment.kind !== 'PAYMENT') throw new Error('Payment fixture required')
    value.records.push({ ...payment }, { ...payment, recordId: 'old-event', sourceSequence: 1, status: 'PENDING' })
    expect(reconcileFinance(value, local, ['THB'])).toMatchObject({ localComparison: 'MATCHED', duplicateRecords: 1, finalOperations: 1, matchedOperations: 1, totals: [{ recordAmount: '100' }] })
  })
  it('rejects a conflicting event replay instead of counting it twice', () => {
    const value = manifest()
    value.records.push({ ...value.records[0]!, amount: '99' })
    expect(reconcileFinance(value, local, ['THB'])).toMatchObject({ localComparison: 'DISCREPANCIES', matchedOperations: 0, discrepancies: [{ code: 'CONFLICTING_DUPLICATE' }], totals: [{ recordAmount: '100' }] })
  })
  it('rejects conflicting equal sequences and changed immutable historical facts', () => {
    const value = manifest()
    const payment = value.records[0]!
    if (payment.kind !== 'PAYMENT') throw new Error('Payment fixture required')
    value.records.push({ ...payment, recordId: 'equal-sequence', status: 'FAILED' }, { ...payment, recordId: 'old-wrong-currency', sourceSequence: 1, currency: 'ZZZ' })
    const report = reconcileFinance(value, local, ['THB'])
    expect(report.localComparison).toBe('DISCREPANCIES')
    expect(report.matchedOperations).toBe(0)
    expect(report.discrepancies.map((item) => item.code)).toEqual(['CONFLICTING_SEQUENCE', 'UNSUPPORTED_CURRENCY', 'INCONSISTENT_OPERATION_RECORD'])
  })
  it('reports amount, currency, status, reference and relation mismatches', () => {
    const value = manifest()
    const first = value.records[0]!
    if (first.kind !== 'PAYMENT') throw new Error('Payment fixture required')
    value.records = [{ ...first, amount: '99', currency: 'USD', status: 'FAILED', externalReference: 'wrong-ref', orderId: otherId, provider: 'wrong-provider' }]
    const report = reconcileFinance(value, local, ['THB', 'USD'])
    expect(report.localComparison).toBe('DISCREPANCIES')
    expect(report.discrepancies.map((item) => item.field)).toEqual(['amount', 'currency', 'status', 'externalReference', 'orderId', 'provider'])
    expect(report.totals).toEqual([{ kind: 'PAYMENT', currency: 'THB', localAmount: '100', recordAmount: '0', difference: '-100' }, { kind: 'PAYMENT', currency: 'USD', localAmount: '0', recordAmount: '99', difference: '99' }])
  })
  it('rejects scope gaps, nonexistent rows, unknown currency and reused external references', () => {
    const value = manifest()
    value.scope.paymentIds.push(otherId)
    value.records.push({ ...value.records[0]!, id: otherId, recordId: 'other-event', currency: 'ZZZ' })
    const report = reconcileFinance(value, local, ['THB'])
    expect(report.localComparison).toBe('DISCREPANCIES')
    expect(report.discrepancies.map((item) => item.code)).toEqual(['UNSUPPORTED_CURRENCY', 'REFERENCE_REUSED', 'LOCAL_ROW_MISSING'])
    value.records = []
    expect(reconcileFinance(value, local, ['THB']).discrepancies.map((item) => item.code)).toEqual(['EXTERNAL_ROW_MISSING', 'LOCAL_ROW_MISSING', 'EXTERNAL_ROW_MISSING'])
  })
  it('rejects an external record outside the explicitly selected scope', () => {
    const value = manifest()
    value.records.push({ ...value.records[0]!, id: otherId, recordId: 'extra' })
    expect(reconcileFinance(value, local, ['THB'])).toMatchObject({ localComparison: 'DISCREPANCIES', discrepancies: [{ code: 'OUT_OF_SCOPE', id: otherId }] })
  })
  it('does not claim an operation matches when its database relations are inconsistent', () => {
    expect(reconcileFinance(manifest(), local, ['THB'], [{ code: 'LOCAL_RELATION_INCONSISTENT', kind: 'PAYMENT', id: paymentId }])).toMatchObject({ localComparison: 'DISCREPANCIES', matchedOperations: 0, discrepancies: [{ code: 'LOCAL_RELATION_INCONSISTENT' }] })
  })
  it('keeps provider/reference tuple identities distinct when either contains a colon', () => {
    const value = manifest()
    const payment = value.records[0]!
    if (payment.kind !== 'PAYMENT') throw new Error('Payment fixture required')
    const localPayment = local[0]!
    if (localPayment.kind !== 'PAYMENT') throw new Error('Payment fixture required')
    value.scope.paymentIds.push(otherId)
    value.records = [{ ...payment, provider: 'a:b', externalReference: 'c' }, { ...payment, id: otherId, provider: 'a', externalReference: 'b:c', recordId: 'other-event' }]
    const rows: LocalFinanceRecord[] = [{ ...localPayment, provider: 'a:b', externalReference: 'c' }, { ...localPayment, id: otherId, provider: 'a', externalReference: 'b:c' }]
    expect(reconcileFinance(value, rows, ['THB'])).toMatchObject({ localComparison: 'MATCHED', matchedOperations: 2, discrepancies: [] })
  })
  it.each(['postgresql://postgres@remote.test:5432/marketplace_test_a', 'postgresql://postgres@127.0.0.1:5432/marketplace', 'postgresql://postgres@127.0.0.1:5432/marketplace_test_a?host=remote.test', 'postgresql://postgres@127.0.0.1:5432/marketplace_test_', 'postgresql://postgres@127.0.0.1:5432/marketplace_test_a#x'])('rejects unsafe database destination %s', (url) => {
    expect(() => assertLocalFinanceDatabase(url)).toThrow('DISPOSABLE_LOCAL_DATABASE_REQUIRED')
  })
  it.each(['marketplace_test_a', 'marketplace_e2e_a', 'e2e_a'])('accepts only explicit disposable local database %s', (name) => {
    expect(() => assertLocalFinanceDatabase(`postgresql://postgres@127.0.0.1:55439/${name}`)).not.toThrow()
  })
})
