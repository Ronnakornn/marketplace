import { describe, expect, it } from 'vitest'
import type { ShippingQuoteRule } from './shipping-quote.ts'
import { quoteShipping } from './shipping-quote.ts'
import {
  assertSafeLink,
  assertTimeWindow,
  isBannerActive,
  previewTemplate,
} from './content-safety.ts'
import { payoutCycleKey } from './payout-cycle.ts'
import { parseStatementFile } from './statement-file.ts'
import { writeTabularFile } from '#server/modules/admin-reporting/spreadsheet.ts'

const now = new Date('2026-10-12T00:00:00Z')
const rule: ShippingQuoteRule = {
  id: 'rate-1',
  providerId: 'provider-1',
  shopId: null,
  name: 'Bangkok',
  country: 'TH',
  postalPrefixes: ['10'],
  regions: ['Bangkok'],
  minWeightGrams: 0,
  maxWeightGrams: 2000,
  maxLengthMm: 300,
  maxWidthMm: 300,
  maxHeightMm: 300,
  volumetricDivisor: 5000,
  baseFee: 9007199254740993n,
  perKgFee: 100n,
  priority: 1,
  isActive: true,
  version: 4,
  createdAt: now,
  updatedAt: now,
  provider: { id: 'provider-1', shopId: null, name: 'Carrier', isActive: true },
}
const input = {
  shopId: 'shop-1',
  enabled: true,
  flatFee: 500n,
  country: 'TH',
  postalCode: '10110',
  region: 'Bangkok',
  packages: [{ weightGrams: 1000, lengthMm: 100, widthMm: 100, heightMm: 100 }],
}

describe('shipping quote boundaries', () => {
  it('retains the flat default while shipping rates are disabled', () => {
    expect(
      quoteShipping({ ...input, enabled: false, packages: [] }, []),
    ).toMatchObject({ fee: 500n, mode: 'FLAT', ruleId: null })
  })
  it('uses exact cents, started kilograms and rule revision', () => {
    expect(
      quoteShipping(
        { ...input, packages: [{ ...input.packages[0], weightGrams: 1001 }] },
        [rule],
      ),
    ).toMatchObject({
      fee: 9007199254741193n,
      chargeableWeightGrams: 1001,
      ruleVersion: 4,
    })
  })
  it('uses volumetric weight and includes the upper boundary', () => {
    expect(
      quoteShipping(
        {
          ...input,
          packages: [
            { weightGrams: 100, lengthMm: 200, widthMm: 250, heightMm: 200 },
          ],
        },
        [rule],
      ),
    ).toMatchObject({ chargeableWeightGrams: 2000, fee: 9007199254741193n })
  })
  it.each([{ country: 'US' }, { postalCode: '20110' }, { region: 'Other' }])(
    'rejects uncovered destinations %j',
    (change) => {
      expect(() => quoteShipping({ ...input, ...change }, [rule])).toThrow(
        'No shipping rate',
      )
    },
  )
  it('rejects one gram beyond upper weight and excessive dimensions', () => {
    expect(() =>
      quoteShipping(
        { ...input, packages: [{ ...input.packages[0], weightGrams: 2001 }] },
        [rule],
      ),
    ).toThrow('No shipping rate')
    expect(() =>
      quoteShipping(
        { ...input, packages: [{ ...input.packages[0], lengthMm: 301 }] },
        [rule],
      ),
    ).toThrow('No shipping rate')
  })
  it('never quotes another shop provider and resolves deterministic priority ties', () => {
    expect(() =>
      quoteShipping(input, [
        { ...rule, provider: { ...rule.provider, shopId: 'shop-2' } },
      ]),
    ).toThrow('No shipping rate')
    expect(
      quoteShipping(input, [
        { ...rule, id: 'b' },
        { ...rule, id: 'a', baseFee: 0n },
      ]).ruleId,
    ).toBe('a')
  })
})

describe('safe timed content', () => {
  it.each([
    'javascript:alert(1)',
    'data:text/html,a',
    '//evil.test',
    '/\\evil.test',
    'https://name:secret@example.test',
  ])('rejects unsafe link %s', (value) => {
    expect(() => assertSafeLink(value)).toThrow()
  })
  it('allows HTTPS and local links', () => {
    expect(() => assertSafeLink('/th/pages/policy')).not.toThrow()
    expect(() => assertSafeLink('https://example.test/policy')).not.toThrow()
  })
  it('uses a half-open publication window and rejects inverted dates', () => {
    const banner = {
      status: 'SCHEDULED',
      startsAt: now,
      endsAt: new Date(now.getTime() + 1000),
    }
    expect(isBannerActive(banner, now)).toBe(true)
    expect(isBannerActive(banner, banner.endsAt)).toBe(false)
    expect(() => assertTimeWindow(banner.endsAt, now)).toThrow()
  })
  it('allows declared template variables and escapes untrusted values', () => {
    expect(
      previewTemplate('Hello {{buyerName}}', {
        buyerName: '<img src=x onerror=alert(1)>',
      }),
    ).toBe('Hello &lt;img src=x onerror=alert(1)&gt;')
    expect(() => previewTemplate('{{constructor}}', {})).toThrow('Unsupported')
    expect(() => previewTemplate('{{buyerName', {})).toThrow('Invalid')
  })
})

describe('statement file boundary', () => {
  const rows = [
    ['sourceKey', 'amount', 'currency', 'externalReference'],
    ['bank-line-1', '9007199254740993', 'THB', 'bank-ref'],
  ]
  it.each(['CSV', 'XLSX'] as const)(
    'keeps exact money through %s preview',
    (format) => {
      const bytes = writeTabularFile(rows, format)
      const parsed = parseStatementFile({
        fileName: `bank.${format.toLowerCase()}`,
        base64: Buffer.from(bytes).toString('base64'),
        reason: 'Monthly statement',
        batchKey: 'batch-1',
      })
      expect(parsed.rows[0]?.amount).toBe('9007199254740993')
      expect(parsed.fingerprint).toHaveLength(64)
    },
  )
  it('rejects unsafe formulas and malformed exact money', () => {
    expect(() =>
      parseStatementFile({
        fileName: 'bank.csv',
        base64: Buffer.from(
          'sourceKey,amount,currency,externalReference\n=EXEC(),1,THB,ref',
        ).toString('base64'),
        reason: 'Statement',
        batchKey: 'b',
      }),
    ).toThrow()
    expect(() =>
      parseStatementFile({
        fileName: 'bank.csv',
        base64: Buffer.from(
          'sourceKey,amount,currency,externalReference\nrow,1.25,THB,ref',
        ).toString('base64'),
        reason: 'Statement',
        batchKey: 'b',
      }),
    ).toThrow('Invalid statement row')
  })
})

it('uses Thai calendar boundaries for deterministic payout cycles', () => {
  expect(payoutCycleKey('DAILY', new Date('2026-10-12T17:00:00Z'))).toBe(
    'daily:2026-10-13',
  )
  expect(payoutCycleKey('WEEKLY', new Date('2026-10-11T17:00:00Z'))).toBe(
    'weekly:2026-10-12',
  )
  expect(payoutCycleKey('MONTHLY', new Date('2026-10-31T17:00:00Z'))).toBe(
    'monthly:2026-11',
  )
  expect(payoutCycleKey('MANUAL', now)).toBeNull()
})
