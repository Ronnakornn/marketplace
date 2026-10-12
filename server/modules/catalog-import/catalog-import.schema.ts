import { z } from 'zod'
import { ReportingError } from '#server/modules/admin-reporting/reporting.errors.ts'
import {
  readTabularFile,
  type TabularFormat,
} from '#server/modules/admin-reporting/spreadsheet.ts'

export const importModeSchema = z.enum([
  'PRICE',
  'STOCK',
  'CONTENT',
  'CREATE',
  'ARCHIVE',
])
export type ImportMode = z.infer<typeof importModeSchema>
const uuid = z.string().uuid()
const minor = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/)
  .refine(
    (value) => BigInt(value) <= 9_223_372_036_854_775_807n,
    'Price exceeds database money bound',
  )
const integer = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/)
  .refine((value) => BigInt(value) <= 2_147_483_647n, 'Quantity exceeds Int32')
export const importInputSchema = z
  .object({
    variantId: uuid.optional(),
    productId: uuid.optional(),
    priceMinor: minor.optional(),
    quantityOnHand: integer.optional(),
    title: z.string().min(1).max(300).optional(),
    description: z.string().max(10_000).optional(),
    categoryId: z.union([uuid, z.literal('')]).optional(),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(200)
      .optional(),
    sku: z.string().min(1).max(100).optional(),
    variantTitle: z.string().min(1).max(300).optional(),
    currency: z.literal('THB').optional(),
  })
  .strict()
export type ImportInput = z.infer<typeof importInputSchema>
export const previewRowSchema = z.object({
  rowNumber: z.number(),
  input: z.record(z.string(), z.string()),
  before: z.record(z.string(), z.string()).nullable(),
  errors: z.array(z.string()),
})
export type PreviewRow = z.infer<typeof previewRowSchema>
export const previewRowsSchema = z.array(previewRowSchema).max(250)
export const importHeaders: Record<ImportMode, string[]> = {
  PRICE: ['variantId', 'priceMinor'],
  STOCK: ['variantId', 'quantityOnHand'],
  CONTENT: ['productId', 'title', 'description', 'categoryId'],
  CREATE: [
    'title',
    'slug',
    'description',
    'categoryId',
    'sku',
    'variantTitle',
    'priceMinor',
    'currency',
    'quantityOnHand',
  ],
  ARCHIVE: ['productId'],
}
export function parseImportRows(
  input: Uint8Array,
  format: TabularFormat,
  mode: ImportMode,
): PreviewRow[] {
  const table = readTabularFile(input, format)
  const headers = table.shift()?.map((header) => header.trim()) ?? []
  if (
    !headers.length ||
    new Set(headers).size !== headers.length ||
    headers.some((header) => !importHeaders[mode].includes(header))
  )
    throw new ReportingError('Use the downloaded template headers')
  if (!table.length)
    throw new ReportingError('Import requires at least one data row')
  const required =
    mode === 'PRICE'
      ? ['variantId', 'priceMinor']
      : mode === 'STOCK'
        ? ['variantId', 'quantityOnHand']
        : mode === 'CONTENT'
          ? ['productId', 'title']
          : mode === 'CREATE'
            ? ['title', 'slug', 'sku', 'variantTitle', 'priceMinor']
            : ['productId']
  if (required.some((header) => !headers.includes(header)))
    throw new ReportingError('Template is missing required columns')
  return table.map((row, index) => {
    const data = Object.fromEntries(
      headers.map((header, column) => [header, row[column]?.trim() ?? '']),
    )
    for (const key of Object.keys(data))
      if (
        data[key] === '' &&
        !required.includes(key) &&
        key !== 'description' &&
        key !== 'categoryId'
      )
        delete data[key]
    const parsed = importInputSchema.safeParse(data)
    const errors = parsed.success
      ? []
      : parsed.error.issues.map(
          (issue) => `${issue.path.join('.')}: ${issue.message}`,
        )
    if (row.length > headers.length) errors.push('Row has additional cells')
    for (const key of required)
      if (!data[key]) errors.push(`${key} is required`)
    return { rowNumber: index + 2, input: data, before: null, errors }
  })
}
