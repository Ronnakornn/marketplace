import { describe, expect, it } from 'vitest'
import { Elysia, t } from 'elysia'
import { treaty } from '@elysiajs/eden'
import { Prisma } from '#generated/client/client.ts'
import { MinorUnitString, decimalMoneyNumber, moneyInteger, moneyNumber, moneyRoundedRatio, moneyResponse, toMoneyDto } from './money.ts'
import { decodeCacheValue, encodeCacheValue } from '#server/modules/cache/cache.codec.ts'

describe('exact money boundaries', () => {
  it.each([[18014398509481981n, 2n, 9007199254740991n], [-18014398509481981n, 2n, -9007199254740990n], [-3n, 2n, -1n], [-4n, 3n, -1n]])('rounds signed aggregate %s without a Number conversion', (amount, count, expected) => {
    expect(moneyRoundedRatio(amount, count)).toBe(expected)
  })
  it.each([
    [9007199254740990n, '9007199254740990'],
    [9007199254740991n, '9007199254740991'],
    [9007199254740992n, '9007199254740992'],
    [9007199254740993n, '9007199254740993'],
    [18014398509481981n, '18014398509481981'],
    [-18014398509481981n, '-18014398509481981'],
    [-1n, '-1'],
  ])('preserves %s through schema validation and Eden', async (amount, expected) => {
    const objectApp = new Elysia().get('/money', () => moneyResponse({ amount }), { response: t.Object({ amount: MinorUnitString }) })
    const result = await treaty(objectApp).money.get()
    const typedString: string = result.data!.amount
    expect(typedString).toBe(expected)
    expect(result.data).toEqual({ amount: expected })
    expect(await (await objectApp.handle(new Request('http://localhost/money'))).json()).toEqual({ amount: expected })
  })

  it('maps bounded computed cents and preserves counts and dates', () => {
    const date = new Date('2026-10-04T00:00:00Z')
    const result = toMoneyDto({ grandTotal: 9007199254740991, availableBalanceCents: -1, quantity: 2, ratio: 0.25, createdAt: date })
    const amount: string = result.grandTotal
    expect(amount).toBe('9007199254740991')
    expect(result).toEqual({ grandTotal: '9007199254740991', availableBalanceCents: '-1', quantity: 2, ratio: 0.25, createdAt: date })
  })

  it.each([9007199254740992, -9007199254740992, 1.5, NaN, Infinity])('rejects an imprecise Number %s before transport', (value) => {
    expect(() => moneyInteger(value)).toThrow(RangeError)
    expect(() => toMoneyDto({ amount: value })).toThrow(RangeError)
  })

  it('bounds operational conversion without bounding exact aggregates', () => {
    expect(moneyNumber(9007199254740991n)).toBe(9007199254740991)
    expect(moneyNumber(-9007199254740991n)).toBe(-9007199254740991)
    expect(() => moneyNumber(9007199254740993n)).toThrow(RangeError)
    expect(() => moneyNumber(-9007199254740993n)).toThrow(RangeError)
    expect(toMoneyDto({ amount: 18014398509481981n })).toEqual({ amount: '18014398509481981' })
  })

  it('parses original decimal text exactly and retains old safe numeric clients', () => {
    expect(decimalMoneyNumber('90071992547409.91')).toBe(9007199254740991)
    expect(decimalMoneyNumber('90071992547409.90')).toBe(9007199254740990)
    expect(decimalMoneyNumber(0.29)).toBe(29)
    expect(() => decimalMoneyNumber(90071992547409.91)).toThrow(RangeError)
    expect(() => decimalMoneyNumber('90071992547409.92')).toThrow(RangeError)
    expect(() => decimalMoneyNumber('0.001')).toThrow(RangeError)
  })

  it('round trips nested bigint, Decimal, dates, ISO text and arbitrary JSON separately', () => {
    const date = new Date('2026-10-04T00:00:00Z')
    const record = { amount: 9007199254740993n, list: [-1n, 18014398509481981n], decimal: new Prisma.Decimal('9007199254740993.123'), date, text: date.toISOString(), metadata: { version: 2, data: '9007199254740993', bigints: [['data']] } }
    const restored = decodeCacheValue(encodeCacheValue(record))
    expect(restored).toEqual(record)
    expect(decodeCacheValue(encodeCacheValue(-1n))).toBe(-1n)
    expect(decodeCacheValue(encodeCacheValue(new Prisma.Decimal('1.23')))).toEqual(new Prisma.Decimal('1.23'))
    expect(() => decodeCacheValue('{"amount":9007199254740992}')).toThrow('Unsupported cache version')
  })
})
