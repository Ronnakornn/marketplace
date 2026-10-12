import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate'
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { ReportingError } from './reporting.errors.ts'

export type TabularFormat = 'CSV' | 'XLSX'
export interface TabularLimits {
  maxRows?: number
  maxColumns?: number
  maxBytes?: number
}
const defaultLimits = { maxRows: 251, maxColumns: 40, maxBytes: 2_000_000 }
const MAX_CELL_LENGTH = 10_000
const isFormula = (value: string) =>
  /^[=+@]/.test(value.trimStart()) ||
  (/^-/.test(value.trimStart()) && !/^-\d+(?:\.\d+)?$/.test(value.trim()))

function checkedRows(
  rows: string[][],
  limits: typeof defaultLimits,
): string[][] {
  if (
    rows.length > limits.maxRows ||
    rows.some((row) => row.length > limits.maxColumns)
  )
    throw new ReportingError('Spreadsheet exceeds row or column limit')
  for (const row of rows)
    for (const cell of row) {
      if (cell.length > MAX_CELL_LENGTH)
        throw new ReportingError('Spreadsheet cell is too long')
      if (
        isFormula(cell) ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(cell)
      )
        throw new ReportingError(
          'Spreadsheet formulas and control characters are forbidden',
        )
    }
  return rows
}

function parseCsv(source: string, limits: typeof defaultLimits): string[][] {
  const rows: string[][] = [],
    row: string[] = []
  let cell = '',
    quoted = false,
    closedQuote = false
  const field = () => {
    row.push(cell)
    cell = ''
    closedQuote = false
    if (row.length > limits.maxColumns)
      throw new ReportingError('Too many columns')
  }
  const line = () => {
    field()
    rows.push(row.splice(0))
    if (rows.length > limits.maxRows) throw new ReportingError('Too many rows')
  }
  for (let index = 0; index < source.length; index++) {
    const char = source[index]!
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"'
        index++
      } else if (char === '"') {
        quoted = false
        closedQuote = true
      } else cell += char
    } else if (char === '"' && cell === '' && !closedQuote) quoted = true
    else if (char === ',') field()
    else if (char === '\n' || char === '\r') {
      line()
      if (char === '\r' && source[index + 1] === '\n') index++
    } else if (closedQuote || char === '"')
      throw new ReportingError('Malformed CSV quoting')
    else cell += char
    if (cell.length > MAX_CELL_LENGTH)
      throw new ReportingError('Spreadsheet cell is too long')
  }
  if (quoted) throw new ReportingError('Unclosed CSV field')
  if (cell !== '' || row.length > 0 || closedQuote) line()
  return rows
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ReportingError('Malformed XLSX XML')
  return value as Record<string, unknown>
}
const list = (value: unknown): unknown[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value]
function textContent(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number')
    return String(value)
  if (!value || typeof value !== 'object') return ''
  const item = object(value)
  return '#text' in item
    ? String(item['#text'])
    : list(item.r)
        .map((part) => textContent(object(part).t))
        .join('')
}

