import { randomUUID } from 'node:crypto'
import { Elysia } from 'elysia'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaClient, type User } from '#generated/client/client.ts'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import {
  thresholdContext,
  numericThresholdFixture,
  thresholdSale,
} from '#server/test-support/numeric-threshold.fixture.ts'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { AdminAccessRepository } from '#server/modules/admin-access/admin-access.repository.ts'
import { AdminAccessService } from '#server/modules/admin-access/admin-access.service.ts'
import { AdminDirectoryRepository } from './admin-directory.repository.ts'
import { AdminDirectoryService } from './admin-directory.service.ts'
import { createAdminDirectoryRoutes } from './admin-directory.routes.ts'
import { CouponTargetsRepository } from '#server/modules/promotion/coupon-targets.repository.ts'
import { CouponTargetsService } from '#server/modules/promotion/coupon-targets.service.ts'
import { createCouponTargetsRoutes } from '#server/modules/promotion/coupon-targets.routes.ts'
import { couponTargetEligible } from '#server/modules/promotion/coupon-targets.schemas.ts'
import { PrismaReviewRepository } from '#server/modules/review/review.repository.ts'
import { ReviewService } from '#server/modules/review/review.service.ts'
import { createReviewRoutes } from '#server/modules/review/review.routes.ts'
import { PrismaSupportRepository } from '#server/modules/support/support.repository.ts'
import { SupportService } from '#server/modules/support/support.service.ts'

vi.mock('#server/modules/auth/auth.ts', () => ({
  auth: { handler: () => new Response(null, { status: 404 }) },
  getSocialProviderAvailability: () => ({}),
}))
vi.mock('#server/modules/auth/auth.context.ts', () => ({
  getAuthContext: vi.fn(),
}))

