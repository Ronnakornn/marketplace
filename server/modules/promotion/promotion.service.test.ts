import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiscountType } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { IPromotionRepository } from './promotion.repository.ts'
import { PromotionService } from './promotion.service.ts'

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  }
}

function createAppContext(): AppContext {
  return {
    logger: createLogger(),
    config: { environment: 'test' },
  }
}

function createRepoMock(): IPromotionRepository {
  return {
    findCouponByCode: vi.fn(),
    countCouponRedemptionsForUser: vi.fn(),
    findCartForCouponValidation: vi.fn(),
    findSellerShops: vi.fn(),
    listPublicCoupons: vi.fn(),
    listBuyerCoupons: vi.fn(),
    findCouponForClaim: vi.fn(),
    createCouponClaim: vi.fn(),
    listAdminCoupons: vi.fn(),
    listSellerCoupons: vi.fn(),
    findCouponById: vi.fn(),
    createCoupon: vi.fn(),
    updateCoupon: vi.fn(),
    deleteCoupon: vi.fn(),
  }
}

function createCoupon(overrides: Partial<{
  shopId: string | null
  discountType: DiscountType
  discountValueCents: number | null
  discountPercentBps: number | null
  minOrderCents: number | null
  maxDiscountCents: number | null
  startsAt: Date | null
  endsAt: Date | null
  usageLimit: number | null
  perUserLimit: number | null
  isActive: boolean
  redemptions: number
}> = {}): any {
  const now = new Date('2026-05-13T00:00:00.000Z')
  return {
    id: '99999999-9999-4999-8999-999999999999',
    shopId: overrides.shopId ?? null,
    code: 'SAVE',
    discountType: overrides.discountType ?? 'FIXED_AMOUNT',
    discountValueCents: overrides.discountValueCents ?? 500,
    discountPercentBps: overrides.discountPercentBps ?? null,
    minOrderCents: overrides.minOrderCents ?? null,
    maxDiscountCents: overrides.maxDiscountCents ?? null,
    startsAt: overrides.startsAt ?? null,
    endsAt: overrides.endsAt ?? null,
    usageLimit: overrides.usageLimit ?? null,
    perUserLimit: overrides.perUserLimit ?? null,
    isActive: overrides.isActive ?? true,
    createdAt: now,
    updatedAt: now,
    _count: {
      redemptions: overrides.redemptions ?? 0,
    },
  }
}

let repo: IPromotionRepository
let service: PromotionService

async function validate(subtotal = 2_000) {
  return service.validateCouponForsubtotal(repo, {
    userId: 'user-1',
    couponCode: ' save ',
    subtotal,
  })
}

