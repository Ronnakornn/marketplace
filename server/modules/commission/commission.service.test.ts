import { describe, expect, it, vi } from 'vitest'
import { CommissionService } from './commission.service.ts'

const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe('CommissionService exact minor-unit arithmetic', () => {
  it.each([
    [9007199254740991, 10000, 9007199254740991, 0],
    [9007199254740969, 1000, 900719925474096, 8106479329266873],
    [10001, 1000, 1000, 9001],
  ])('preserves commission and net for gross %s at %s basis points', (gross, bps, commission, net) => {
    expect(new CommissionService(context, bps).calculate(gross)).toEqual({
      grossamount: gross, commissionamount: commission, netamount: net, commissionBps: bps,
    })
  })

  it('rejects an unsafe gross amount', () => {
    expect(() => new CommissionService(context, 1000).calculate(9007199254740992))
      .toThrow('Gross amount must be a non-negative integer')
  })
})
