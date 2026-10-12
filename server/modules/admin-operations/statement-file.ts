import { createHash } from 'node:crypto'
import { Value } from '@sinclair/typebox/value'
import { readTabularFile } from '#server/modules/admin-reporting/spreadsheet.ts'
import { EvidenceBody, type EvidenceInput } from './operations.schemas.ts'
import { AdminOperationsError } from './operations.errors.ts'

export function parseStatementFile(input: {
  fileName: string
  base64: string
  reason: string
  batchKey: string
}) {
  if (
    !/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64) ||
    input.base64.length % 4 !== 0
  )
    throw new AdminOperationsError('Invalid encoded statement')
  const bytes = Buffer.from(input.base64, 'base64')
  if (bytes.length > 2_000_000 || !bytes.length)
    throw new AdminOperationsError('Statement file size is invalid')
  const extension = input.fileName.toLowerCase().split('.').pop()
  if (extension !== 'csv' && extension !== 'xlsx')
    throw new AdminOperationsError('Statement must be CSV or XLSX')
  let grid: string[][]
  try {
    grid = readTabularFile(bytes, extension === 'csv' ? 'CSV' : 'XLSX', {
      maxRows: 1001,
      maxColumns: 12,
      maxBytes: 2_000_000,
    })
  } catch (error) {
    throw new AdminOperationsError(
      error instanceof Error ? error.message : 'Invalid statement file',
    )
  }
  const headers = grid.shift()?.map((header) => header.trim()) ?? []
  const required = ['sourceKey', 'amount', 'currency', 'externalReference']
  const allowed = [
    ...required,
    'occurredAt',
    'paymentId',
    'payoutId',
    'refundId',
  ]
  if (
    headers.length !== new Set(headers).size ||
    headers.some((header) => !allowed.includes(header)) ||
    required.some((header) => !headers.includes(header))
  )
    throw new AdminOperationsError(
      'Statement headers must include sourceKey, amount, currency and externalReference',
    )
  const rows: EvidenceInput[] = grid
    .filter((cells) => cells.some((cell) => cell !== ''))
    .map((cells, index) => {
      const value = (key: string) => cells[headers.indexOf(key)]?.trim() ?? ''
      const row = {
        kind: 'BANK_STATEMENT',
        sourceKey: value('sourceKey'),
        amount: value('amount'),
        currency: value('currency'),
        externalReference: value('externalReference'),
        occurredAt: value('occurredAt') || null,
        ...(value('paymentId') ? { paymentId: value('paymentId') } : {}),
        ...(value('payoutId') ? { payoutId: value('payoutId') } : {}),
        ...(value('refundId') ? { refundId: value('refundId') } : {}),
        batchKey: input.batchKey,
        reason: input.reason,
      }
      if (cells.length !== headers.length || !Value.Check(EvidenceBody, row))
        throw new AdminOperationsError(`Invalid statement row ${index + 2}`)
      return row
    })
  if (!rows.length) throw new AdminOperationsError('Statement has no data rows')
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(rows))
    .digest('hex')
  return { rows, fingerprint }
}