function parseXlsx(
  input: Uint8Array,
  limits: typeof defaultLimits,
): string[][] {
  let expanded = 0,
    entries = 0
  const files = unzipSync(input, {
    filter(entry) {
      expanded += entry.originalSize
      entries++
      if (
        expanded > limits.maxBytes * 5 ||
        entries > 100 ||
        entry.name.includes('..')
      )
        throw new ReportingError('XLSX archive exceeds limits')
      return /^(\[Content_Types\]\.xml|xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/sheet\d+\.xml))$/.test(
        entry.name,
      )
    },
  })
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
    processEntities: true,
  })
  function xml(path: string): Record<string, unknown> {
    const bytes = files[path]
    if (!bytes) throw new ReportingError(`Missing XLSX part: ${path}`)
    const source = strFromU8(bytes)
    if (
      /<!DOCTYPE|<!ENTITY|<(?:\w+:)?f(?:\s|>|\/)/i.test(source) ||
      XMLValidator.validate(source) !== true
    )
      throw new ReportingError('XLSX formulas or malformed XML are forbidden')
    return object(parser.parse(source))
  }
  const workbook = object(xml('xl/workbook.xml').workbook)
  const sheets = list(object(workbook.sheets).sheet)
  if (sheets.length !== 1)
    throw new ReportingError('Upload a workbook with exactly one worksheet')
  const relations = list(
    object(xml('xl/_rels/workbook.xml.rels').Relationships).Relationship,
  )
  const relation = relations
    .map(object)
    .find((item) => item['@_Id'] === object(sheets[0])['@_r:id'])
  if (
    !relation ||
    relation['@_TargetMode'] === 'External' ||
    typeof relation['@_Target'] !== 'string'
  )
    throw new ReportingError('Invalid XLSX worksheet relationship')
  const target = relation['@_Target'].replace(/^\//, '')
  const sheetPath = target.startsWith('xl/') ? target : `xl/${target}`
  if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(sheetPath))
    throw new ReportingError('Unsupported XLSX worksheet')
  const sharedStrings = files['xl/sharedStrings.xml']
    ? list(object(xml('xl/sharedStrings.xml').sst).si).map((item) =>
        textContent(object(item).t ?? item),
      )
    : []
  const worksheet = object(xml(sheetPath).worksheet)
  const rows: string[][] = []
  for (const rawRow of list(object(worksheet.sheetData).row)) {
    if (rows.length >= limits.maxRows) throw new ReportingError('Too many rows')
    const rowObject = object(rawRow),
      rowIndex = Number(rowObject['@_r']) - 1
    if (
      !Number.isInteger(rowIndex) ||
      rowIndex < 0 ||
      rowIndex >= limits.maxRows
    )
      throw new ReportingError('XLSX row is outside limits')
    while (rows.length <= rowIndex) rows.push([])
    const row = rows[rowIndex]!
    for (const rawCell of list(rowObject.c)) {
      const cell = object(rawCell),
        reference = String(cell['@_r']),
        match = /^([A-Z]+)(\d+)$/.exec(reference)
      if (!match || Number(match[2]) !== rowIndex + 1)
        throw new ReportingError('Invalid XLSX cell address')
      const column =
        [...match[1]!].reduce(
          (sum, char) => sum * 26 + char.charCodeAt(0) - 64,
          0,
        ) - 1
      if (
        column >= limits.maxColumns ||
        column < 0 ||
        row[column] !== undefined
      )
        throw new ReportingError('XLSX column is outside limits or repeated')
      if ('f' in cell) throw new ReportingError('XLSX formulas are forbidden')
      const type = cell['@_t']
      if (type === 's') {
        const index = Number(cell.v)
        if (!Number.isInteger(index) || sharedStrings[index] === undefined)
          throw new ReportingError('Invalid XLSX shared string')
        row[column] = sharedStrings[index]!
      } else if (type === 'inlineStr')
        row[column] = textContent(object(cell.is).t ?? cell.is)
      else if (
        type === undefined ||
        type === 'n' ||
        type === 'str' ||
        type === 'b'
      )
        row[column] = textContent(cell.v)
      else throw new ReportingError('Unsupported XLSX cell type')
    }
    for (let column = 0; column < row.length; column++) row[column] ??= ''
  }
  return rows
}

export function readTabularFile(
  input: Uint8Array | string,
  format: TabularFormat,
  bounds: TabularLimits = {},
): string[][] {
  const limits = { ...defaultLimits, ...bounds }
  const bytes = typeof input === 'string' ? strToU8(input) : input
  if (bytes.length > limits.maxBytes)
    throw new ReportingError('Spreadsheet is too large')
  try {
    return checkedRows(
      format === 'CSV'
        ? parseCsv(strFromU8(bytes).replace(/^\uFEFF/, ''), limits)
        : parseXlsx(bytes, limits),
      limits,
    )
  } catch (error) {
    if (error instanceof ReportingError) throw error
    throw new ReportingError('Malformed spreadsheet file')
  }
}

const xmlEscape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[char]!,
  )
function columnName(column: number): string {
  let result = ''
  do {
    result = String.fromCharCode(65 + (column % 26)) + result
    column = Math.floor(column / 26) - 1
  } while (column >= 0)
  return result
}

export function writeTabularFile(
  rows: readonly (readonly string[])[],
  format: TabularFormat,
): Uint8Array {
  if (
    rows.length > 10_001 ||
    rows.some(
      (row) =>
        row.length > 40 || row.some((cell) => cell.length > MAX_CELL_LENGTH),
    )
  )
    throw new ReportingError('Export exceeds spreadsheet limits')
  let bytes = 0
  for (const row of rows)
    for (const cell of row) {
      bytes += strToU8(cell).length
      if (
        bytes > 20_000_000 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(cell)
      )
        throw new ReportingError(
          'Export exceeds text limits or contains invalid characters',
        )
    }
  if (format === 'CSV')
    return strToU8(
      '\uFEFF' +
        rows
          .map((row) =>
            row
              .map(
                (cell) =>
                  `"${(isFormula(cell) ? "'" + cell : cell).replace(/"/g, '""')}"`,
              )
              .join(','),
          )
          .join('\r\n'),
    )
  const source = rows
    .map(
      (row, index) =>
        `<row r="${index + 1}">${row.map((cell, column) => `<c r="${columnName(column)}${index + 1}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell)}</t></is></c>`).join('')}</row>`,
    )
    .join('')
  return zipSync(
    {
      '[Content_Types].xml': strToU8(
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
      ),
      '_rels/.rels': strToU8(
        '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      ),
      'xl/workbook.xml': strToU8(
        '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>',
      ),
      'xl/_rels/workbook.xml.rels': strToU8(
        '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
      ),
      'xl/worksheets/sheet1.xml': strToU8(
        `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${source}</sheetData></worksheet>`,
      ),
    },
    { level: 6 },
  )
}
