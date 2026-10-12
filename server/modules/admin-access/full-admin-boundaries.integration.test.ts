import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Elysia } from 'elysia'
import { PrismaClient, type User } from '#generated/client/client.ts'
import {
  thresholdContext,
  numericThresholdFixture,
} from '#server/test-support/numeric-threshold.fixture.ts'
import { createFinanceFixture } from '../../../e2e/helpers/finance-fixtures.ts'
import { PrismaUserRepository } from '#server/modules/user/user.repository.ts'
import { UserService } from '#server/modules/user/user.service.ts'
import { EmailService } from '#server/modules/email/email.service.ts'
import { AdminService } from '#server/modules/admin/admin.service.ts'
import { AdminConfigRepository } from '#server/modules/admin-config/admin-config.repository.ts'
import { AdminConfigService } from '#server/modules/admin-config/admin-config.service.ts'
import { createAdminConfigGuard } from '#server/modules/admin-config/admin-config.guard.ts'
import { PrismaAdminOperationsRepository } from '#server/modules/admin-operations/operations.repository.ts'
import { AdminOperationsService } from '#server/modules/admin-operations/operations.service.ts'
import { CatalogApprovalRepository } from '#server/modules/catalog/catalog-approval.repository.ts'
import { PrismaCatalogRepository } from '#server/modules/catalog/catalog.repository.ts'
import { CatalogService } from '#server/modules/catalog/catalog.service.ts'
import { PrismaAdminRepository } from '#server/modules/admin/admin.repository.ts'
import { PrismaRefundRepository } from '#server/modules/refund/refund.repository.ts'
import { PrismaPayoutRepository } from '#server/modules/payout/payout.repository.ts'
import { PayoutService } from '#server/modules/payout/payout.service.ts'
import { PrismaSupportRepository } from '#server/modules/support/support.repository.ts'
import { SupportService } from '#server/modules/support/support.service.ts'
import { PrismaUploadRepository } from '#server/modules/upload/upload.repository.ts'
import { UploadService } from '#server/modules/upload/upload.service.ts'
import { LocalUploadStorage } from '#server/modules/upload/upload.storage.ts'
import { PrismaCheckoutRepository } from '#server/modules/checkout/checkout.repository.ts'
import { CheckoutQuoteEvaluator } from '#server/modules/checkout/checkout-quote.evaluator.ts'
import { CheckoutService } from '#server/modules/checkout/checkout.service.ts'
import { PrismaPromotionRepository } from '#server/modules/promotion/promotion.repository.ts'
import { PromotionService } from '#server/modules/promotion/promotion.service.ts'
import { AdminAccessRepository } from './admin-access.repository.ts'
import { AdminAccessService } from './admin-access.service.ts'

