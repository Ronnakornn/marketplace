import { describe, expect, it } from 'vitest'
import { getReturnConfigFromEnv } from './return.config.ts'

describe('return policy configuration', () => {
  it('defaults to the selected seven-day policy', () => {
    expect(getReturnConfigFromEnv({})).toEqual({ windowDays: 7 })
  })

  it.each(['1', '7', '30', '365'])('accepts a bounded day count %s', (value) => {
    expect(getReturnConfigFromEnv({ RETURN_WINDOW_DAYS: value })).toEqual({ windowDays: Number(value) })
  })

  it.each(['', '0', '-1', '7.5', '366', 'seven', 'Infinity', ' 7 ', '1e2'])('rejects invalid policy %s', (value) => {
    expect(() => getReturnConfigFromEnv({ RETURN_WINDOW_DAYS: value })).toThrow('RETURN_WINDOW_DAYS must be an integer between 1 and 365')
  })
})
