import { Prisma, type PrismaClient } from '#generated/client/client.ts'
import type { AdminActor } from '#server/modules/admin-access/admin-access.contract.ts'
import type { ImportMode, PreviewRow } from './catalog-import.schema.ts'

export class CatalogImportRepository {
  constructor(readonly prisma: PrismaClient) {}
  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(fn, { timeout: 30_000 })
  }
  findJob(id: string, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).catalogImportJob.findUnique({ where: { id } })
  }
  findRequest(requestKey: string) {
    return this.prisma.catalogImportJob.findUnique({ where: { requestKey } })
  }
  listJobs(actorId: string) {
    return this.prisma.catalogImportJob.findMany({
      where: { requestedById: actorId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      omit: { rows: true },
    })
  }
  findShop(id: string, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).shop.findUnique({
      where: { id },
      select: { id: true, status: true, ownerId: true, sellerProfileId: true },
    })
  }
  variants(ids: string[], tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).productVariant.findMany({
      where: { id: { in: ids } },
      include: { product: true, inventory: true },
    })
  }
  products(ids: string[], tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).product.findMany({ where: { id: { in: ids } } })
  }
  categories(ids: string[], tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).category.findMany({
      where: { id: { in: ids }, isActive: true },
      select: {
        id: true,
        attributeDefinitions: {
          where: { isRequired: true },
          select: { id: true },
        },
      },
    })
  }
  existingSlugs(
    shopId: string,
    slugs: string[],
    tx?: Prisma.TransactionClient,
  ) {
    return (tx ?? this.prisma).product.findMany({
      where: { shopId, slug: { in: slugs } },
      select: { slug: true },
    })
  }
  async createPreview(
    actor: AdminActor,
    input: {
      shopId: string
      mode: ImportMode
      rows: PreviewRow[]
      previewFingerprint: string
      requestKey: string
      sourceHash: string
    },
  ) {
    return this.transaction(async (tx) => {
      const job = await tx.catalogImportJob.create({
        data: {
          requestedById: actor.id,
          shopId: input.shopId,
          mode: input.mode,
          rows: input.rows,
          requestKey: input.requestKey,
          previewFingerprint: input.previewFingerprint,
          expiresAt: new Date(Date.now() + 30 * 60_000),
          result: {
            sourceHash: input.sourceHash,
            errorCount: input.rows.filter((row) => row.errors.length).length,
          },
        },
      })
      await this.audit(tx, actor, job.id, {
        status: 'PREVIEW',
        mode: input.mode,
        rowCount: input.rows.length,
      })
      return job
    })
  }
  async lock(
    tx: Prisma.TransactionClient,
    jobId: string,
    shopId: string,
    productIds: string[],
    variantIds: string[],
  ) {
    await tx.$queryRaw`SELECT "id" FROM "CatalogImportJob" WHERE "id" = ${jobId}::uuid FOR UPDATE`
    await tx.$queryRaw`SELECT "id" FROM "Shop" WHERE "id" = ${shopId}::uuid FOR UPDATE`
    if (productIds.length)
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Product" WHERE "id" IN (${Prisma.join(productIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY "id" FOR UPDATE`,
      )
    if (variantIds.length)
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "ProductVariant" WHERE "id" IN (${Prisma.join(variantIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY "id" FOR UPDATE`,
      )
    if (variantIds.length)
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Inventory" WHERE "variantId" IN (${Prisma.join(variantIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY "id" FOR UPDATE`,
      )
  }
  finish(
    tx: Prisma.TransactionClient,
    id: string,
    result: Prisma.InputJsonValue,
  ) {
    return tx.catalogImportJob.update({
      where: { id },
      data: { status: 'COMMITTED', result },
    })
  }
  async audit(
    tx: Prisma.TransactionClient,
    actor: AdminActor,
    id: string,
    after: Prisma.InputJsonValue,
  ) {
    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        actorRole: actor.role,
        action: 'ADMIN_CONFIG_CHANGED',
        entityType: 'CatalogImportJob',
        entityId: id,
        after,
      },
    })
  }
  async exportRows(shopId: string) {
    return this.prisma.productVariant.findMany({
      where: { product: { shopId, deletedAt: null } },
      include: { product: true, inventory: true },
      orderBy: { id: 'asc' },
      take: 10_001,
    })
  }
}