describe.skipIf(!process.env.ADMIN_DIRECTORY_TEST_DATABASE_URL)(
  'admin completion on PostgreSQL',
  () => {
    let db: PrismaClient, app: Pick<Elysia, 'handle'>, admin: User, reader: User
    let f: Awaited<ReturnType<typeof numericThresholdFixture>>,
      sale: Awaited<ReturnType<typeof thresholdSale>>
    let targets: CouponTargetsRepository,
      reviewId: string,
      ratingId: string,
      couponId: string
    const identities = new Map<string, User>()
    beforeAll(async () => {
      const url = process.env.ADMIN_DIRECTORY_TEST_DATABASE_URL!
      const parsed = new URL(url)
      const local = ['127.0.0.1', 'localhost'].includes(parsed.hostname)
      const dedicated =
        (parsed.port === '57439' &&
          parsed.pathname === '/full_admin_directory_test') ||
        (parsed.port !== '5432' &&
          parsed.pathname === '/marketplace_test_directory')
      if (!local || !dedicated)
        throw new Error('Dedicated local directory test database required')
      db = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url }),
      })
      f = await numericThresholdFixture(db)
      f.buyer = await db.user.update({
        where: { id: f.buyer.id },
        data: { emailVerified: true },
      })
      f.owner = await db.user.update({
        where: { id: f.owner.id },
        data: { emailVerified: true },
      })
      sale = await thresholdSale(db, f)
      admin = await db.user.create({
        data: {
          name: 'Directory admin',
          email: `${randomUUID()}@example.test`,
          role: 'ADMIN',
          emailVerified: true,
        },
      })
      reader = await db.user.create({
        data: {
          name: 'Directory reader',
          email: `${randomUUID()}@example.test`,
          role: 'ADMIN',
          emailVerified: true,
        },
      })
      await db.adminTeamMember.create({
        data: { userId: admin.id, label: 'Owner', isOwner: true },
      })
      await db.adminTeamMember.create({
        data: {
          userId: reader.id,
          label: 'Reader',
          permissions: ['users.read', 'shops.read', 'marketing.read'],
        },
      })
      for (const user of [f.buyer, f.owner, admin, reader])
        identities.set(user.id, user)
      vi.mocked(getAuthContext).mockImplementation(async (headers) => {
        const user = identities.get(headers.get('x-test-user') ?? '')
        return user ? { user, session: { id: randomUUID() } } : null
      })
      await db.address.createMany({
        data: Array.from({ length: 3 }, (_, index) => ({
          userId: f.buyer.id,
          recipientName: `Buyer ${index}`,
          line1: `Road ${index}`,
          city: 'Bangkok',
          postalCode: '10110',
          country: 'TH',
        })),
      })
      await db.buyerCoinWallet.create({
        data: {
          userId: f.buyer.id,
          balance: 9007199254740993n,
          lifetimeEarned: 9007199254740995n,
        },
      })
      await db.sellerProfile.update({
        where: { userId: f.owner.id },
        data: {
          nationalIdEncrypted: 'secret',
          bankAccountNumberEncrypted: 'secret-account',
        },
      })
      const review = await db.review.create({
        data: {
          userId: f.buyer.id,
          productId: f.product.id,
          orderItemId: sale.item.id,
          rating: 4,
          status: 'PUBLISHED',
        },
      })
      reviewId = review.id
      const rating = await db.shopRating.create({
        data: {
          userId: f.buyer.id,
          shopId: f.shop.id,
          shopOrderId: sale.shopOrder.id,
          rating: 5,
          status: 'PUBLISHED',
        },
      })
      ratingId = rating.id
      couponId = (
        await db.coupon.create({
          data: {
            shopId: f.shop.id,
            code: randomUUID(),
            discountType: 'PERCENT',
            discountPercentBps: 1000,
          },
        })
      ).id
      const access = new AdminAccessService(new AdminAccessRepository(db))
      targets = new CouponTargetsRepository(db)
      const reviewService = new ReviewService(
        thresholdContext,
        new PrismaReviewRepository(thresholdContext, db),
      )
      app = new Elysia()
        .use(
          createAdminDirectoryRoutes({
            adminDirectoryService: new AdminDirectoryService(
              new AdminDirectoryRepository(db),
              access,
            ),
          }),
        )
        .use(
          createCouponTargetsRoutes({
            couponTargetsService: new CouponTargetsService(targets, access),
          }),
        )
        .use(
          createReviewRoutes({ reviewService } as unknown as ServiceContainer),
        )
    })
    afterAll(async () => {
      await db?.$disconnect()
    })
    function request(
      path: string,
      userId?: string,
      body?: unknown,
      method = body ? 'POST' : 'GET',
    ) {
      return app.handle(
        new Request(`http://localhost${path}`, {
          method,
          headers: {
            ...(userId ? { 'x-test-user': userId } : {}),
            ...(body ? { 'content-type': 'application/json' } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }),
      )
    }
    it('requires authentication and admin permission for directory reads', async () => {
      expect(
        (await request(`/api/admin/directory/users/${f.buyer.id}`)).status,
      ).toBe(401)
      expect(
        (await request(`/api/admin/directory/users/${f.buyer.id}`, f.buyer.id))
          .status,
      ).toBe(403)
      await db.adminTeamMember.update({
        where: { userId: reader.id },
        data: { isActive: false },
      })
      expect(
        (await request(`/api/admin/directory/users/${f.buyer.id}`, reader.id))
          .status,
      ).toBe(403)
      await db.adminTeamMember.update({
        where: { userId: reader.id },
        data: { isActive: true },
      })
    })
    it('paginates buyer addresses and preserves exact coin balances', async () => {
      const first = await request(
        `/api/admin/directory/users/${f.buyer.id}?page=1&limit=2`,
        reader.id,
      )
      expect(first.status).toBe(200)
      const data = await first.json()
      expect(data.addresses.items).toHaveLength(2)
      expect(data.addresses.total).toBe(3)
      expect(data.coins.wallet.balance).toBe('9007199254740993')
      const second = await (
        await request(
          `/api/admin/directory/users/${f.buyer.id}?page=2&limit=2`,
          reader.id,
        )
      ).json()
      expect(second.addresses.items).toHaveLength(1)
      expect(
        new Set(
          [...data.addresses.items, ...second.addresses.items].map(
            (item: { id: string }) => item.id,
          ),
        ).size,
      ).toBe(3)
      expect(
        (
          await request(
            `/api/admin/directory/users/${f.buyer.id}?limit=101`,
            reader.id,
          )
        ).status,
      ).toBe(422)
    })
    it('projects KYC status without encrypted identity or bank data', async () => {
      const response = await request(
        `/api/admin/directory/shops/${f.shop.id}`,
        reader.id,
      )
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.shop.sellerProfile.verificationStatus).toBe('UNVERIFIED')
      expect(JSON.stringify(data)).not.toContain('secret')
      expect(data.quality.approvedReviewCount).toBe(1)
      expect(data.quality.transitThresholdDays).toBe(7)
    })
    it('creates an audited owner-visible notice and protects shops.write', async () => {
      const path = `/api/admin/directory/shops/${f.shop.id}/notices`
      expect(
        (await request(path, reader.id, { subject: 'Notice', body: 'Message' }))
          .status,
      ).toBe(403)
      const response = await request(path, admin.id, {
        subject: ' Notice ',
        body: ' Message ',
      })
      expect(response.status).toBe(200)
      const ticket = await response.json()
      expect(ticket.userId).toBe(f.owner.id)
      const support = new SupportService(
        thresholdContext,
        new PrismaSupportRepository(thresholdContext, db),
      )
      const detail = await support.detail(
        { kind: 'seller', userId: f.owner.id, shopId: f.shop.id },
        ticket.id,
      )
      expect(detail.messages.items[0]).toMatchObject({
        body: 'Message',
        senderType: 'ADMIN',
        isInternal: false,
      })
      await expect(
        support.detail({ kind: 'buyer', userId: f.buyer.id }, ticket.id),
      ).rejects.toMatchObject({ code: 'SUPPORT_TICKET_NOT_FOUND' })
      expect(
        await db.auditLog.count({
          where: { entityType: 'ShopNotice', entityId: ticket.id },
        }),
      ).toBe(1)
    })
    it('protects reporting and rejects an own review or ambiguous target', async () => {
      expect(
        (
          await request('/api/review-reports', undefined, {
            reviewId,
            reason: 'SPAM',
          })
        ).status,
      ).toBe(401)
      expect(
        (
          await request('/api/review-reports', f.buyer.id, {
            reviewId,
            reason: 'SPAM',
          })
        ).status,
      ).toBe(403)
      expect(
        (
          await request('/api/review-reports', f.owner.id, {
            reviewId,
            shopRatingId: ratingId,
            reason: 'SPAM',
          })
        ).status,
      ).toBe(422)
      expect(
        (
          await request('/api/review-reports', f.owner.id, {
            reviewId,
            reason: 'OTHER',
            detail: ' ',
          })
        ).status,
      ).toBe(400)
    })
    it('locks a review target so concurrent reports create one row', async () => {
      const responses = await Promise.all([
        request('/api/review-reports', f.owner.id, {
          reviewId,
          reason: 'SPAM',
        }),
        request('/api/review-reports', f.owner.id, {
          reviewId,
          reason: 'SPAM',
        }),
      ])
      expect(responses.map((response) => response.status).sort()).toEqual([
        200, 409,
      ])
      expect(
        await db.reviewReport.count({
          where: { reviewId, reportedById: f.owner.id },
        }),
      ).toBe(1)
    })
    it('accepts a shop rating report and prevents active duplicates', async () => {
      expect(
        (
          await request('/api/review-reports', f.owner.id, {
            shopRatingId: ratingId,
            reason: 'IRRELEVANT',
            detail: 'Unrelated content',
          })
        ).status,
      ).toBe(200)
      expect(
        (
          await request('/api/review-reports', f.owner.id, {
            shopRatingId: ratingId,
            reason: 'FAKE_REVIEW',
          })
        ).status,
      ).toBe(409)
    })
    it('rejects nonexistent or another shop product targets', async () => {
      const another = await numericThresholdFixture(db)
      for (const productId of [randomUUID(), another.product.id]) {
        expect(
          (
            await request(
              `/api/admin/coupon-targets/${couponId}`,
              admin.id,
              { productIds: [productId], categoryIds: [], expectedVersion: 0 },
              'PUT',
            )
          ).status,
        ).toBe(400)
      }
    })
    it('protects target writes, saves exact scope, and rejects stale versions', async () => {
      const path = `/api/admin/coupon-targets/${couponId}`,
        input = {
          productIds: [f.product.id],
          categoryIds: [f.category.id],
          expectedVersion: 0,
        }
      expect((await request(path, reader.id, input, 'PUT')).status).toBe(403)
      expect((await request(path, admin.id, input, 'PUT')).status).toBe(200)
      expect(await targets.readCouponTargets(couponId)).toEqual({
        productIds: [f.product.id],
        categoryIds: [f.category.id],
      })
      expect((await request(path, admin.id, input, 'PUT')).status).toBe(409)
      const data = await (await request(path, reader.id)).json()
      expect(data.version).toBe(1)
      expect(
        await db.auditLog.count({
          where: { entityType: 'CouponTargets', entityId: couponId },
        }),
      ).toBe(1)
      expect(
        couponTargetEligible(data, { id: f.product.id, categoryId: null }),
      ).toBe(true)
      expect(
        couponTargetEligible(data, {
          id: randomUUID(),
          categoryId: f.category.id,
        }),
      ).toBe(true)
      expect(
        couponTargetEligible(data, { id: randomUUID(), categoryId: null }),
      ).toBe(false)
    })
  },
)
