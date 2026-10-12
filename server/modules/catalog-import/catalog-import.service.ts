import { createHash } from 'node:crypto'
import { z } from 'zod'
import { Prisma } from '#generated/client/client.ts'
import type {
  AdminActor,
  AdminAuthorizer,
} from '#server/modules/admin-access/admin-access.contract.ts'
import type { IInventoryRepository } from '#server/modules/inventory/inventory.repository.ts'
import type { CacheInvalidation } from '#server/modules/cache'
import { CatalogBulkRepository } from '#server/modules/catalog/catalog-bulk.repository.ts'
import { ReportingError } from '#server/modules/admin-reporting/reporting.errors.ts'
import {
  writeTabularFile,
  type TabularFormat,
} from '#server/modules/admin-reporting/spreadsheet.ts'
import { CatalogImportRepository } from './catalog-import.repository.ts'
import {
  importInputSchema,
  importHeaders,
  importModeSchema,
  parseImportRows,
  previewRowsSchema,
  type ImportMode,
  type PreviewRow,
} from './catalog-import.schema.ts'

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)]),
    )
  return value
}
const digest = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex')
const previewMeta = z.object({ sourceHash: z.string() })
export class CatalogImportService {
  constructor(
    private repo: CatalogImportRepository,
    private authorizer: AdminAuthorizer,
    private inventory: IInventoryRepository,
    private catalog = new CatalogBulkRepository(),
    private cache?: CacheInvalidation,
  ) {}
  private async prepare(
    shopId: string,
    mode: ImportMode,
    rows: PreviewRow[],
    tx?: Prisma.TransactionClient,
  ) {
    const shop = await this.repo.findShop(shopId, tx)
    if (!shop || shop.status !== 'ACTIVE')
      throw new ReportingError('Choose an active shop', 404, 'SHOP_UNAVAILABLE')
    const inputs = rows
      .filter((row) => !row.errors.length)
      .map((row) => importInputSchema.parse(row.input))
    const variantIds = inputs.flatMap((input) =>
      input.variantId ? [input.variantId] : [],
    )
    const productIds = inputs.flatMap((input) =>
      input.productId ? [input.productId] : [],
    )
    const categoryIds = inputs.flatMap((input) =>
      input.categoryId ? [input.categoryId] : [],
    )
    const [variants, products, categories, slugs] = await Promise.all([
      this.repo.variants(variantIds, tx),
      this.repo.products(productIds, tx),
      this.repo.categories(categoryIds, tx),
      mode === 'CREATE'
        ? this.repo.existingSlugs(
            shopId,
            inputs.flatMap((input) => (input.slug ? [input.slug] : [])),
            tx,
          )
        : Promise.resolve([]),
    ])
    const variantMap = new Map(variants.map((item) => [item.id, item])),
      productMap = new Map(products.map((item) => [item.id, item])),
      categoryMap = new Map(categories.map((item) => [item.id, item])),
      slugSet = new Set(slugs.map((item) => item.slug))
    const seen = new Set<string>()
    return rows.map((row) => {
      if (row.errors.length) return row
      const input = importInputSchema.parse(row.input),
        errors: string[] = []
      const stableKey = input.variantId ?? input.productId ?? input.slug!
      if (seen.has(stableKey))
        errors.push('Duplicate resource in the same import')
      seen.add(stableKey)
      if (input.categoryId && !categoryMap.has(input.categoryId))
        errors.push('Category is unavailable')
      if (
        (mode === 'CREATE' || mode === 'CONTENT') &&
        input.categoryId &&
        categoryMap.get(input.categoryId)?.attributeDefinitions.length
      )
        errors.push(
          'This category requires product specifications; use the product editor',
        )
      let before: PreviewRow['before'] = { shopId, shopStatus: shop.status }
      if (mode === 'PRICE' || mode === 'STOCK') {
        const variant = variantMap.get(input.variantId!)
        if (
          !variant ||
          variant.product.shopId !== shopId ||
          variant.product.deletedAt
        )
          errors.push('Variant does not belong to the selected shop')
        else {
          before = {
            ...before,
            productId: variant.productId,
            variantId: variant.id,
            priceMinor: variant.price.toString(),
            variantUpdatedAt: variant.updatedAt.toISOString(),
            productUpdatedAt: variant.product.updatedAt.toISOString(),
            quantityOnHand: String(variant.inventory?.quantityOnHand ?? 0),
            quantityReserved: String(variant.inventory?.quantityReserved ?? 0),
            inventoryVersion: String(variant.inventory?.version ?? 0),
          }
          if (
            mode === 'STOCK' &&
            Number(input.quantityOnHand) <
              (variant.inventory?.quantityReserved ?? 0)
          )
            errors.push('On-hand stock cannot be below active reservations')
        }
      } else if (mode === 'CONTENT' || mode === 'ARCHIVE') {
        const product = productMap.get(input.productId!)
        if (!product || product.shopId !== shopId || product.deletedAt)
          errors.push('Product does not belong to the selected shop')
        else
          before = {
            ...before,
            productId: product.id,
            title: product.title,
            description: product.description ?? '',
            categoryId: product.categoryId ?? '',
            updatedAt: product.updatedAt.toISOString(),
            status: product.status,
          }
      } else if (input.slug && slugSet.has(input.slug))
        errors.push('Product slug already exists in this shop')
      return { ...row, before, errors }
    })
  }
  async preview(
    actor: AdminActor,
    input: {
      shopId: string
      mode: ImportMode
      format: TabularFormat
      contentBase64: string
      requestKey: string
    },
  ) {
    await this.authorizer.require(actor, 'catalog.write')
    if (
      !/^[A-Za-z0-9+/]*={0,2}$/.test(input.contentBase64) ||
      input.contentBase64.length > 2_700_000
    )
      throw new ReportingError('Invalid or oversized upload')
    const data = Buffer.from(input.contentBase64, 'base64'),
      mode = importModeSchema.parse(input.mode)
    const parsed = parseImportRows(data, input.format, mode)
    const sourceHash = digest({
      shopId: input.shopId,
      mode,
      rows: parsed.map((row) => row.input),
    })
    const requestKey = `${actor.id}:${input.requestKey}`
    const existing = await this.repo.findRequest(requestKey)
    if (existing) {
      if (previewMeta.parse(existing.result).sourceHash !== sourceHash)
        throw new ReportingError(
          'Request key was used for a different upload',
          409,
          'IMPORT_KEY_REUSED',
        )
      return this.projection(existing)
    }
    const rows = await this.prepare(input.shopId, mode, parsed)
    const create = () =>
      this.repo.createPreview(actor, {
        shopId: input.shopId,
        mode,
        rows,
        previewFingerprint: digest({ shopId: input.shopId, mode, rows }),
        requestKey,
        sourceHash,
      })
    let job
    try {
      job = await create()
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      )
        throw error
      job = await this.repo.findRequest(requestKey)
      if (!job || previewMeta.parse(job.result).sourceHash !== sourceHash)
        throw new ReportingError(
          'Request key was used for a different upload',
          409,
          'IMPORT_KEY_REUSED',
        )
    }
    return this.projection(job)
  }
  private projection(
    job: NonNullable<Awaited<ReturnType<CatalogImportRepository['findJob']>>>,
  ) {
    return {
      id: job.id,
      mode: job.mode,
      shopId: job.shopId,
      status: job.status,
      previewFingerprint: job.previewFingerprint,
      expiresAt: job.expiresAt,
      rows: previewRowsSchema.parse(job.rows),
      result: job.result,
    }
  }
  async get(actor: AdminActor, id: string) {
    await this.authorizer.require(actor, 'catalog.write')
    const job = await this.repo.findJob(id)
    if (!job || job.requestedById !== actor.id)
      throw new ReportingError('Import not found', 404, 'IMPORT_NOT_FOUND')
    return this.projection(job)
  }
  async list(actor: AdminActor) {
    await this.authorizer.require(actor, 'catalog.write')
    return this.repo.listJobs(actor.id)
  }
  async commit(
    actor: AdminActor,
    id: string,
    acceptedFingerprint: string,
    now = new Date(),
  ) {
    await this.authorizer.require(actor, 'catalog.write')
    const changedProducts = new Set<string>()
    const committed = await this.repo.transaction(async (tx) => {
      const initial = await this.repo.findJob(id, tx)
      if (!initial || initial.requestedById !== actor.id || !initial.shopId)
        throw new ReportingError('Import not found', 404, 'IMPORT_NOT_FOUND')
      const initialRows = previewRowsSchema.parse(initial.rows)
      const productIds = initialRows.flatMap((row) =>
        row.before?.productId ? [row.before.productId] : [],
      )
      const variantIds = initialRows.flatMap((row) =>
        row.input.variantId ? [row.input.variantId] : [],
      )
      await this.repo.lock(tx, id, initial.shopId, productIds, variantIds)
      const job = (await this.repo.findJob(id, tx))!
      if (job.previewFingerprint !== acceptedFingerprint)
        throw new ReportingError(
          'The accepted preview does not match',
          409,
          'IMPORT_PREVIEW_CHANGED',
        )
      if (job.status === 'COMMITTED') return job
      if (job.expiresAt <= now)
        throw new ReportingError(
          'Import preview expired',
          410,
          'IMPORT_EXPIRED',
        )
      if (
        job.status !== 'PREVIEW' ||
        initialRows.some((row) => row.errors.length)
      )
        throw new ReportingError(
          'Resolve preview errors before committing',
          409,
          'IMPORT_HAS_ERRORS',
        )
      const mode = importModeSchema.parse(job.mode)
      const currentRows = await this.prepare(
        job.shopId!,
        mode,
        initialRows.map((row) => ({ ...row, errors: [] })),
        tx,
      )
      if (
        digest({ shopId: job.shopId, mode, rows: currentRows }) !==
        job.previewFingerprint
      )
        throw new ReportingError(
          'Catalog or stock changed; upload a new preview',
          409,
          'IMPORT_STALE',
        )
      const results: Array<{
        rowNumber: number
        productId: string
        variantId?: string
      }> = []
      for (const row of currentRows) {
        const input = importInputSchema.parse(row.input)
        let productId = row.before?.productId ?? '',
          variantId = input.variantId
        if (mode === 'PRICE')
          await this.catalog.updatePrice(
            tx,
            input.variantId!,
            BigInt(input.priceMinor!),
          )
        else if (mode === 'CONTENT')
          await this.catalog.updateContent(tx, input.productId!, {
            title: input.title!,
            description: input.description ?? row.before!.description!,
            categoryId:
              input.categoryId === undefined
                ? row.before!.categoryId || null
                : input.categoryId || null,
          })
        else if (mode === 'ARCHIVE')
          await this.catalog.archive(tx, input.productId!)
        else if (mode === 'CREATE') {
          const created = await this.catalog.createDraft(tx, {
            shopId: job.shopId!,
            title: input.title!,
            slug: input.slug!,
            description: input.description ?? null,
            categoryId: input.categoryId || null,
            sku: input.sku!,
            variantTitle: input.variantTitle!,
            price: BigInt(input.priceMinor!),
            currency: input.currency ?? 'THB',
          })
          productId = created.id
          variantId = created.variants[0]!.id
        }
        if (
          (mode === 'STOCK' || mode === 'CREATE') &&
          input.quantityOnHand !== undefined
        ) {
          const current = await this.inventory.ensureInventory(variantId!, tx)
          const quantity = Number(input.quantityOnHand)
          if (quantity < current.quantityReserved)
            throw new ReportingError(
              'On-hand quantity cannot be below reservations',
              409,
              'INSUFFICIENT_STOCK',
            )
          const updated = await this.inventory.updateInventory(
            current.id,
            { quantityOnHand: quantity },
            tx,
          )
          await this.inventory.createMovement(
            {
              inventory: current,
              updatedInventory: updated,
              type: 'ADJUSTMENT',
              quantityDelta: quantity - current.quantityOnHand,
              actorUserId: actor.id,
              reason: 'Administrative catalog import',
              referenceType: 'CATALOG_IMPORT',
              referenceId: job.id,
            },
            tx,
          )
        }
        changedProducts.add(productId)
        results.push({
          rowNumber: row.rowNumber,
          productId,
          ...(variantId ? { variantId } : {}),
        })
      }
      const result = {
        ...previewMeta.parse(job.result),
        rowCount: results.length,
        results,
      }
      const updated = await this.repo.finish(tx, id, result)
      await this.repo.audit(tx, actor, id, {
        status: 'COMMITTED',
        mode,
        rowCount: results.length,
        results,
      })
      return updated
    })
    if (changedProducts.size)
      await Promise.all([
        ...[...changedProducts].map((productId) =>
          this.cache?.invalidateVariant(productId),
        ),
        this.cache?.invalidateCatalogDiscoveryAndSearch(),
        this.cache?.invalidateSellerDashboard(committed.shopId!),
      ])
    return this.projection(committed)
  }
  async template(actor: AdminActor, mode: ImportMode, format: TabularFormat) {
    await this.authorizer.require(actor, 'catalog.read')
    return writeTabularFile([importHeaders[mode]], format)
  }
  async export(actor: AdminActor, shopId: string, format: TabularFormat) {
    await this.authorizer.require(actor, 'catalog.read')
    const rows = await this.repo.exportRows(shopId)
    if (rows.length > 10_000)
      throw new ReportingError(
        'Catalog export exceeds 10,000 variants; export a smaller shop',
      )
    return writeTabularFile(
      [
        [
          'productId',
          'variantId',
          'title',
          'description',
          'categoryId',
          'sku',
          'variantTitle',
          'priceMinor',
          'currency',
          'quantityOnHand',
          'quantityReserved',
          'status',
        ],
        ...rows.map((row) => [
          row.productId,
          row.id,
          row.product.title,
          row.product.description ?? '',
          row.product.categoryId ?? '',
          row.sku,
          row.title,
          row.price.toString(),
          row.currency,
          String(row.inventory?.quantityOnHand ?? 0),
          String(row.inventory?.quantityReserved ?? 0),
          row.product.status,
        ]),
      ],
      format,
    )
  }
}