const url = process.env.FULL_ADMIN_BOUNDARIES_TEST_DATABASE_URL
describe.skipIf(!url)(
  'full administrator transaction boundaries on PostgreSQL',
  () => {
    let db: PrismaClient,
      access: AdminAccessService,
      users: PrismaUserRepository
    beforeAll(() => {
      const parsed = new URL(url!)
      const local = ['127.0.0.1', 'localhost'].includes(parsed.hostname)
      const isolated =
        (parsed.pathname === '/full_admin_boundaries_test' &&
          parsed.port === '57439') ||
        (parsed.pathname === '/marketplace_test_admin_boundaries' &&
          !!parsed.port &&
          parsed.port !== '5432')
      if (
        !local ||
        !isolated ||
        !['postgres:', 'postgresql:'].includes(parsed.protocol)
      )
        throw new Error(
          'Dedicated local admin boundaries database on a nonstandard port required',
        )
      db = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url! }),
      })
      access = new AdminAccessService(new AdminAccessRepository(db))
      users = new PrismaUserRepository(thresholdContext, db)
    })
    beforeEach(async () => {
      // This suite owns the database. Prior fixture memberships must not count as owners.
      await db.adminTeamMember.deleteMany()
      await db.featureToggle.deleteMany()
    })
    afterAll(async () => {
      await db?.$disconnect()
    })

    async function owner() {
      const user = await db.user.create({
        data: {
          name: 'Boundary owner',
          email: `${randomUUID()}@example.test`,
          role: 'ADMIN',
          emailVerified: true,
        },
      })
      await membership(user)
      return user
    }
    async function membership(user: User) {
      return db.adminTeamMember.create({
        data: { userId: user.id, label: 'Boundary owner', isOwner: true },
      })
    }
    async function revokeBeforeWrite(
      userId: string,
      operation: () => Promise<unknown>,
    ) {
      let ready!: () => void, release!: () => void
      const locked = new Promise<void>((resolve) => {
        ready = resolve
      })
      const hold = new Promise<void>((resolve) => {
        release = resolve
      })
      const revocation = db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(719362804)`
        await tx.adminTeamMember.update({
          where: { userId },
          data: { isActive: false },
        })
        ready()
        await hold
      })
      await locked
      const attempt = operation()
      const result = Promise.allSettled([revocation, attempt])
      release()
      return (await result)[1]
    }
    function support() {
      return new SupportService(
        thresholdContext,
        new PrismaSupportRepository(thresholdContext, db),
      )
    }
    function checkout(
      requirePromotionAdmission?: ConstructorParameters<
        typeof CheckoutQuoteEvaluator
      >[2],
    ) {
      return new CheckoutService(
        thresholdContext,
        new PrismaCheckoutRepository(thresholdContext, db),
        new CheckoutQuoteEvaluator(
          new PromotionService(
            thresholdContext,
            new PrismaPromotionRepository(thresholdContext, db),
          ),
          true,
          requirePromotionAdmission,
        ),
        undefined,
        { provider: 'mock', mockEnabled: true },
      )
    }

    function config() {
      return new AdminConfigService(new AdminConfigRepository(db), access)
    }
    function operations() {
      return new AdminOperationsService(
        thresholdContext,
        new PrismaAdminOperationsRepository(thresholdContext, db),
        access,
      )
    }

    it.each(['UserService', 'AdminService'] as const)(
      'prevents a delegated team manager from changing an owner account in %s',
      async (backend) => {
        const target = await owner(),
          manager = await db.user.create({
            data: {
              name: 'Delegated team manager',
              email: `${randomUUID()}@example.test`,
              role: 'ADMIN',
              emailVerified: true,
            },
          })
        await db.adminTeamMember.create({
          data: {
            userId: manager.id,
            label: 'Manager',
            permissions: ['users.write', 'team.manage'],
          },
        })
        const proposedEmail = `${randomUUID()}@example.test`
        const userService = new UserService(
          thresholdContext,
          new PrismaUserRepository(thresholdContext, db, access),
          new EmailService({
            async send() {
              throw new Error('Unexpected email send')
            },
          }),
          access,
        )
        const adminService = new AdminService(
          thresholdContext,
          new PrismaAdminRepository(thresholdContext, db, access),
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          access,
        )
        await expect(
          backend === 'UserService'
            ? userService.updateForAdmin(manager.id, target.id, {
                name: target.name,
                email: proposedEmail,
                role: 'ADMIN',
              })
            : adminService.updateUser(manager, target.id, {
                email: proposedEmail,
              }),
        ).rejects.toMatchObject({ status: 403 })
        expect(
          await db.user.findUniqueOrThrow({ where: { id: target.id } }),
        ).toMatchObject({
          email: target.email,
          role: 'ADMIN',
          status: 'ACTIVE',
        })
      },
    )
    it.each(['UserRepository', 'AdminRepository'] as const)(
      'requires fresh team permission when a queued %s target becomes an administrator',
      async (backend) => {
        const editor = await db.user.create({
          data: {
            name: 'User editor',
            email: `${randomUUID()}@example.test`,
            role: 'ADMIN',
            emailVerified: true,
          },
        })
        await db.adminTeamMember.create({
          data: {
            userId: editor.id,
            label: 'User editor',
            permissions: ['users.write'],
          },
        })
        const target = await db.user.create({
          data: {
            name: 'Originally buyer',
            email: `${randomUUID()}@example.test`,
          },
        })
        let ready!: () => void, release!: () => void
        const locked = new Promise<void>((resolve) => {
            ready = resolve
          }),
          hold = new Promise<void>((resolve) => {
            release = resolve
          })
        const promotion = db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(719362804)`
          await tx.user.update({
            where: { id: target.id },
            data: { role: 'ADMIN' },
          })
          ready()
          await hold
        })
        await locked
        const proposedEmail = `${randomUUID()}@example.test`
        const attempt =
          backend === 'UserRepository'
            ? new PrismaUserRepository(thresholdContext, db, access).updateUser(
                target.id,
                { email: proposedEmail },
                editor,
              )
            : new PrismaAdminRepository(
                thresholdContext,
                db,
                access,
              ).updateUser(target.id, { email: proposedEmail }, editor)
        const results = Promise.allSettled([promotion, attempt])
        release()
        expect((await results)[1]).toMatchObject({
          status: 'rejected',
          reason: { status: 403 },
        })
        expect(
          await db.user.findUniqueOrThrow({ where: { id: target.id } }),
        ).toMatchObject({ email: target.email, role: 'ADMIN' })
      },
    )
    it('rechecks template write permission after a successful preflight waits for a grant revocation', async () => {
      const writer = await db.user.create({
        data: {
          name: 'Template writer',
          email: `${randomUUID()}@example.test`,
          role: 'ADMIN',
          emailVerified: true,
        },
      })
      await db.adminTeamMember.create({
        data: {
          userId: writer.id,
          label: 'Template writer',
          permissions: ['settings.write'],
        },
      })
      let ready!: () => void, release!: () => void, preflight!: () => void
      const locked = new Promise<void>((resolve) => {
          ready = resolve
        }),
        hold = new Promise<void>((resolve) => {
          release = resolve
        }),
        passed = new Promise<void>((resolve) => {
          preflight = resolve
        })
      let successfulChecks = 0
      const cfg = new AdminConfigService(new AdminConfigRepository(db), {
        async require(actor, permission) {
          await access.require(actor, permission)
          successfulChecks++
          if (successfulChecks === 1) preflight()
        },
      })
      const revocation = db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(719362804)`
        await tx.adminTeamMember.update({
          where: { userId: writer.id },
          data: { isActive: false },
        })
        ready()
        await hold
      })
      await locked
      const key = `revoked.${randomUUID()}`
      const attempt = cfg.saveTemplate(writer, null, {
        key,
        channel: 'EMAIL',
        locale: 'en',
        subject: null,
        body: 'Hello {{name}}',
        isActive: true,
        expectedVersion: null,
      })
      const results = Promise.allSettled([revocation, attempt])
      await passed
      release()
      expect((await results)[1]).toMatchObject({
        status: 'rejected',
        reason: { status: 403 },
      })
      expect(successfulChecks).toBe(1)
      expect(await db.notificationTemplate.count({ where: { key } })).toBe(0)
      expect(
        await db.auditLog.count({
          where: { actorUserId: writer.id, entityType: 'NotificationTemplate' },
        }),
      ).toBe(0)
    })

    it.each(['UserService', 'AdminService'] as const)(
      'requires team.manage for existing admin-target mutations in %s',
      async (backend) => {
        const target = await owner(),
          editor = await db.user.create({
            data: {
              name: 'User editor',
              email: `${randomUUID()}@example.test`,
              role: 'ADMIN',
              emailVerified: true,
            },
          })
        await db.adminTeamMember.create({
          data: {
            userId: editor.id,
            label: 'User editor',
            permissions: ['users.write'],
          },
        })
        const buyer = await db.user.create({
          data: {
            name: 'Ordinary buyer',
            email: `${randomUUID()}@example.test`,
          },
        })
        const userService = new UserService(
          thresholdContext,
          users,
          new EmailService({
            async send() {
              throw new Error('Unexpected email send')
            },
          }),
          access,
        )
        const adminService = new AdminService(
          thresholdContext,
          new PrismaAdminRepository(thresholdContext, db),
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          access,
        )
        const changedEmail = `${randomUUID()}@example.test`
        await expect(
          backend === 'UserService'
            ? userService.updateForAdmin(editor.id, target.id, {
                name: target.name,
                email: changedEmail,
                role: 'ADMIN',
              })
            : adminService.updateUser(editor, target.id, {
                email: changedEmail,
              }),
        ).rejects.toMatchObject({ status: 403 })
        await expect(
          backend === 'UserService'
            ? userService.updateStatus(editor.id, target.id, 'SUSPENDED')
            : adminService.updateUserStatus(editor, target.id, 'SUSPENDED'),
        ).rejects.toMatchObject({ status: 403 })
        await expect(
          backend === 'UserService'
            ? userService.deleteForAdmin(editor.id, target.id)
            : adminService.deleteUser(editor, target.id),
        ).rejects.toMatchObject({ status: 403 })
        expect(
          await db.user.findUniqueOrThrow({ where: { id: target.id } }),
        ).toMatchObject({
          email: target.email,
          name: target.name,
          role: 'ADMIN',
          status: 'ACTIVE',
        })
        const normalEmail = `${randomUUID()}@example.test`
        if (backend === 'UserService')
          await userService.updateForAdmin(editor.id, buyer.id, {
            name: 'Updated buyer',
            email: normalEmail,
            role: 'USER',
          })
        else
          await adminService.updateUser(editor, buyer.id, {
            name: 'Updated buyer',
            email: normalEmail,
          })
        expect(
          await db.user.findUniqueOrThrow({ where: { id: buyer.id } }),
        ).toMatchObject({
          name: 'Updated buyer',
          email: normalEmail,
          role: 'USER',
        })
      },
    )
    it('requires settings permissions on both notification template interfaces', async () => {
      const admin = await owner(),
        content = await db.user.create({
          data: {
            name: 'Content editor',
            email: `${randomUUID()}@example.test`,
            role: 'ADMIN',
            emailVerified: true,
          },
        })
      await db.adminTeamMember.create({
        data: {
          userId: content.id,
          label: 'Content editor',
          permissions: ['content.read', 'content.write'],
        },
      })
      const ops = operations(),
        cfg = config()
      const input: Parameters<typeof ops.saveTemplate>[2] = {
        key: `test.${randomUUID()}`,
        channel: 'EMAIL',
        locale: 'en',
        subject: 'Notice',
        body: 'Hello {{name}}',
        isActive: true,
        reason: 'Test template',
      }
      const saved = await ops.saveTemplate(admin, null, input)
      await expect(
        ops.saveTemplate(content, saved.id, {
          ...input,
          body: 'Changed',
          expectedUpdatedAt: saved.updatedAt.toISOString(),
        }),
      ).rejects.toMatchObject({ status: 403 })
      await expect(
        ops.deleteTemplate(content, saved.id, {
          expectedUpdatedAt: saved.updatedAt.toISOString(),
          reason: 'Delete template',
        }),
      ).rejects.toMatchObject({ status: 403 })
      await expect(
        ops.previewTemplate(content, {
          body: '{{name}}',
          values: { name: 'Example' },
        }),
      ).rejects.toMatchObject({ status: 403 })
      await expect(ops.listTemplates(content, {})).rejects.toMatchObject({
        status: 403,
      })
      await expect(
        cfg.saveTemplate(content, saved.id, {
          key: saved.key,
          channel: 'EMAIL',
          locale: 'en',
          subject: 'Notice',
          body: 'Changed',
          isActive: true,
          expectedVersion: saved.updatedAt.toISOString(),
        }),
      ).rejects.toMatchObject({ status: 403 })
      await expect(cfg.listTemplates(content)).rejects.toMatchObject({
        status: 403,
      })
      expect(
        await db.notificationTemplate.findUniqueOrThrow({
          where: { id: saved.id },
        }),
      ).toMatchObject({ body: 'Hello {{name}}' })
    })
    it('uses the canonical eight template variables and rejects malformed braces in both interfaces', async () => {
      const admin = await owner(),
        ops = operations(),
        cfg = config()
      const variables = [
        'name',
        'buyerName',
        'orderNumber',
        'shopName',
        'trackingNumber',
        'amount',
        'currency',
        'supportTicketNumber',
      ]
      const body = variables.map((name) => `{{${name}}}`).join(' ')
      const values = {
        name: 'Name',
        buyerName: 'Buyer',
        orderNumber: 'O-1',
        shopName: 'Store',
        trackingNumber: 'TRACK-1',
        amount: '100',
        currency: 'THB',
        supportTicketNumber: 'T-1',
      }
      const key = `test.${randomUUID()}`
      const first = await ops.saveTemplate(admin, null, {
        key,
        channel: 'EMAIL',
        locale: 'en',
        subject: 'Notice {{name}}',
        body,
        isActive: true,
        reason: 'Canonical variables',
      })
      const second = await cfg.saveTemplate(admin, null, {
        key: `${key}.config`,
        channel: 'EMAIL',
        locale: 'en',
        subject: 'Notice {{name}}',
        body,
        isActive: true,
        expectedVersion: null,
      })
      expect(first.variables).toEqual(variables)
      expect(second.variables).toEqual(variables)
      expect(
        await ops.previewTemplate(admin, {
          subject: 'Notice {{name}}',
          body,
          values,
        }),
      ).toMatchObject({
        subject: 'Notice Name',
        body: 'Name Buyer O-1 Store TRACK-1 100 THB T-1',
      })
      expect(
        await cfg.renderNotification({
          key: second.key,
          channel: 'EMAIL',
          locale: 'en',
          values,
        }),
      ).toEqual({
        subject: 'Notice Name',
        body: 'Name Buyer O-1 Store TRACK-1 100 THB T-1',
      })
      for (const invalid of ['{{unknown}}', '{{ name', 'name }}', '{{ }}']) {
        await expect(
          ops.saveTemplate(admin, null, {
            key: `${key}.bad`,
            channel: 'EMAIL',
            locale: 'en',
            subject: null,
            body: invalid,
            isActive: true,
            reason: 'Invalid syntax',
          }),
        ).rejects.toMatchObject({ status: 400 })
        await expect(
          cfg.saveTemplate(admin, null, {
            key: `${key}.bad.config`,
            channel: 'EMAIL',
            locale: 'en',
            subject: null,
            body: invalid,
            isActive: true,
            expectedVersion: null,
          }),
        ).rejects.toMatchObject({ status: 400 })
      }
      expect(
        await db.notificationTemplate.count({
          where: { key: { startsWith: `${key}.bad` } },
        }),
      ).toBe(0)
    })
    it('resolves review targets from real relations before shop review switches and maintenance', async () => {
      const f = await createFinanceFixture(db),
        cfg = config()
      const shopOrder = await db.shopOrder.findFirstOrThrow({
        where: { orderId: f.order.id },
      })
      const product = await db.productVariant.findUniqueOrThrow({
        where: { id: f.items[0]!.variantId },
      })
      const review = await db.review.create({
        data: {
          userId: f.buyer.id,
          productId: product.productId,
          orderItemId: f.items[0]!.id,
          rating: 5,
          status: 'PUBLISHED',
        },
      })
      const rating = await db.shopRating.create({
        data: {
          userId: f.buyer.id,
          shopId: f.shop.id,
          shopOrderId: shopOrder.id,
          rating: 5,
          status: 'PUBLISHED',
        },
      })
      await db.featureToggle.createMany({
        data: [
          { key: 'reviews', scope: 'GLOBAL', isEnabled: true },
          {
            key: 'reviews',
            scope: 'SHOP',
            scopeId: f.shop.id,
            isEnabled: false,
          },
        ],
      })
      const paths = [
        {
          path: '/api/shop-reviews',
          body: { shopOrderId: shopOrder.id, shopId: randomUUID() },
        },
        {
          path: '/api/review-reports',
          body: { reviewId: review.id, shopId: randomUUID() },
        },
        {
          path: '/api/review-reports',
          body: { shopRatingId: rating.id, shopId: randomUUID() },
        },
        { path: `/api/shop-reviews/${rating.id}`, body: {} },
      ]
      const app = new Elysia()
        .use(createAdminConfigGuard(cfg))
        .post('/api/shop-reviews', () => ({ admitted: true }))
        .post('/api/review-reports', () => ({ admitted: true }))
        .post('/api/shop-reviews/:ratingId', () => ({ admitted: true }))
      for (const { path, body } of paths) {
        expect(await cfg.requestShopIds(path, body)).toEqual([f.shop.id])
        const response = await app.handle(
          new Request(`http://localhost${path}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          }),
        )
        expect(response.status).toBe(503)
      }
      await db.featureToggle.updateMany({
        where: { key: 'reviews', scope: 'SHOP' },
        data: { isEnabled: true },
      })
      await db.featureToggle.create({
        data: {
          key: 'maintenance_mode',
          scope: 'SHOP',
          scopeId: f.shop.id,
          isEnabled: true,
        },
      })
      const response = await app.handle(
        new Request('http://localhost/api/review-reports', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reviewId: review.id }),
        }),
      )
      expect(response.status).toBe(503)
    })
    it.each(['coupon', 'coins', 'flash'] as const)(
      'blocks disabled %s promotion admission before checkout writes',
      async (kind) => {
        const f = await numericThresholdFixture(db),
          cfg = config()
        const cart = await db.cart.create({
          data: {
            userId: f.buyer.id,
            items: {
              create: { variantId: f.variant.id, quantity: 1, unitPrice: 100n },
            },
          },
        })
        const address = await db.address.create({
          data: {
            userId: f.buyer.id,
            recipientName: 'Buyer',
            line1: 'Test Road',
            city: 'Bangkok',
            postalCode: '10110',
            country: 'TH',
          },
        })
        const coupon = await db.coupon.create({
          data: {
            code: randomUUID().toUpperCase(),
            discountType: 'FIXED_AMOUNT',
            discountValue: 50n,
          },
        })
        await db.buyerCoinWallet.create({
          data: { userId: f.buyer.id, balance: 1n },
        })
        await db.featureToggle.createMany({
          data: [
            { key: 'promotions', scope: 'GLOBAL', isEnabled: true },
            {
              key: 'promotions',
              scope: 'SHOP',
              scopeId: f.shop.id,
              isEnabled: false,
            },
          ],
        })
        if (kind === 'flash')
          await db.flashSale.create({
            data: {
              title: 'Scoped flash',
              status: 'ACTIVE',
              startsAt: new Date(Date.now() - 10000),
              endsAt: new Date(Date.now() + 3600000),
              items: {
                create: {
                  shopId: f.shop.id,
                  productId: f.product.id,
                  variantId: f.variant.id,
                  salePrice: 50n,
                  originalPrice: 100n,
                  stockLimit: 10,
                },
              },
            },
          })
        const service = checkout((context) =>
          cfg.requireFeature('promotions', context),
        )
        const input = {
          cartId: cart.id,
          addressId: address.id,
          paymentMethod: 'card',
          ...(kind === 'coupon'
            ? { couponCode: coupon.code }
            : kind === 'coins'
              ? { coinsToUse: 1 }
              : {}),
        }
        await expect(
          service.createCheckout(f.buyer, input),
        ).rejects.toMatchObject({ status: 503, code: 'FEATURE_DISABLED' })
        expect(await db.order.count({ where: { userId: f.buyer.id } })).toBe(0)
        expect(await db.checkout.count({ where: { userId: f.buyer.id } })).toBe(
          0,
        )
        expect(
          await db.couponRedemption.count({ where: { couponId: coupon.id } }),
        ).toBe(0)
        expect(
          await db.flashSaleReservation.count({
            where: { userId: f.buyer.id },
          }),
        ).toBe(0)
        expect(
          await db.inventoryReservation.count({
            where: { inventory: { variantId: f.variant.id } },
          }),
        ).toBe(0)
        expect(
          await db.buyerCoinWallet.findUniqueOrThrow({
            where: { userId: f.buyer.id },
          }),
        ).toMatchObject({ balance: 1n, pendingBalance: 0n })
        expect(
          await db.inventory.findUniqueOrThrow({
            where: { variantId: f.variant.id },
          }),
        ).toMatchObject({ quantityOnHand: 3, quantityReserved: 2 })
      },
    )

    it.each(['demotion', 'suspension', 'delete'] as const)(
      'prevents removing the final eligible owner by %s',
      async (action) => {
        const user = await owner()
        const attempt =
          action === 'delete'
            ? users.delete(user.id)
            : users.updateUser(
                user.id,
                action === 'demotion'
                  ? { role: 'USER' }
                  : { status: 'SUSPENDED' },
              )
        await expect(attempt).rejects.toMatchObject({ status: 409 })
        expect(
          await db.adminTeamMember.count({
            where: {
              isOwner: true,
              isActive: true,
              user: { role: 'ADMIN', status: 'ACTIVE', emailVerified: true },
            },
          }),
        ).toBe(1)
      },
    )
    it.each(['demotion', 'suspension', 'delete'] as const)(
      'serializes concurrent owner %s and leaves one eligible owner',
      async (action) => {
        const members = await Promise.all([owner(), owner()])
        const results = await Promise.allSettled(
          members.map((user) =>
            action === 'delete'
              ? users.delete(user.id)
              : users.updateUser(
                  user.id,
                  action === 'demotion'
                    ? { role: 'USER' }
                    : { status: 'SUSPENDED' },
                ),
          ),
        )
        expect(
          results.filter((result) => result.status === 'fulfilled'),
        ).toHaveLength(1)
        expect(
          results.find((result) => result.status === 'rejected'),
        ).toMatchObject({ reason: { status: 409 } })
        expect(
          await db.adminTeamMember.count({
            where: {
              isOwner: true,
              isActive: true,
              user: { role: 'ADMIN', status: 'ACTIVE', emailVerified: true },
            },
          }),
        ).toBe(1)
      },
    )
    it('rechecks catalog permission under the transaction lock after revocation', async () => {
      const admin = await owner(),
        f = await numericThresholdFixture(db)
      const pending = await db.product.update({
        where: { id: f.product.id },
        data: { status: 'PENDING_REVIEW' },
      })
      const result = await revokeBeforeWrite(admin.id, () =>
        new CatalogApprovalRepository(db, access).review(
          admin,
          pending.id,
          'APPROVE',
          'Verified product',
          pending.updatedAt,
        ),
      )
      expect(result).toMatchObject({
        status: 'rejected',
        reason: { status: 403 },
      })
      expect(
        await db.product.findUniqueOrThrow({ where: { id: pending.id } }),
      ).toMatchObject({ status: 'PENDING_REVIEW' })
      expect(
        await db.auditLog.count({
          where: { entityType: 'Product', entityId: pending.id },
        }),
      ).toBe(0)
    })
    it('rechecks refund completion permission under the transaction lock after revocation', async () => {
      const f = await createFinanceFixture(db, true)
      await membership(f.admin)
      await membership(f.secondAdmin)
      const repo = new PrismaRefundRepository(thresholdContext, db, access)
      const refund = await repo.createPlannedRefund(f.order.id, {
        items: [{ orderItemId: f.items[0]!.id, quantity: 1 }],
        shipping: [],
      })
      await db.refund.update({
        where: { id: refund.id },
        data: { status: 'PROCESSING', processingById: f.admin.id },
      })
      const result = await revokeBeforeWrite(f.secondAdmin.id, () =>
        repo.completeRefundSuccess(refund.id, 'PROCESSING', {
          completedById: f.secondAdmin.id,
          externalReference: 'BOUNDARY-REFUND',
        }),
      )
      expect(result).toMatchObject({
        status: 'rejected',
        reason: { status: 403 },
      })
      expect(
        await db.refund.findUniqueOrThrow({ where: { id: refund.id } }),
      ).toMatchObject({ status: 'PROCESSING', completedById: null })
      expect(
        await db.walletLedgerEntry.count({ where: { refundId: refund.id } }),
      ).toBe(0)
    })
    it('rechecks payout completion permission under the transaction lock after revocation', async () => {
      const f = await createFinanceFixture(db)
      await membership(f.admin)
      await membership(f.secondAdmin)
      const service = new PayoutService(
        thresholdContext,
        new PrismaPayoutRepository(thresholdContext, db),
        undefined,
        undefined,
        undefined,
        access,
      )
      const payout = await service.createSellerPayout(f.seller, {
        amount: 1000,
      })
      await service.approveAdminPayout(f.admin, payout.id)
      const result = await revokeBeforeWrite(f.secondAdmin.id, () =>
        service.markAdminPayoutPaid(f.secondAdmin, payout.id, {
          externalReference: 'BOUNDARY-PAYOUT',
        }),
      )
      expect(result).toMatchObject({
        status: 'rejected',
        reason: { status: 403 },
      })
      expect(
        await db.sellerPayout.findUniqueOrThrow({ where: { id: payout.id } }),
      ).toMatchObject({ status: 'approved', paidById: null, paidAt: null })
      expect(
        await db.walletLedgerEntry.count({
          where: { payoutId: payout.id, type: 'payout_paid' },
        }),
      ).toBe(0)
    })
    it('does not publish a seller edit made while approval was reviewing the prior submission', async () => {
      const admin = await owner(),
        f = await numericThresholdFixture(db)
      const pending = await db.product.update({
        where: { id: f.product.id },
        data: { status: 'PENDING_REVIEW' },
      })
      let read!: () => void, release!: () => void
      const readSubmission = new Promise<void>((resolve) => {
        read = resolve
      })
      const hold = new Promise<void>((resolve) => {
        release = resolve
      })
      const instrumented = db.$extends({
        query: {
          product: {
            async findUnique({ args, query }) {
              const value = await query(args)
              if (args.where.id === pending.id) {
                read()
                await hold
              }
              return value
            },
          },
        },
      })
      const approval = new CatalogApprovalRepository(
        instrumented as unknown as PrismaClient,
        access,
      ).review(
        admin,
        pending.id,
        'APPROVE',
        'Approve original submission',
        pending.updatedAt,
      )
      const approved = Promise.allSettled([approval])
      await readSubmission
      const editing = new PrismaCatalogRepository(
        thresholdContext,
        db,
      ).updateProduct(pending.id, {
        title: 'Changed after review snapshot',
        status: 'PENDING_REVIEW',
      })
      await Promise.race([
        editing,
        new Promise((resolve) => setTimeout(resolve, 150)),
      ])
      release()
      await approved
      await editing
      expect(
        await db.product.findUniqueOrThrow({ where: { id: pending.id } }),
      ).toMatchObject({
        title: 'Changed after review snapshot',
        status: 'PENDING_REVIEW',
      })
    })
    it.each(['variant', 'image'] as const)(
      'invalidates a pending submission when its %s is edited',
      async (child) => {
        const admin = await owner(),
          f = await numericThresholdFixture(db)
        const pending = await db.product.update({
          where: { id: f.product.id },
          data: { status: 'PENDING_REVIEW' },
        })
        const repo = new PrismaCatalogRepository(thresholdContext, db)
        const service = new CatalogService(
          thresholdContext,
          repo,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          async () => true,
        )
        if (child === 'variant')
          await service.updateVariant(f.owner, f.product.id, f.variant.id, {
            title: 'New variant content',
          })
        else
          await service.createProductImage(f.owner, f.product.id, {
            url: 'https://cdn.example.test/new-review-image.jpg',
          })
        await expect(
          new CatalogApprovalRepository(db, access).review(
            admin,
            pending.id,
            'APPROVE',
            'Approve old submission',
            pending.updatedAt,
          ),
        ).rejects.toMatchObject({
          code: 'PRODUCT_PUBLISH_STATUS_INVALID',
          status: 409,
        })
        expect(
          await db.product.findUniqueOrThrow({ where: { id: pending.id } }),
        ).toMatchObject({ status: 'PENDING_REVIEW' })
      },
    )
    it.each([
      ['variant', true],
      ['image', true],
      ['variant', false],
      ['image', false],
    ] as const)(
      'resubmits active %s edits only when preapproval is %s',
      async (child, enabled) => {
        const f = await numericThresholdFixture(db)
        const policy = async () => enabled
        const repo = new PrismaCatalogRepository(thresholdContext, db, policy)
        const service = new CatalogService(
          thresholdContext,
          repo,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          policy,
        )
        if (child === 'variant')
          await service.updateVariant(f.owner, f.product.id, f.variant.id, {
            title: 'Changed live variant',
          })
        else
          await service.createProductImage(f.owner, f.product.id, {
            url: 'https://cdn.example.test/new-live-image.jpg',
          })
        const updated = await db.product.findUniqueOrThrow({
          where: { id: f.product.id },
        })
        expect(updated.status).toBe(enabled ? 'PENDING_REVIEW' : 'ACTIVE')
        expect(updated.updatedAt.getTime()).toBeGreaterThan(
          f.product.updatedAt.getTime(),
        )
      },
    )
    it('counts dispatch delay using each sale SLA and shipment creation time', async () => {
      const repo = new PrismaAdminRepository(thresholdContext, db),
        admin = await owner()
      const before = (await repo.getDashboardCounts()).exceptions
        .delayedShipments
      const cases = []
      for (const { sla, age } of [
        { sla: 24, age: 25 },
        { sla: 48, age: 25 },
        { sla: 24, age: 1 },
      ]) {
        const f = await createFinanceFixture(db, true)
        await db.order.update({
          where: { id: f.order.id },
          data: { createdAt: new Date(Date.now() - 90 * 24 * 3600000) },
        })
        await db.shipment.updateMany({
          where: { orderId: f.order.id },
          data: {
            status: 'PENDING_PACK',
            shippedAt: null,
            deliveredAt: null,
            createdAt: new Date(Date.now() - age * 3600000),
          },
        })
        await db.shopSaleSnapshot.updateMany({
          where: { shopOrder: { orderId: f.order.id } },
          data: { dispatchSlaHours: sla },
        })
        await db.shopOperationPolicy.create({
          data: {
            shopId: f.shop.id,
            updatedById: admin.id,
            dispatchSlaHours: 99,
          },
        })
        cases.push(f)
      }
      expect(
        (await repo.getDashboardCounts()).exceptions.delayedShipments,
      ).toBe(before + 1)
      const first = await repo.listOrders(
        { shipmentState: 'DELAYED', shopId: cases[0]!.shop.id },
        { page: 1, limit: 1 },
      )
      expect(first.total).toBe(1)
      expect(first.items.map((order) => order.id)).toEqual([cases[0]!.order.id])
      expect(
        (
          await repo.listOrders(
            { shipmentState: 'DELAYED', shopId: cases[0]!.shop.id },
            { page: 2, limit: 1 },
          )
        ).items,
      ).toEqual([])
      for (const f of cases.slice(1))
        expect(
          (
            await repo.listOrders(
              { shipmentState: 'DELAYED', shopId: f.shop.id },
              { page: 1, limit: 20 },
            )
          ).total,
        ).toBe(0)
    })
    it('restricts private support evidence to participants and hides internal evidence from them', async () => {
      const f = await numericThresholdFixture(db),
        stranger = await numericThresholdFixture(db),
        admin = await owner()
      const ticket = await support().create(f.buyer.id, {
        subject: 'Evidence test',
        body: 'Review attached evidence',
      })
      const upload = await db.upload.create({
        data: {
          userId: f.buyer.id,
          usage: 'SUPPORT_ATTACHMENT',
          status: 'COMPLETED',
          fileName: 'proof.pdf',
          contentType: 'application/pdf',
          fileSize: 10,
          key: `private/support_attachment/${f.buyer.id}/${randomUUID()}.pdf`,
        },
      })
      await support().reply({ kind: 'buyer', userId: f.buyer.id }, ticket.id, {
        body: 'Proof',
        attachmentIds: [upload.id],
      })
      const storage = new LocalUploadStorage({
        rootDir: path.resolve('.audit/boundaries-public'),
        privateRootDir: path.resolve('.audit/boundaries-private'),
        signingSecret: 'boundary-storage-test-secret',
      })
      const service = new UploadService(
        thresholdContext,
        new PrismaUploadRepository(thresholdContext, db),
        storage,
        access,
      )
      expect(
        (await service.getUpload(f.buyer, upload.id)).publicUrl,
      ).toBeUndefined()
      expect(
        await service.getSupportAttachmentDownload(
          f.buyer,
          ticket.id,
          upload.id,
        ),
      ).toContain('/api/uploads/local-get?')
      await expect(
        service.getSupportAttachmentDownload(
          stranger.buyer,
          ticket.id,
          upload.id,
        ),
      ).rejects.toMatchObject({ status: 404 })
      await expect(
        support().reply(
          { kind: 'buyer', userId: stranger.buyer.id },
          ticket.id,
          { body: 'Stolen', attachmentIds: [upload.id] },
        ),
      ).rejects.toMatchObject({ status: 404 })
      const internal = await db.upload.create({
        data: {
          userId: admin.id,
          usage: 'SUPPORT_ATTACHMENT',
          status: 'COMPLETED',
          fileName: 'internal.pdf',
          contentType: 'application/pdf',
          fileSize: 10,
          key: `private/support_attachment/${admin.id}/${randomUUID()}.pdf`,
        },
      })
      await support().reply(
        { kind: 'admin', userId: admin.id },
        ticket.id,
        { body: 'Private note', attachmentIds: [internal.id] },
        true,
      )
      await expect(
        service.getSupportAttachmentDownload(f.buyer, ticket.id, internal.id),
      ).rejects.toMatchObject({ status: 404 })
      expect(
        await service.getSupportAttachmentDownload(
          admin,
          ticket.id,
          internal.id,
        ),
      ).toContain('/api/uploads/local-get?')
      expect(
        (
          await support().detail(
            { kind: 'buyer', userId: f.buyer.id },
            ticket.id,
          )
        ).messages.items.some((row) => row.isInternal),
      ).toBe(false)
      await db.adminTeamMember.update({
        where: { userId: admin.id },
        data: { isActive: false },
      })
      await expect(
        service.getSupportAttachmentDownload(admin, ticket.id, internal.id),
      ).rejects.toMatchObject({ status: 403 })
    })
    async function compensation() {
      const f = await createFinanceFixture(db, true)
      await membership(f.admin)
      await membership(f.secondAdmin)
      const returned = await db.returnRequest.create({
        data: {
          orderId: f.order.id,
          shopId: f.shop.id,
          userId: f.buyer.id,
          status: 'REJECTED',
          items: { create: { orderItemId: f.items[0]!.id, quantity: 1 } },
        },
      })
      const service = support(),
        ticket = await service.appeal(f.buyer.id, {
          returnRequestId: returned.id,
          subject: 'Appeal',
          body: 'Review the rejected return',
        })
      await service.decide(f.admin.id, ticket.id, {
        status: 'RESOLVED_BUYER',
        decision: 'Buyer appeal upheld',
      })
      return {
        f,
        returned,
        service,
        ticket,
        repo: new PrismaRefundRepository(thresholdContext, db, access),
      }
    }
    it('rejects pending, wrong-order and wrong-item compensation refunds', async () => {
      const c = await compensation()
      const correct = await c.repo.createPlannedRefund(c.f.order.id, {
        items: [{ orderItemId: c.f.items[0]!.id, quantity: 1 }],
        shipping: [],
      })
      await expect(
        c.service.linkCompensation(c.f.admin.id, c.ticket.id, correct.id),
      ).rejects.toMatchObject({ code: 'INVALID_COMPENSATION_REFUND' })
      const wrongItem = await c.repo.createPlannedRefund(c.f.order.id, {
        items: [{ orderItemId: c.f.items[1]!.id, quantity: 1 }],
        shipping: [],
      })
      await db.refund.update({
        where: { id: wrongItem.id },
        data: { status: 'PROCESSING', processingById: c.f.admin.id },
      })
      await expect(
        c.service.linkCompensation(c.f.admin.id, c.ticket.id, wrongItem.id),
      ).rejects.toMatchObject({ code: 'INVALID_COMPENSATION_REFUND' })
      const other = await createFinanceFixture(db, true),
        wrongOrder = await c.repo.createPlannedRefund(other.order.id, {
          items: [{ orderItemId: other.items[0]!.id, quantity: 1 }],
          shipping: [],
        })
      await db.refund.update({
        where: { id: wrongOrder.id },
        data: { status: 'PROCESSING', processingById: c.f.admin.id },
      })
      await expect(
        c.service.linkCompensation(c.f.admin.id, c.ticket.id, wrongOrder.id),
      ).rejects.toMatchObject({ code: 'INVALID_COMPENSATION_REFUND' })
      expect(
        await db.disputeCase.findUniqueOrThrow({
          where: { returnRequestId: c.returned.id },
        }),
      ).toMatchObject({ status: 'RESOLVED_BUYER', refundId: null })
    })
    it('keeps a processing compensation unresolved until success and replays once', async () => {
      const c = await compensation(),
        refund = await c.repo.createPlannedRefund(c.f.order.id, {
          items: [{ orderItemId: c.f.items[0]!.id, quantity: 1 }],
          shipping: [],
        })
      await db.refund.update({
        where: { id: refund.id },
        data: { status: 'PROCESSING', processingById: c.f.admin.id },
      })
      await c.service.linkCompensation(c.f.admin.id, c.ticket.id, refund.id)
      expect(
        await db.disputeCase.findUniqueOrThrow({
          where: { returnRequestId: c.returned.id },
        }),
      ).toMatchObject({
        status: 'RESOLVED_BUYER',
        compensation: 3200n,
        refundId: refund.id,
      })
      await c.service.linkCompensation(c.f.admin.id, c.ticket.id, refund.id)
      expect(
        await db.auditLog.count({
          where: {
            entityType: 'DisputeCase',
            entityId: c.ticket.disputes[0]!.id,
          },
        }),
      ).toBe(1)
      expect(
        await c.repo.completeRefundSuccess(refund.id, 'PROCESSING', {
          completedById: c.f.secondAdmin.id,
          externalReference: 'BOUNDARY-COMPENSATED',
        }),
      ).toMatchObject({ status: 'SUCCESS' })
      expect(
        await db.disputeCase.findUniqueOrThrow({
          where: { returnRequestId: c.returned.id },
        }),
      ).toMatchObject({ status: 'COMPENSATED', compensation: 3200n })
      expect(
        await c.repo.completeRefundSuccess(refund.id, 'PROCESSING', {
          completedById: c.f.secondAdmin.id,
          externalReference: 'BOUNDARY-COMPENSATED',
        }),
      ).toBeNull()
      expect(
        await db.walletLedgerEntry.count({
          where: { refundId: refund.id, type: 'refund_adjustment' },
        }),
      ).toBe(1)
    })
    it('replaces only a failed linked compensation and completes the new frozen refund once', async () => {
      const c = await compensation(),
        item = c.f.items[0]!,
        otherItem = c.f.items[1]!
      const old = await c.repo.createPlannedRefund(c.f.order.id, {
        items: [{ orderItemId: item.id, quantity: 1 }],
        shipping: [],
      })
      await db.refund.update({
        where: { id: old.id },
        data: { status: 'PROCESSING', processingById: c.f.admin.id },
      })
      await c.service.linkCompensation(c.f.admin.id, c.ticket.id, old.id)
      const competing = await c.repo.createPlannedRefund(c.f.order.id, {
        items: [{ orderItemId: otherItem.id, quantity: 1 }],
        shipping: [],
      })
      await db.refund.update({
        where: { id: competing.id },
        data: { status: 'PROCESSING', processingById: c.f.admin.id },
      })
      await expect(
        c.service.linkCompensation(c.f.admin.id, c.ticket.id, competing.id),
      ).rejects.toMatchObject({ code: 'COMPENSATION_ALREADY_LINKED' })
      const admin = new PrismaAdminRepository(thresholdContext, db)
      await admin.updateRefundStatus(competing.id, 'PROCESSING', {
        status: 'FAILED',
      })
      await admin.updateRefundStatus(old.id, 'PROCESSING', { status: 'FAILED' })
      const replacement = await c.repo.createPlannedRefund(c.f.order.id, {
        items: [{ orderItemId: item.id, quantity: 1 }],
        shipping: [],
      })
      await db.refund.update({
        where: { id: replacement.id },
        data: { status: 'PROCESSING', processingById: c.f.admin.id },
      })
      await c.service.linkCompensation(
        c.f.admin.id,
        c.ticket.id,
        replacement.id,
      )
      const dispute = await db.disputeCase.findUniqueOrThrow({
        where: { returnRequestId: c.returned.id },
      })
      expect(dispute).toMatchObject({
        status: 'RESOLVED_BUYER',
        refundId: replacement.id,
        compensation: 3200n,
      })
      const audits = await db.auditLog.findMany({
        where: { entityType: 'DisputeCase', entityId: dispute.id },
      })
      expect(audits).toHaveLength(2)
      expect(audits).toContainEqual(
        expect.objectContaining({
          before: expect.objectContaining({ refundId: old.id }),
          after: expect.objectContaining({ refundId: replacement.id }),
        }),
      )
      expect(
        await c.repo.completeRefundSuccess(old.id, 'PROCESSING', {
          completedById: c.f.secondAdmin.id,
          externalReference: 'FAILED-REFUND',
        }),
      ).toBeNull()
      expect(
        await c.repo.completeRefundSuccess(replacement.id, 'PROCESSING', {
          completedById: c.f.secondAdmin.id,
          externalReference: 'REPLACEMENT-REFUND',
        }),
      ).toMatchObject({ status: 'SUCCESS' })
      expect(
        await db.disputeCase.findUniqueOrThrow({ where: { id: dispute.id } }),
      ).toMatchObject({ status: 'COMPENSATED', refundId: replacement.id })
      await c.service.linkCompensation(
        c.f.admin.id,
        c.ticket.id,
        replacement.id,
      )
      expect(
        await db.auditLog.count({
          where: { entityType: 'DisputeCase', entityId: dispute.id },
        }),
      ).toBe(2)
      expect(
        await db.walletLedgerEntry.count({
          where: { refundId: replacement.id, type: 'refund_adjustment' },
        }),
      ).toBe(1)
      expect(
        await db.walletLedgerEntry.count({ where: { refundId: old.id } }),
      ).toBe(0)
    })
    it('freezes distinct shop shipping, carrier, SLA and commission at checkout', async () => {
      const admin = await owner(),
        first = await numericThresholdFixture(db),
        second = await numericThresholdFixture(db)
      const providers = [],
        rules = []
      for (const [index, f] of [first, second].entries()) {
        await db.productVariant.update({
          where: { id: f.variant.id },
          data: {
            weightGrams: 1000,
            lengthMm: 100,
            widthMm: 100,
            heightMm: 100,
          },
        })
        await db.shopOperationPolicy.create({
          data: {
            shopId: f.shop.id,
            updatedById: admin.id,
            commissionBps: index === 0 ? 1250 : 2500,
            dispatchSlaHours: index === 0 ? 24 : 12,
            deliverySlaHours: index === 0 ? 48 : 36,
            shippingRatesEnabled: true,
          },
        })
        const provider = await db.shippingProvider.create({
          data: {
            shopId: f.shop.id,
            code: randomUUID(),
            name: `Carrier ${index}`,
          },
        })
        const rule = await db.shippingRateRule.create({
          data: {
            providerId: provider.id,
            shopId: f.shop.id,
            name: 'Thai rate',
            baseFee: index === 0 ? 100n : 200n,
            perKgFee: index === 0 ? 50n : 100n,
          },
        })
        providers.push(provider)
        rules.push(rule)
      }
      const cart = await db.cart.create({
        data: {
          userId: first.buyer.id,
          items: {
            create: [first, second].map((f) => ({
              variantId: f.variant.id,
              quantity: 1,
              unitPrice: 100n,
            })),
          },
        },
      })
      const address = await db.address.create({
        data: {
          userId: first.buyer.id,
          recipientName: 'Buyer',
          line1: 'Test Road',
          city: 'Bangkok',
          postalCode: '10110',
          country: 'TH',
        },
      })
      const service = checkout(),
        input = {
          cartId: cart.id,
          addressId: address.id,
          paymentMethod: 'card',
        }
      expect(
        (await service.quoteCheckout(first.buyer, input)).shippingTotal,
      ).toBe(450)
      const purchased = await service.createCheckout(first.buyer, input)
      const sales = await db.shopSaleSnapshot.findMany({
        where: { shopOrder: { orderId: purchased.orderId } },
        include: { shopOrder: true },
      })
      expect(
        sales.find((sale) => sale.shopOrder.shopId === first.shop.id),
      ).toMatchObject({
        commissionBps: 1250,
        originalCommission: 12n,
        originalShipping: 150n,
        shippingProviderId: providers[0]!.id,
        shippingRateRuleId: rules[0]!.id,
        dispatchSlaHours: 24,
        deliverySlaHours: 48,
      })
      expect(
        sales.find((sale) => sale.shopOrder.shopId === second.shop.id),
      ).toMatchObject({
        commissionBps: 2500,
        originalCommission: 25n,
        originalShipping: 300n,
        shippingProviderId: providers[1]!.id,
        dispatchSlaHours: 12,
        deliverySlaHours: 36,
      })
      await db.shopOperationPolicy.updateMany({
        where: { shopId: { in: [first.shop.id, second.shop.id] } },
        data: { commissionBps: 9900, dispatchSlaHours: 99 },
      })
      await db.shippingRateRule.updateMany({
        where: { id: { in: rules.map((rule) => rule.id) } },
        data: { baseFee: 99999n, version: { increment: 1 } },
      })
      expect(
        await db.shopSaleSnapshot.findMany({
          where: { shopOrder: { orderId: purchased.orderId } },
          include: { shopOrder: true },
        }),
      ).toEqual(sales)
    })
    it('applies product-scoped coupons only to eligible merchandise', async () => {
      const first = await numericThresholdFixture(db),
        second = await numericThresholdFixture(db)
      const cart = await db.cart.create({
        data: {
          userId: first.buyer.id,
          items: {
            create: [first, second].map((f) => ({
              variantId: f.variant.id,
              quantity: 1,
              unitPrice: 100n,
            })),
          },
        },
      })
      const coupon = await db.coupon.create({
        data: {
          code: randomUUID().toUpperCase(),
          discountType: 'PERCENT',
          discountPercentBps: 5000,
        },
      })
      await db.systemSetting.create({
        data: {
          key: `coupon.targets.${coupon.id}`,
          value: {
            productIds: [first.product.id],
            categoryIds: [],
            version: 1,
          },
        },
      })
      const address = await db.address.create({
        data: {
          userId: first.buyer.id,
          recipientName: 'Buyer',
          line1: 'Test Road',
          city: 'Bangkok',
          postalCode: '10110',
          country: 'TH',
        },
      })
      const service = checkout(),
        input = {
          cartId: cart.id,
          addressId: address.id,
          couponCode: coupon.code,
          paymentMethod: 'card',
        }
      expect(
        (await service.quoteCheckout(first.buyer, input)).discountTotal,
      ).toBe(50)
      const purchase = await service.createCheckout(first.buyer, input)
      const items = await db.orderItem.findMany({
        where: { orderId: purchase.orderId },
        include: { saleSnapshot: true },
      })
      expect(
        items.find((item) => item.variantId === first.variant.id)?.saleSnapshot,
      ).toMatchObject({ platformCouponDiscount: 50n, buyerMerchandise: 50n })
      expect(
        items.find((item) => item.variantId === second.variant.id)
          ?.saleSnapshot,
      ).toMatchObject({ platformCouponDiscount: 0n, buyerMerchandise: 100n })
    })
    it('allocates a product-scoped shop coupon followed by a category-scoped platform coupon', async () => {
      const first = await numericThresholdFixture(db),
        second = await numericThresholdFixture(db)
      const cart = await db.cart.create({
        data: {
          userId: first.buyer.id,
          items: {
            create: [first, second].map((f) => ({
              variantId: f.variant.id,
              quantity: 1,
              unitPrice: 100n,
            })),
          },
        },
      })
      const address = await db.address.create({
        data: {
          userId: first.buyer.id,
          recipientName: 'Buyer',
          line1: 'Test Road',
          city: 'Bangkok',
          postalCode: '10110',
          country: 'TH',
        },
      })
      const shop = await db.coupon.create({
        data: {
          shopId: first.shop.id,
          code: randomUUID().toUpperCase(),
          discountType: 'PERCENT',
          discountPercentBps: 2500,
        },
      })
      const platform = await db.coupon.create({
        data: {
          code: randomUUID().toUpperCase(),
          discountType: 'PERCENT',
          discountPercentBps: 5000,
        },
      })
      await db.systemSetting.createMany({
        data: [
          {
            key: `coupon.targets.${shop.id}`,
            value: {
              productIds: [first.product.id],
              categoryIds: [],
              version: 1,
            },
          },
          {
            key: `coupon.targets.${platform.id}`,
            value: {
              productIds: [],
              categoryIds: [second.category.id],
              version: 1,
            },
          },
        ],
      })
      const service = checkout(),
        input = {
          cartId: cart.id,
          addressId: address.id,
          shopCouponCode: shop.code,
          platformCouponCode: platform.code,
          paymentMethod: 'card',
        }
      const quote = await service.quoteCheckout(first.buyer, input)
      expect(quote).toMatchObject({
        subtotal: 200,
        discountTotal: 75,
        grandTotal: 125,
      })
      const purchase = await service.createCheckout(first.buyer, {
        ...input,
        acceptedQuoteFingerprint: quote.quoteFingerprint,
        acceptedTaxPolicyRevision: quote.taxPolicyRevision,
      })
      const items = await db.orderItem.findMany({
        where: { orderId: purchase.orderId },
        include: { saleSnapshot: true },
      })
      expect(
        items.find((item) => item.variantId === first.variant.id)?.saleSnapshot,
      ).toMatchObject({
        sellerCouponDiscount: 25n,
        platformCouponDiscount: 0n,
        buyerMerchandise: 75n,
      })
      expect(
        items.find((item) => item.variantId === second.variant.id)
          ?.saleSnapshot,
      ).toMatchObject({
        sellerCouponDiscount: 0n,
        platformCouponDiscount: 50n,
        buyerMerchandise: 50n,
      })
    })
    it('does not apply or consume a scoped coupon with no eligible merchandise', async () => {
      const first = await numericThresholdFixture(db),
        second = await numericThresholdFixture(db)
      const cart = await db.cart.create({
        data: {
          userId: first.buyer.id,
          items: {
            create: {
              variantId: second.variant.id,
              quantity: 1,
              unitPrice: 100n,
            },
          },
        },
      })
      const address = await db.address.create({
        data: {
          userId: first.buyer.id,
          recipientName: 'Buyer',
          line1: 'Test Road',
          city: 'Bangkok',
          postalCode: '10110',
          country: 'TH',
        },
      })
      const coupon = await db.coupon.create({
        data: {
          code: randomUUID().toUpperCase(),
          discountType: 'FIXED_AMOUNT',
          discountValue: 50n,
        },
      })
      await db.systemSetting.create({
        data: {
          key: `coupon.targets.${coupon.id}`,
          value: {
            productIds: [first.product.id],
            categoryIds: [],
            version: 1,
          },
        },
      })
      const input = {
          cartId: cart.id,
          addressId: address.id,
          couponCode: coupon.code,
          paymentMethod: 'card',
        },
        service = checkout()
      expect(
        (await service.quoteCheckout(first.buyer, input)).discountTotal,
      ).toBe(0)
      await expect(
        service.createCheckout(first.buyer, input),
      ).rejects.toMatchObject({ code: 'INVALID_COUPON' })
      expect(
        await db.couponRedemption.count({ where: { couponId: coupon.id } }),
      ).toBe(0)
      expect(await db.order.count({ where: { userId: first.buyer.id } })).toBe(
        0,
      )
    })
  },
)