describe('PromotionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repo = createRepoMock()
    service = new PromotionService(createAppContext(), repo)
    vi.mocked(repo.findCouponByCode).mockResolvedValue(createCoupon())
    vi.mocked(repo.countCouponRedemptionsForUser).mockResolvedValue(0)
  })

  it('applies a valid fixed coupon discount', async () => {
    vi.mocked(repo.findCouponByCode).mockResolvedValue(createCoupon({ discountValueCents: 700 }))

    await expect(validate()).resolves.toMatchObject({
      couponId: '99999999-9999-4999-8999-999999999999',
      couponCode: 'SAVE',
      discountCents: 700,
      subtotal: 2_000,
    })
    expect(repo.findCouponByCode).toHaveBeenCalledWith('SAVE')
  })

  it('returns only redeemable public coupons using the API field contract', async () => {
    vi.mocked(repo.listPublicCoupons).mockResolvedValue([
      {
        ...createCoupon({ usageLimit: 2, redemptions: 1 }),
        discountValue: 500n,
        minOrder: 1_000n,
        maxDiscount: null,
        titleTh: 'ลดห้าบาท',
        titleEn: 'Five off',
        descriptionTh: null,
        descriptionEn: null,
        endsAt: '2999-01-01T00:00:00.000Z',
      },
      {
        ...createCoupon({ usageLimit: 1, redemptions: 1 }),
        discountValue: 500n,
        minOrder: null,
        maxDiscount: null,
        titleTh: 'เต็มแล้ว',
        titleEn: 'Used up',
        descriptionTh: null,
        descriptionEn: null,
      },
    ] as any)

    await expect(service.listPublicCoupons('en')).resolves.toEqual([expect.objectContaining({
      code: 'SAVE',
      title: 'Five off',
      discountValueCents: 500,
      minOrderCents: 1_000,
      endsAt: '2999-01-01T00:00:00.000Z',
    })])
  })

  it('returns buyer coupon claim state and claims an active coupon', async () => {
    const coupon = {
      ...createCoupon(),
      discountValue: 500n,
      minOrder: null,
      maxDiscount: null,
      titleTh: 'ลดห้าบาท',
      titleEn: 'Five off',
      descriptionTh: null,
      descriptionEn: null,
      claims: [{ id: 'claim-1', claimedAt: new Date('2026-05-13T00:00:00.000Z') }],
    }
    vi.mocked(repo.listBuyerCoupons).mockResolvedValue([coupon] as any)
    vi.mocked(repo.findCouponForClaim).mockResolvedValue(coupon as any)
    vi.mocked(repo.createCouponClaim).mockResolvedValue(coupon.claims[0] as any)

    await expect(service.listBuyerCoupons({ id: 'user-1', role: 'USER' }, 'en')).resolves.toEqual([
      expect.objectContaining({ code: 'SAVE', claimed: true, claimedAt: '2026-05-13T00:00:00.000Z' }),
    ])
    await expect(service.claimCoupon({ id: 'user-1', role: 'USER' }, coupon.id, 'en')).resolves.toMatchObject({
      code: 'SAVE',
      claimed: true,
    })
    expect(repo.createCouponClaim).toHaveBeenCalledWith(coupon.id, 'user-1')
  })

  it('applies a valid percent coupon discount', async () => {
    vi.mocked(repo.findCouponByCode).mockResolvedValue(createCoupon({
      discountType: 'PERCENT',
      discountValueCents: null,
      discountPercentBps: 1500,
    }))

    await expect(validate(2_000)).resolves.toMatchObject({ discountCents: 300 })
  })

  it('respects max discount for percent coupons', async () => {
    vi.mocked(repo.findCouponByCode).mockResolvedValue(createCoupon({
      discountType: 'PERCENT',
      discountValueCents: null,
      discountPercentBps: 5000,
      maxDiscountCents: 600,
    }))

    await expect(validate(2_000)).resolves.toMatchObject({ discountCents: 600 })
  })

  it('never discounts more than the subtotal', async () => {
    vi.mocked(repo.findCouponByCode).mockResolvedValue(createCoupon({ discountValueCents: 9_999 }))

    await expect(validate(2_000)).resolves.toMatchObject({ discountCents: 2_000 })
  })

  it('rejects inactive coupons', async () => {
    vi.mocked(repo.findCouponByCode).mockResolvedValue(createCoupon({ isActive: false }))

    await expect(validate()).rejects.toMatchObject({ code: 'COUPON_INACTIVE' })
  })

  it('rejects expired coupons', async () => {
    vi.mocked(repo.findCouponByCode).mockResolvedValue(createCoupon({ endsAt: new Date('2000-01-01T00:00:00.000Z') }))

    await expect(validate()).rejects.toMatchObject({ code: 'COUPON_EXPIRED' })
  })

  it('rejects coupons that have not started', async () => {
    vi.mocked(repo.findCouponByCode).mockResolvedValue(createCoupon({ startsAt: new Date('2999-01-01T00:00:00.000Z') }))

    await expect(validate()).rejects.toMatchObject({ code: 'COUPON_NOT_STARTED' })
  })

  it('rejects coupons when the order minimum is not met', async () => {
    vi.mocked(repo.findCouponByCode).mockResolvedValue(createCoupon({ minOrderCents: 3_000 }))

    await expect(validate(2_000)).rejects.toMatchObject({ code: 'COUPON_MIN_ORDER_NOT_MET' })
  })

  it('rejects coupons after the global usage limit is reached', async () => {
    vi.mocked(repo.findCouponByCode).mockResolvedValue(createCoupon({ usageLimit: 2, redemptions: 2 }))

    await expect(validate()).rejects.toMatchObject({ code: 'COUPON_USAGE_LIMIT_REACHED' })
  })

  it('rejects coupons after the per-user usage limit is reached', async () => {
    vi.mocked(repo.findCouponByCode).mockResolvedValue(createCoupon({ perUserLimit: 1 }))
    vi.mocked(repo.countCouponRedemptionsForUser).mockResolvedValue(1)

    await expect(validate()).rejects.toMatchObject({ code: 'COUPON_USER_LIMIT_REACHED' })
  })

  it('lists and creates seller coupons for owned shops', async () => {
    vi.mocked(repo.findSellerShops).mockResolvedValue([{ id: 'shop-1', ownerId: 'seller-1' }])
    vi.mocked(repo.listSellerCoupons).mockResolvedValue([createCoupon({ shopId: 'shop-1' }) as any])
    vi.mocked(repo.createCoupon).mockResolvedValue(createCoupon({ shopId: 'shop-1' }) as any)

    await expect(service.listSellerCoupons({ id: 'seller-1', role: 'USER' })).resolves.toHaveLength(1)
    expect(repo.listSellerCoupons).toHaveBeenCalledWith(['shop-1'])

    await service.createSellerCoupon({ id: 'seller-1', role: 'USER' }, {
      code: 'seller10',
      discountType: 'fixed',
      discountValueCents: 1000,
      minOrderCents: 2_000,
      maxDiscountCents: 500,
    })
    expect(repo.createCoupon).toHaveBeenCalledWith(expect.objectContaining({
      shopId: 'shop-1',
      code: 'SELLER10',
      discountType: 'FIXED_AMOUNT',
      minOrder: 2_000,
      maxDiscount: 500,
    }))
  })

  it('prevents sellers from updating another shop coupon', async () => {
    vi.mocked(repo.findSellerShops).mockResolvedValue([{ id: 'shop-1', ownerId: 'seller-1' }])
    vi.mocked(repo.findCouponById).mockResolvedValue(createCoupon({ shopId: 'shop-2' }) as any)

    await expect(service.updateSellerCoupon({ id: 'seller-1', role: 'USER' }, 'coupon-1', {
      isActive: false,
    })).rejects.toMatchObject({ code: 'COUPON_NOT_FOUND' })
  })
})
