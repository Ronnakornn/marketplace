import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '#generated/client/client.ts'
import { toMoneyDto } from '#server/lib/money.ts'
import { numericThresholdFixture, thresholdContext, thresholdDatabase, thresholdSale } from '#server/test-support/numeric-threshold.fixture.ts'
import { PrismaPromotionRepository } from './promotion.repository.ts'
import { PromotionService } from './promotion.service.ts'
import { PrismaAffiliateRepository } from '#server/modules/affiliate/affiliate.repository.ts'

describe.skipIf(!process.env['COMMERCE_TEST_DATABASE_URL'])('promotion and affiliate presentation pages on PostgreSQL', () => {
  let db: PrismaClient
  let repo: PrismaPromotionRepository
  let affiliateRepo: PrismaAffiliateRepository
  let f: Awaited<ReturnType<typeof numericThresholdFixture>>
  const couponIds = Array.from({ length: 70 }, () => randomUUID())
  const saleIds = Array.from({ length: 63 }, () => randomUUID())
  const affiliateIds = Array.from({ length: 57 }, () => randomUUID())
  const userIds = Array.from({ length: 55 }, () => randomUUID())
  beforeAll(async () => {
    db = thresholdDatabase()
    repo = new PrismaPromotionRepository(thresholdContext, db)
    affiliateRepo = new PrismaAffiliateRepository(thresholdContext, db)
    f = await numericThresholdFixture(db)
    const sale = await thresholdSale(db, f)
    await db.coupon.createMany({ data: couponIds.map((id, index) => ({
      id, code: `${f.tag}-coupon-${String(index).padStart(3, '0')}`, titleEn: f.tag, shopId: f.shop.id,
      discountType: 'FIXED_AMOUNT', discountValue: 9007199254740993n, minOrder: 9007199254740995n,
      usageLimit: index >= 62 && index <= 66 ? 1 : null,
      startsAt: index === 67 ? new Date('2999-01-01') : null,
      endsAt: index === 68 ? new Date('2000-01-01') : null, isActive: index !== 69,
      createdAt: new Date(Date.UTC(2020, 0, 1, 0, 0, index)),
    })) })
    await db.couponRedemption.createMany({ data: [63, 64, 65, 66].map((index) => ({ couponId: couponIds[index]!, userId: f.buyer.id, orderId: sale.order.id, status: index % 2 ? 'RESERVED' : 'REDEEMED' })) })
    await db.couponRedemption.create({ data: { couponId: couponIds[62]!, userId: f.buyer.id, orderId: sale.order.id, status: 'RELEASED' } })
    await db.couponClaim.createMany({ data: [0, 1, 2].map(index => ({ couponId: couponIds[index]!, userId: f.buyer.id })) })
    await db.couponClaim.create({ data: { couponId: couponIds[3]!, userId: f.owner.id } })
    await db.flashSale.createMany({ data: saleIds.map((id, index) => ({ id, title: `${f.tag}-sale-${index}`, startsAt: new Date(Date.UTC(2021, 0, 1, 0, 0, index)), endsAt: new Date('2999-01-01'), status: index < 61 ? 'ENDED' : 'DRAFT' })) })
    await db.user.createMany({ data: userIds.map((id, index) => ({ id, email: `${f.tag}-affiliate-${index}@example.test`, name: `${f.tag}-${index}` })) })
    await db.affiliate.createMany({ data: [f.buyer.id, f.owner.id, ...userIds].map((userId, index) => ({ id: affiliateIds[index]!, userId, status: index < 55 ? 'ACTIVE' : 'DISABLED', createdAt: new Date(Date.UTC(2022, 0, 1, 0, 0, index)) })) })
    await db.affiliateLink.createMany({ data: Array.from({ length: 65 }, (_, index) => ({ affiliateId: affiliateIds[0]!, code: `${f.tag}-link-${index}`, targetType: 'product', targetId: f.product.id, status: index < 61 ? 'ACTIVE' : 'DISABLED', createdAt: new Date(Date.UTC(2023, 0, 1, 0, 0, index)) })) })
    await db.affiliateLink.create({ data: { affiliateId: affiliateIds[1]!, code: `${f.tag}-other-link`, targetType: 'shop', targetId: f.shop.id } })
  }, 30000)
  afterAll(async () => { await db?.$disconnect() })

  it('filters exhausted, expired, future and inactive coupons before pagination beyond fifty', async () => {
    const first = await repo.listPublicCoupons({ q: f.tag, page: 1, limit: 50 })
    const second = await repo.listPublicCoupons({ q: f.tag, page: 2, limit: 50 })
    expect(first.data.map(row => row.id)).toEqual(couponIds.slice(13, 63).reverse())
    expect(second.data.map(row => row.id)).toEqual(couponIds.slice(0, 13).reverse())
    expect(second.meta).toMatchObject({ totalCount: 63, totalPages: 2, hasNextPage: false, hasPreviousPage: true })
    expect((await repo.listPublicCoupons({ q: f.tag, page: 3, limit: 50 })).data).toEqual([])
    expect((await repo.listPublicCoupons({ q: f.tag + '%' })).meta.totalCount).toBe(0)
    const service = new PromotionService(thresholdContext, repo)
    const dto = toMoneyDto(await service.listPublicCoupons('en', { q: f.tag, limit: 1 }))
    expect(dto.data[0]).toMatchObject({ discountValueCents: '9007199254740993', minOrderCents: '9007199254740995' })
  })

  it('sorts only the requesting buyer claims before page selection and keeps the full eligible count', async () => {
    const first = await repo.listBuyerCoupons(f.buyer.id, { q: f.tag, limit: 2 })
    const second = await repo.listBuyerCoupons(f.buyer.id, { q: f.tag, page: 2, limit: 2 })
    expect(first.data.map(row => row.id)).toEqual([couponIds[2], couponIds[1]])
    expect(second.data.map(row => row.id)).toEqual([couponIds[0], couponIds[62]])
    expect(first.data.every(row => row.claims.length === 1)).toBe(true)
    expect(second.meta.totalCount).toBe(63)
    expect((await repo.listBuyerCoupons(f.owner.id, { q: f.tag, limit: 1 })).data[0]?.id).toBe(couponIds[3])
  })

  it('pages seller history with database filters and never broadens shop ownership', async () => {
    const first = await repo.listSellerCoupons([f.shop.id], { q: f.tag, limit: 50, isActive: true })
    const second = await repo.listSellerCoupons([f.shop.id], { q: f.tag, page: 2, limit: 50, isActive: true })
    expect(first.data).toHaveLength(50)
    expect(second.data).toHaveLength(19)
    expect(second.meta.totalCount).toBe(69)
    expect((await repo.listSellerCoupons([f.shop.id], { shopId: randomUUID() })).meta.totalCount).toBe(0)
    expect((await repo.listSellerCoupons([], { q: f.tag })).data).toEqual([])
    expect((await repo.listAdminCoupons({ q: `${f.tag}-coupon-069`, isActive: false })).data.map(row => row.id)).toEqual([couponIds[69]])
  })

  it('reaches older admin Flash Sale campaigns after status and title filtering', async () => {
    const first = await repo.listAdminFlashSales({ q: f.tag, status: 'ENDED', limit: 50 })
    const second = await repo.listAdminFlashSales({ q: f.tag, status: 'ENDED', page: 2, limit: 50 })
    expect(first.data.map(row => row.id)).toEqual(saleIds.slice(11, 61).reverse())
    expect(second.data.map(row => row.id)).toEqual(saleIds.slice(0, 11).reverse())
    expect(second.meta.totalCount).toBe(61)
  })

  it('pages affiliate links by actor and status and returns compact whole-history link counts for admins', async () => {
    const first = await affiliateRepo.listLinksByUserId(f.buyer.id, { q: f.tag, status: 'ACTIVE', limit: 50 })
    const second = await affiliateRepo.listLinksByUserId(f.buyer.id, { q: f.tag, status: 'ACTIVE', page: 2, limit: 50 })
    expect(first.data).toHaveLength(50)
    expect(second.data).toHaveLength(11)
    expect(second.meta.totalCount).toBe(61)
    expect(first.data.every(row => row.affiliateId === affiliateIds[0])).toBe(true)
    const ownOther = await affiliateRepo.listLinksByUserId(f.owner.id, { q: f.tag })
    expect(ownOther.data.map(row => row.code)).toEqual([`${f.tag}-other-link`])
    const adminFirst = await affiliateRepo.listAffiliates({ q: f.tag, limit: 50 })
    const adminSecond = await affiliateRepo.listAffiliates({ q: f.tag, page: 2, limit: 50 })
    expect(adminFirst.data).toHaveLength(50)
    expect(adminSecond.data).toHaveLength(7)
    expect(adminSecond.meta.totalCount).toBe(57)
    expect(new Set([...adminFirst.data, ...adminSecond.data].map(row => row.id)).size).toBe(57)
    const byCode = await affiliateRepo.listAffiliates({ q: `${f.tag}-link-64` })
    expect(byCode.data).toHaveLength(1)
    expect(byCode.data[0]).toMatchObject({ id: affiliateIds[0], linkCount: 65 })
    expect(byCode.data[0]).not.toHaveProperty('links')
    expect((await affiliateRepo.listAffiliates({ q: f.tag, status: 'DISABLED' })).meta.totalCount).toBe(2)
  })
  it('treats managed search percent and underscore characters as literal text', async () => {
    expect((await repo.listAdminCoupons({ q: `${f.tag}%` })).data).toEqual([])
    expect((await repo.listSellerCoupons([f.shop.id], { q: `${f.tag}%` })).data).toEqual([])
    expect((await repo.listAdminFlashSales({ q: `${f.tag}%` })).data).toEqual([])
    expect((await affiliateRepo.listAffiliates({ q: `${f.tag}%` })).data).toEqual([])
    expect((await affiliateRepo.listLinksByUserId(f.buyer.id, { q: `${f.tag}%` })).data).toEqual([])
    const literal = `${f.tag}_literal%`
    await db.coupon.update({ where: { id: couponIds[0] }, data: { code: literal } })
    await db.flashSale.update({ where: { id: saleIds[0] }, data: { title: literal } })
    const link = await db.affiliateLink.findFirstOrThrow({ where: { affiliateId: affiliateIds[0] } })
    await db.affiliateLink.update({ where: { id: link.id }, data: { code: literal } })
    expect((await repo.listAdminCoupons({ q: literal })).data.map(row => row.id)).toEqual([couponIds[0]])
    expect((await repo.listSellerCoupons([f.shop.id], { q: literal })).data.map(row => row.id)).toEqual([couponIds[0]])
    expect((await repo.listAdminFlashSales({ q: literal })).data.map(row => row.id)).toEqual([saleIds[0]])
    expect((await affiliateRepo.listLinksByUserId(f.buyer.id, { q: literal })).data.map(row => row.id)).toEqual([link.id])
    expect((await affiliateRepo.listAffiliates({ q: literal })).data.map(row => row.id)).toEqual([affiliateIds[0]])
  })
})
