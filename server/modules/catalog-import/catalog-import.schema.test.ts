import { describe, it, expect } from 'vitest'
import { strToU8 } from 'fflate'
import { parseImportRows } from './catalog-import.schema.ts'
describe('catalog import row admission', () => {
  const variant = '00000000-0000-4000-8000-000000000001'
  it('keeps canonical exact price digits and maps row validation errors', () => {
    const rows = parseImportRows(
      strToU8(
        `variantId,priceMinor\n${variant},9007199254740993\n${variant},01`,
      ),
      'CSV',
      'PRICE',
    )
    expect(rows[0]!.input.priceMinor).toBe('9007199254740993')
    expect(rows[0]!.errors).toEqual([])
    expect(rows[1]!.errors.length).toBeGreaterThan(0)
  })
  it('validates required headers, maximum rows and reservation quantities as integer text', () => {
    expect(() =>
      parseImportRows(strToU8('variantId\nx'), 'CSV', 'PRICE'),
    ).toThrow('required columns')
    expect(() =>
      parseImportRows(
        strToU8(`variantId,priceMinor\n${`${variant},1\n`.repeat(251)}`),
        'CSV',
        'PRICE',
      ),
    ).toThrow('rows')
    expect(
      parseImportRows(
        strToU8(`variantId,quantityOnHand\n${variant},2147483648`),
        'CSV',
        'STOCK',
      )[0]!.errors.length,
    ).toBeGreaterThan(0)
  })
  it('rejects formulas, unknown fields and malformed XLSX archives', () => {
    expect(() =>
      parseImportRows(
        strToU8(`variantId,priceMinor\n${variant},=1+2`),
        'CSV',
        'PRICE',
      ),
    ).toThrow('formulas')
    expect(() =>
      parseImportRows(strToU8('variantId,unexpected\nx,x'), 'CSV', 'PRICE'),
    ).toThrow('template')
    expect(() =>
      parseImportRows(strToU8('not a zip'), 'XLSX', 'PRICE'),
    ).toThrow('Malformed spreadsheet')
  })
})
