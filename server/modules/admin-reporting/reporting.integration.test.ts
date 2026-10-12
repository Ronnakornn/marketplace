import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { PrismaClient } from '#generated/client/client.ts'
import {
  PrismaInventoryRepository,
  type CreateMovementInput,
} from '#server/modules/inventory/inventory.repository.ts'
import type { AdminAuthorizer } from '#server/modules/admin-access/admin-access.contract.ts'
import type { InventoryTx } from '#server/modules/inventory/inventory.repository.ts'
import { CatalogImportRepository } from '#server/modules/catalog-import/catalog-import.repository.ts'
import { CatalogImportService } from '#server/modules/catalog-import/catalog-import.service.ts'
import { AdminReportingRepository } from './reporting.repository.ts'
import { AdminReportingService } from './reporting.service.ts'
import { OrderDocumentsService } from './order-documents.service.ts'
import { ReportingError } from './reporting.errors.ts'

const database = process.env.REPORTING_TEST_DATABASE_URL
describe.skipIf(!database)(
  'durable reporting and imports in an isolated PostgreSQL database',
  () => {
    let prisma: PrismaClient,
      adminId: string,
      buyerId: string,
      otherId: string,
      shopId: string,
      otherShopId: string,
      variant1: string,
      variant2: string,
      otherVariant: string,
      orderId: string
    let permitted = true
    const actor = () => ({ id: adminId, role: 'ADMIN' as const })
    const authorizer: AdminAuthorizer = {
      async require(value) {
        if (!permitted || value.id !== adminId)
          throw new ReportingError(
            'Permission denied',
            403,
            'ADMIN_PERMISSION_DENIED',
          )
      },
    }
    const context = {
      logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
      config: { environment: 'test' },
    }
    let imports: CatalogImportService,
      reporting: AdminReportingService,
      documents: OrderDocumentsService
    beforeAll(async () => {
      const url = new URL(database!)
      if (
        !['localhost', '127.0.0.1'].includes(url.hostname) ||
        !/^\/(full_admin_reporting_test|marketplace_test_[a-z0-9_]+)$/.test(
          url.pathname,
        )
      )
        throw new Error(
          'Use the explicitly isolated administrative reporting test database',
        )
      prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: database! }),
      })
      const tag = randomUUID()
      const admin = await prisma.user.create({
        data: {
          name: 'Admin',
          email: `admin-${tag}@example.test`,
          role: 'ADMIN',
          emailVerified: true,
        },
      })
      const buyer = await prisma.user.create({
          data: { name: 'Buyer', email: `buyer-${tag}@example.test` },
        }),
        other = await prisma.user.create({
          data: { name: 'Other', email: `other-${tag}@example.test` },
        })
      adminId = admin.id
      buyerId = buyer.id
      otherId = other.id
      const profile = await prisma.sellerProfile.create({
        data: { userId: buyer.id },
      })
      const firstShop = await prisma.shop.create({
          data: {
            ownerId: buyer.id,
            sellerProfileId: profile.id,
            name: 'First shop',
            slug: `first-${tag}`,
            contactEmail: buyer.email,
            contactPhone: '0800000000',
            status: 'ACTIVE',
          },
        }),
        secondShop = await prisma.shop.create({
          data: {
            ownerId: buyer.id,
            sellerProfileId: profile.id,
            name: 'Second shop',
            slug: `second-${tag}`,
            contactEmail: buyer.email,
            contactPhone: '0800000000',
            status: 'ACTIVE',
          },
        })
      shopId = firstShop.id
      otherShopId = secondShop.id
      const product = await prisma.product.create({
          data: {
            shopId,
            title: 'Original title',
            slug: 'original-title',
            status: 'ACTIVE',
          },
        }),
        otherProduct = await prisma.product.create({
          data: {
            shopId: otherShopId,
            title: 'Other title',
            slug: 'other-title',
          },
        })
      const first = await prisma.productVariant.create({
          data: {
            productId: product.id,
            title: 'First variant',
            sku: 'first',
            price: 101n,
            inventory: { create: { quantityOnHand: 10, quantityReserved: 3 } },
          },
        }),
        second = await prisma.productVariant.create({
          data: {
            productId: product.id,
            title: 'Second variant',
            sku: 'second',
            price: 202n,
            inventory: { create: { quantityOnHand: 10, quantityReserved: 3 } },
          },
        }),
        outsider = await prisma.productVariant.create({
          data: {
            productId: otherProduct.id,
            title: 'Other variant',
            sku: 'other',
            price: 303n,
          },
        })
      variant1 = first.id
      variant2 = second.id
      otherVariant = outsider.id
      const cart = await prisma.cart.create({ data: { userId: buyerId } }),
        checkout = await prisma.checkout.create({
          data: {
            userId: buyerId,
            cartId: cart.id,
            status: 'COMPLETED',
            expiresAt: new Date(),
          },
        })
      const order = await prisma.order.create({
        data: {
          checkoutId: checkout.id,
          userId: buyerId,
          orderNumber: `FROZEN-${tag}`,
          status: 'PAID',
          paymentStatus: 'SUCCEEDED',
          subtotal: 101n,
          grandTotal: 101n,
          shippingName: 'Original buyer',
          shippingLine1: 'Original address',
          shippingCity: 'Bangkok',
          shippingPostalCode: '10100',
          shippingCountry: 'TH',
          items: {
            create: {
              shopId,
              variantId: variant1,
              productTitle: 'Purchased title',
              productSlug: product.slug,
              variantTitle: first.title,
              variantSku: first.sku,
              shopName: firstShop.name,
              shopSlug: firstShop.slug,
              quantity: 1,
              unitPrice: 101n,
              lineTotal: 101n,
            },
          },
        },
      })
      orderId = order.id
      await prisma.payment.create({
        data: {
          orderId,
          provider: 'test',
          providerIntentId: randomUUID(),
          status: 'SUCCEEDED',
          amount: order.grandTotal,
          currency: order.currency,
        },
      })
      imports = new CatalogImportService(
        new CatalogImportRepository(prisma),
        authorizer,
        new PrismaInventoryRepository(context, prisma),
      )
      reporting = new AdminReportingService(
        new AdminReportingRepository(prisma),
        authorizer,
      )
      documents = new OrderDocumentsService(prisma, authorizer)
    }, 30_000)
    afterAll(async () => {
      await prisma?.$disconnect()
    })
    const previewStock = (service = imports) =>
      service.preview(actor(), {
        shopId,
        mode: 'STOCK',
        format: 'CSV',
        contentBase64: Buffer.from(
          `variantId,quantityOnHand\n${variant1},12\n${variant2},13`,
        ).toString('base64'),
        requestKey: randomUUID(),
      })
    it('commits exact prices and replays one accepted job without duplicate writes', async () => {
      const preview = await imports.preview(actor(), {
        shopId,
        mode: 'PRICE',
        format: 'CSV',
        contentBase64: Buffer.from(
          `variantId,priceMinor\n${variant1},9007199254740993`,
        ).toString('base64'),
        requestKey: randomUUID(),
      })
      const first = await imports.commit(
        actor(),
        preview.id,
        preview.previewFingerprint,
      )
      const second = await imports.commit(
        actor(),
        preview.id,
        preview.previewFingerprint,
      )
      expect(first.status).toBe('COMMITTED')
      expect(second.id).toBe(first.id)
      expect(
        (
          await prisma.productVariant.findUniqueOrThrow({
            where: { id: variant1 },
          })
        ).price,
      ).toBe(9007199254740993n)
      expect(
        await prisma.auditLog.count({
          where: {
            entityId: preview.id,
            after: { path: ['status'], equals: 'COMMITTED' },
          },
        }),
      ).toBe(1)
    })
    it('recovers concurrent preview retries with one job and rejects reused upload identities', async () => {
      const input = {
        shopId,
        mode: 'PRICE' as const,
        format: 'CSV' as const,
        contentBase64: Buffer.from(
          `variantId,priceMinor\n${variant2},404`,
        ).toString('base64'),
        requestKey: randomUUID(),
      }
      const previews = await Promise.all([
        imports.preview(actor(), input),
        imports.preview(actor(), input),
      ])
      expect(previews[0]!.id).toBe(previews[1]!.id)
      await expect(
        imports.preview(actor(), {
          ...input,
          contentBase64: Buffer.from(
            `variantId,priceMinor\n${variant2},505`,
          ).toString('base64'),
        }),
      ).rejects.toMatchObject({ code: 'IMPORT_KEY_REUSED' })
    })
    it('rejects changed stock/reservations, wrong ownership and expired previews', async () => {
      const preview = await previewStock()
      await prisma.inventory.update({
        where: { variantId: variant2 },
        data: { quantityReserved: 4, version: { increment: 1 } },
      })
      await expect(
        imports.commit(actor(), preview.id, preview.previewFingerprint),
      ).rejects.toMatchObject({ code: 'IMPORT_STALE' })
      expect(
        (
          await prisma.inventory.findUniqueOrThrow({
            where: { variantId: variant1 },
          })
        ).quantityOnHand,
      ).toBe(10)
      const outsider = await imports.preview(actor(), {
        shopId,
        mode: 'PRICE',
        format: 'CSV',
        contentBase64: Buffer.from(
          `variantId,priceMinor\n${otherVariant},404`,
        ).toString('base64'),
        requestKey: randomUUID(),
      })
      expect(outsider.rows[0]!.errors[0]).toContain('selected shop')
      await expect(
        imports.commit(actor(), outsider.id, outsider.previewFingerprint),
      ).rejects.toMatchObject({ code: 'IMPORT_HAS_ERRORS' })
      const expired = await previewStock()
      await prisma.catalogImportJob.update({
        where: { id: expired.id },
        data: { expiresAt: new Date(0) },
      })
      await expect(
        imports.commit(actor(), expired.id, expired.previewFingerprint),
      ).rejects.toMatchObject({ code: 'IMPORT_EXPIRED' })
    })
    it('rolls every stock, movement, job and audit write back if a later row fails', async () => {
      class FailingInventoryRepository extends PrismaInventoryRepository {
        override createMovement(input: CreateMovementInput, tx?: InventoryTx) {
          if (input.inventory.variantId === variant2)
            throw new Error('Later row failed')
          return super.createMovement(input, tx)
        }
      }
      const failing = new CatalogImportService(
        new CatalogImportRepository(prisma),
        authorizer,
        new FailingInventoryRepository(context, prisma),
      )
      const preview = await previewStock(failing)
      await expect(
        failing.commit(actor(), preview.id, preview.previewFingerprint),
      ).rejects.toThrow('Later row failed')
      expect(
        (
          await prisma.inventory.findMany({
            where: { variantId: { in: [variant1, variant2] } },
            orderBy: { variantId: 'asc' },
          })
        ).map((item) => item.quantityOnHand),
      ).toEqual([10, 10])
      expect(
        await prisma.inventoryMovement.count({
          where: { referenceId: preview.id },
        }),
      ).toBe(0)
      expect(
        (
          await prisma.catalogImportJob.findUniqueOrThrow({
            where: { id: preview.id },
          })
        ).status,
      ).toBe('PREVIEW')
      expect(
        await prisma.auditLog.count({
          where: {
            entityId: preview.id,
            after: { path: ['status'], equals: 'COMMITTED' },
          },
        }),
      ).toBe(0)
    })
    it('guards reservations at preview and creates draft catalog rows through the catalog owner', async () => {
      const reserved = await imports.preview(actor(), {
        shopId,
        mode: 'STOCK',
        format: 'CSV',
        contentBase64: Buffer.from(
          `variantId,quantityOnHand\n${variant1},1`,
        ).toString('base64'),
        requestKey: randomUUID(),
      })
      expect(reserved.rows[0]!.errors[0]).toContain('reservations')
      const draft = await imports.preview(actor(), {
        shopId,
        mode: 'CREATE',
        format: 'CSV',
        contentBase64: Buffer.from(
          'title,slug,sku,variantTitle,priceMinor,quantityOnHand\nDraft product,draft-product,draft,Default,12345,7',
        ).toString('base64'),
        requestKey: randomUUID(),
      })
      expect(draft.rows[0]!.errors).toEqual([])
      await imports.commit(actor(), draft.id, draft.previewFingerprint)
      const created = await prisma.product.findFirstOrThrow({
        where: { slug: 'draft-product' },
        include: { variants: { include: { inventory: true } } },
      })
      expect(created.status).toBe('DRAFT')
      expect(created.variants[0]!.price).toBe(12345n)
      expect(created.variants[0]!.inventory!.quantityOnHand).toBe(7)
    })
    it('freezes issued document content and verifies buyer ownership and admin permission', async () => {
      const first = await documents.download(actor(), orderId, 'RECEIPT', 'en')
      await prisma.order.update({
        where: { id: orderId },
        data: { shippingLine1: 'Later address' },
      })
      await prisma.product.updateMany({
        where: { shopId },
        data: { title: 'Later title' },
      })
      const second = await documents.download(
        { id: buyerId, role: 'USER' },
        orderId,
        'RECEIPT',
        'en',
        true,
      )
      expect(second.number).toBe(first.number)
      expect(second.html).toBe(first.html)
      expect(second.html).toContain('Purchased title')
      expect(second.html).toContain('Original address')
      expect(second.html).not.toContain('Later address')
      expect(await prisma.orderDocument.count({ where: { orderId } })).toBe(1)
      await expect(
        documents.download(
          { id: otherId, role: 'USER' },
          orderId,
          'INVOICE',
          'en',
          true,
        ),
      ).rejects.toMatchObject({ status: 404 })
      permitted = false
      await expect(
        documents.download(actor(), orderId, 'INVOICE', 'en'),
      ).rejects.toMatchObject({ status: 403 })
      permitted = true
    })
    it('commits stock through inventory locking once and retains active reservations', async () => {
      const preview = await previewStock()
      await imports.commit(actor(), preview.id, preview.previewFingerprint)
      await imports.commit(actor(), preview.id, preview.previewFingerprint)
      const first = await prisma.inventory.findUniqueOrThrow({
          where: { variantId: variant1 },
        }),
        second = await prisma.inventory.findUniqueOrThrow({
          where: { variantId: variant2 },
        })
      expect([
        first.quantityOnHand,
        first.quantityReserved,
        second.quantityOnHand,
        second.quantityReserved,
      ]).toEqual([12, 3, 13, 4])
      expect(
        await prisma.inventoryMovement.count({
          where: { referenceId: preview.id },
        }),
      ).toBe(2)
    })
    it('claims exports once, retries failed claims and prevents private cross-requester download', async () => {
      const repository = new AdminReportingRepository(prisma)
      const job = await repository.createJob(actor(), {
        type: 'SALES',
        format: 'XLSX',
        filters: { from: '2026-10-01', to: '2026-10-02' },
      })
      const now = new Date()
      const claims = await Promise.all([
        repository.claimJob(job.id, now),
        repository.claimJob(job.id, now),
      ])
      expect(claims.filter(Boolean)).toHaveLength(1)
      await repository.failJob(
        claims.find((claim) => claim !== null)!,
        'Transient failure',
      )
      expect(
        await repository.claimJob(job.id, new Date(now.getTime() + 1)),
      ).not.toBeNull()
      await expect(
        reporting.download({ id: otherId, role: 'ADMIN' }, job.id),
      ).rejects.toMatchObject({ status: 403 })
      const otherAdmin = new AdminReportingService(repository, {
        async require() {},
      })
      await expect(
        otherAdmin.download({ id: otherId, role: 'ADMIN' }, job.id),
      ).rejects.toMatchObject({ status: 404 })
      permitted = false
      await reporting.processExport(
        job.id,
        new Date(now.getTime() + 16 * 60_000),
      )
      expect((await repository.findJob(job.id))!.status).toBe('EXPIRED')
      permitted = true
    })
    it('enqueues one durable schedule identity and denies a revoked requester before scheduling', async () => {
      const schedule = await reporting.saveSchedule(actor(), {
        name: 'Daily',
        type: 'SALES',
        format: 'CSV',
        filters: { group: 'shop' },
        cadence: 'DAILY',
        hour: 8,
      })
      const past = new Date(Date.now() - 60_000)
      await prisma.reportSchedule.update({
        where: { id: schedule.id },
        data: { nextRunAt: past },
      })
      permitted = false
      await reporting.processDueSchedules()
      expect(
        await prisma.reportExportJob.count({
          where: { scheduleId: schedule.id },
        }),
      ).toBe(0)
      expect(
        (
          await prisma.reportSchedule.findUniqueOrThrow({
            where: { id: schedule.id },
          })
        ).isActive,
      ).toBe(false)
      permitted = true
      await prisma.reportSchedule.update({
        where: { id: schedule.id },
        data: { isActive: true },
      })
      await reporting.processDueSchedules()
      await reporting.processDueSchedules()
      expect(
        await prisma.reportExportJob.count({
          where: { scheduleId: schedule.id },
        }),
      ).toBe(1)
      const job = await prisma.reportExportJob.findFirstOrThrow({
        where: { scheduleId: schedule.id },
      })
      expect(job.runKey).toBe(`${schedule.id}:${past.toISOString()}`)
    })
    it('subtracts only matched recorded expenses in the exact half-open period', async () => {
      const from = new Date(Date.now() + 100 * 366 * 86400_000),
        to = new Date(from.getTime() + 1000)
      await prisma.financeReconciliation.create({
        data: {
          kind: 'OPERATING_EXPENSE',
          sourceKey: randomUUID(),
          amount: 9007199254740993n,
          currency: 'THB',
          status: 'MATCHED',
          occurredAt: from,
          createdById: adminId,
        },
      })
      await prisma.financeReconciliation.create({
        data: {
          kind: 'OPERATING_EXPENSE',
          sourceKey: randomUUID(),
          amount: 10n,
          currency: 'THB',
          status: 'UNMATCHED',
          occurredAt: from,
          createdById: adminId,
        },
      })
      await prisma.financeReconciliation.create({
        data: {
          kind: 'OPERATING_EXPENSE',
          sourceKey: randomUUID(),
          amount: 20n,
          currency: 'THB',
          status: 'MATCHED',
          occurredAt: to,
          createdById: adminId,
        },
      })
      const report = await reporting.query(actor(), {
        from: from.toISOString(),
        to: to.toISOString(),
      })
      const included = report.totals.find((row) => row.currency === 'THB')!
      expect(included.recordedExpenses).toBe(9007199254740993n)
      expect(included.operatingContribution).toBe(-9007199254740993n)
      expect(
        (
          await reporting.query(actor(), {
            from: from.toISOString(),
            to: to.toISOString(),
            shopId,
          })
        ).totals.every((row) => row.operatingContribution === null),
      ).toBe(true)
    })
  },
)
