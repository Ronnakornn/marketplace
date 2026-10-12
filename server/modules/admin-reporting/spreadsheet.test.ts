import { describe, it, expect } from 'vitest'
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate'
import { readTabularFile, writeTabularFile } from './spreadsheet.ts'

describe('bounded tabular files', () => {
  it('reads RFC CSV quoting and preserves exact monetary digits', () => {
    expect(
      readTabularFile('name,price\r\n"a,""b""",9007199254740993123\r\n', 'CSV'),
    ).toEqual([
      ['name', 'price'],
      ['a,"b"', '9007199254740993123'],
    ])
  })
  it('round trips standard OOXML with inline text money', () => {
    const rows = [
      ['title', 'priceMinor'],
      ['สินค้า & <tag>', '9007199254740993123'],
    ]
    const output = writeTabularFile(rows, 'XLSX')
    expect(readTabularFile(output, 'XLSX')).toEqual(rows)
    const sheet = strFromU8(unzipSync(output)['xl/worksheets/sheet1.xml']!)
    expect(sheet).toContain('t="inlineStr"')
    expect(sheet).toContain('9007199254740993123')
  })
  it.each([
    '=WEBSERVICE("https://evil")',
    '+SUM(1,2)',
    '@SUM(A1)',
    '  -HYPERLINK("x")',
    '\t=1',
  ])('rejects formula-looking input %s', (value) => {
    expect(() =>
      readTabularFile(`name\n"${value.replace(/"/g, '""')}"`, 'CSV'),
    ).toThrow('formulas')
  })
  it('allows canonical negative statement values and escapes exported formula text', () => {
    expect(readTabularFile('amount\n-123', 'CSV')).toEqual([
      ['amount'],
      ['-123'],
    ])
    expect(
      strFromU8(
        writeTabularFile([['=SUM(1,2)', '9007199254740993123']], 'CSV'),
      ),
    ).toContain('"\'=SUM(1,2)"')
  })
  it('rejects formula cells even if a cached value is present', () => {
    const parts = unzipSync(writeTabularFile([['123']], 'XLSX'))
    parts['xl/worksheets/sheet1.xml'] = strToU8(
      strFromU8(parts['xl/worksheets/sheet1.xml']!).replace(
        '<is>',
        '<f>SUM(1,2)</f><is>',
      ),
    )
    expect(() => readTabularFile(zipSync(parts), 'XLSX')).toThrow('formulas')
  })
  it('rejects sparse rows, bounds and malformed quoting', () => {
    expect(() => readTabularFile('a\nb\nc', 'CSV', { maxRows: 2 })).toThrow(
      'rows',
    )
    expect(() => readTabularFile('a,b,c', 'CSV', { maxColumns: 2 })).toThrow(
      'columns',
    )
    expect(() => readTabularFile('"x"oops', 'CSV')).toThrow('quoting')
    const parts = unzipSync(writeTabularFile([['123']], 'XLSX'))
    parts['xl/worksheets/sheet1.xml'] = strToU8(
      strFromU8(parts['xl/worksheets/sheet1.xml']!).replace(
        /r="1"|r="A1"/g,
        (value) => (value === 'r="1"' ? 'r="1000000"' : 'r="A1000000"'),
      ),
    )
    expect(() => readTabularFile(zipSync(parts), 'XLSX')).toThrow('limits')
  })
  it('rejects zip bombs before decompression', () => {
    const parts = unzipSync(writeTabularFile([['x']], 'XLSX'))
    parts['xl/sharedStrings.xml'] = strToU8('x'.repeat(100_000))
    expect(() =>
      readTabularFile(zipSync(parts), 'XLSX', { maxBytes: 3000 }),
    ).toThrow('limits')
  })
})
