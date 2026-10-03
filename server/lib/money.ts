import { t, status as httpStatus } from 'elysia'
import { Prisma } from '#generated/client/client.ts'

export const MinorUnitString = t.String({ pattern: '^(0|[1-9][0-9]*|-[1-9][0-9]*)$' })

export class MoneyAmountError extends RangeError {}

export function moneyInteger(value: bigint | number | string): bigint {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new MoneyAmountError('Money must be a safe integer')
  if (typeof value === 'string' && !/^(0|[1-9][0-9]*|-[1-9][0-9]*)$/.test(value)) throw new MoneyAmountError('Money must be canonical integer minor units')
  return BigInt(value)
}

export function moneyNumber(value: bigint | number | string): number {
  const integer = moneyInteger(value)
  if (integer > BigInt(Number.MAX_SAFE_INTEGER) || integer < BigInt(Number.MIN_SAFE_INTEGER)) throw new MoneyAmountError('Money exceeds the operation safe integer limit')
  return Number(integer)
}

export function moneyMin(values: readonly bigint[]): bigint {
  if (values.length === 0) throw new MoneyAmountError('Cannot select a price from an empty collection')
  return values.reduce((min, value) => value < min ? value : min)
}

export function moneyMax(values: readonly bigint[]): bigint {
  if (values.length === 0) throw new MoneyAmountError('Cannot select a price from an empty collection')
  return values.reduce((max, value) => value > max ? value : max)
}

export function moneyRoundedRatio(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new MoneyAmountError('Money ratio requires a positive denominator')
  const dividend = numerator * 2n + denominator
  const divisor = denominator * 2n
  const result = dividend / divisor
  return dividend < 0n && dividend % divisor !== 0n ? result - 1n : result
}

export function decimalMoneyNumber(value: number | string): number {
  const decimal = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value))
  if (!decimal) throw new RangeError('Amount supports at most two decimal places')
  const minorUnits = moneyNumber(BigInt(decimal[1]!) * 100n + BigInt((decimal[2] ?? '').padEnd(2, '0')))
  if (typeof value === 'number' && (!Number.isFinite(value) || Math.round(value * 100) !== minorUnits)) throw new RangeError('Use decimal text for an amount that cannot preserve cents as a number')
  return minorUnits
}

type MonetaryKey = `${string}Cents` | 'price' | 'unitPrice' | 'lineTotal' | 'amount' | 'subtotal' | 'grandTotal' | 'discountTotal' | 'shippingTotal' | 'taxTotal' | 'includedTaxTotal' | 'addedTaxTotal' | 'reportedTaxTotal' | 'salePrice' | 'originalPrice' | 'minPrice' | 'maxPrice' | 'revenue' | 'discountValue' | 'minOrder' | 'maxDiscount' | 'shippingFee'
const monetaryKeys = new Set(['price', 'unitPrice', 'lineTotal', 'amount', 'subtotal', 'grandTotal', 'discountTotal', 'shippingTotal', 'taxTotal', 'includedTaxTotal', 'addedTaxTotal', 'reportedTaxTotal', 'salePrice', 'originalPrice', 'minPrice', 'maxPrice', 'revenue', 'discountValue', 'minOrder', 'maxDiscount', 'shippingFee'])
type MonetaryDtoField<T, K> = K extends MonetaryKey ? T extends number ? string : MoneyDto<T> : MoneyDto<T>

export type MoneyDto<T> = T extends bigint | Prisma.Decimal ? string
  : T extends Date ? Date
  : T extends readonly unknown[] ? { [K in keyof T]: MoneyDto<T[K]> }
  : T extends object ? { [K in keyof T]: MonetaryDtoField<T[K], K> }
  : T

export function toMoneyDto<T>(value: T): MoneyDto<T>
export function toMoneyDto(value: unknown): unknown {
  if (typeof value === 'bigint' || Prisma.Decimal.isDecimal(value)) return value.toString()
  if (value instanceof Date || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(toMoneyDto)
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, typeof item === 'number' && (key.endsWith('Cents') || monetaryKeys.has(key)) ? moneyInteger(item).toString() : toMoneyDto(item)]))
}

export async function moneyResponse<T>(value: T | Promise<T>): Promise<MoneyDto<T>> {
  return toMoneyDto(await value)
}

export function moneyHttpError<T>(status: number, body: T) {
  const value = toMoneyDto(body)
  switch (status) {
    case 400: return httpStatus(400, value)
    case 401: return httpStatus(401, value)
    case 403: return httpStatus(403, value)
    case 404: return httpStatus(404, value)
    case 409: return httpStatus(409, value)
    case 410: return httpStatus(410, value)
    case 422: return httpStatus(422, value)
    case 429: return httpStatus(429, value)
    case 502: return httpStatus(502, value)
    case 503: return httpStatus(503, value)
    default: return httpStatus(500, value)
  }
}
