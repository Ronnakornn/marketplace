import { listPageResult } from '#server/lib/list-page.ts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiscountType } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { IPromotionRepository, PromotionCoupon } from './promotion.repository.ts'
import { PromotionService, type CouponPayload } from './promotion.service.ts'

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
    findBuyerCoinWallet: vi.fn(),
    listBuyerCoinLedger: vi.fn(),
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
    listAdminFlashSales: vi.fn(),
    listSellerFlashSales: vi.fn(),
    findFlashSaleById: vi.fn(),
    createFlashSale: vi.fn(),
    updateFlashSale: vi.fn(),
    updateFlashSaleSafely: vi.fn(),
    findActiveProductVariant: vi.fn(),
    createFlashSaleItem: vi.fn(),
    findFlashSaleItemById: vi.fn(),
    findOverlappingFlashSaleItem: vi.fn().mockResolvedValue(null),
    sumActiveFlashSaleReservations: vi.fn(),
    updateFlashSaleItem: vi.fn(),
    deleteFlashSaleItem: vi.fn(),
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
}> = {}): PromotionCoupon {
  const now = new Date('2026-05-13T00:00:00.000Z')
  return {
    id: '99999999-9999-4999-8999-999999999999',
    shopId: overrides.shopId ?? null,
    code: 'SAVE',
    discountType: overrides.discountType ?? 'FIXED_AMOUNT',
    discountValue: null,
    discountValueCents: overrides.discountValueCents ?? 500,
    discountPercentBps: overrides.discountPercentBps ?? null,
    minOrderCents: overrides.minOrderCents ?? null,
    minOrder: null,
    maxDiscountCents: overrides.maxDiscountCents ?? null,
    maxDiscount: null,
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
    shopSubtotals: [{ shopId: 'shop-1', subtotal }],
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

  it.each([
    ['discountValueCents', 1.5], ['minOrderCents', 1.5], ['maxDiscountCents', 1.5],
    ['discountPercentBps', 12.5], ['usageLimit', 1.5], ['perUserLimit', 1.5],
    ['discountValueCents', -1], ['discountValueCents', Number.MAX_SAFE_INTEGER + 1],
    ['discountPercentBps', 10001], ['usageLimit', 0],
  ] satisfies Array<[keyof CouponPayload, number]>)('rejects invalid coupon %s=%s before persistence', async (field, value) => {
    await expect(service.createCoupon({ id: 'admin-1', role: 'ADMIN' }, {
      code: 'NUMBER', discountType: 'fixed', [field]: value,
    })).rejects.toMatchObject({ code: 'INVALID_COUPON', status: 400 })
    expect(repo.createCoupon).not.toHaveBeenCalled()
  })

  it.each([[0.29, 29n], [1.15, 115n], [19.99, 1999n], ['90071992547409.90', 9007199254740990n]])('stores a valid flash sale price of %s baht exactly', async (baht, expected) => {
    const campaign = { id: 'flash-1', shopId: null, title: 'Sale', description: null, status: 'DRAFT' as const,
      startsAt: new Date('2999-01-01'), endsAt: new Date('2999-01-02'), createdAt: new Date(), updatedAt: new Date(), items: [] }
    const item = { id: 'item-1', flashSaleId: campaign.id, shopId: 'shop-1', productId: 'product-1', variantId: 'variant-1',
      salePrice: 100n, originalPrice: 3000n, stockLimit: 10, soldCount: 0, perUserLimit: null,
      isActive: true, createdAt: new Date(), updatedAt: new Date() }
    vi.mocked(repo.findFlashSaleById).mockResolvedValue(campaign)
    vi.mocked(repo.findActiveProductVariant).mockResolvedValue({ id: 'variant-1', price: 9007199254740991n, product: { id: 'product-1', shopId: 'shop-1' } })
    vi.mocked(repo.createFlashSaleItem).mockImplementation(async (_id, input) => ({ ...item, salePrice: BigInt(input.salePrice) }))
    const created = await service.addFlashSaleItem({ id: 'admin-1', role: 'ADMIN' }, campaign.id, {
      productId: item.productId, variantId: item.variantId, salePriceBaht: baht, stockLimit: 10,
    })
    expect(created.salePrice).toBe(expected)
    vi.mocked(repo.findFlashSaleItemById).mockResolvedValue({ ...item, variant: { price: 9007199254740991n }, flashSale: campaign })
    vi.mocked(repo.updateFlashSaleItem).mockImplementation(async (_id, input) => ({ ...item, salePrice: BigInt(input.salePrice!) }))
    const updated = await service.updateFlashSaleItem({ id: 'admin-1', role: 'ADMIN' }, item.id, { salePriceBaht: baht })
    expect(updated.salePrice).toBe(expected)
  })

  it.each([0, -1, 1.001, 1e-7, 1e21, 90071992547409.9, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER])('rejects invalid flash sale baht price %s', async (baht) => {
    vi.mocked(repo.findFlashSaleItemById).mockResolvedValue({
      id: 'item-1', flashSaleId: 'flash-1', shopId: 'shop-1', productId: 'product-1', variantId: 'variant-1',
      salePrice: 100n, originalPrice: 3000n, stockLimit: 10, soldCount: 0, perUserLimit: null,
      isActive: true, createdAt: new Date(), updatedAt: new Date(), variant: { price: 3000n },
      flashSale: { id: 'flash-1', shopId: null, status: 'DRAFT', startsAt: new Date('2999-01-01'), endsAt: new Date('2999-01-02') },
    })
    await expect(service.updateFlashSaleItem({ id: 'admin-1', role: 'ADMIN' }, 'item-1', { salePriceBaht: baht }))
      .rejects.toMatchObject({ code: 'FLASH_SALE_PRICE_INVALID' })
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

  it.each([
    { discountValueCents: 700 },
    { discountType: 'PERCENT', discountPercentBps: 1500, maxDiscountCents: 250 },
    { discountType: 'FREE_SHIPPING', shopId: 'shop-1' },
  ] satisfies Parameters<typeof createCoupon>[0][])('validates a loaded coupon with the same rules as code lookup %j', async overrides => {
    const coupon = createCoupon(overrides)
    vi.mocked(repo.findCouponByCode).mockResolvedValue(coupon)
    const expected = await validate()
    expect(repo.findCouponByCode).toHaveBeenCalledExactlyOnceWith('SAVE')
    vi.mocked(repo.findCouponByCode).mockClear()

    await expect(service.validateLoadedCouponForSubtotal(repo, coupon, {
      userId: 'user-1', couponCode: ' save ', subtotal: 2000, shopSubtotals: [{ shopId: 'shop-1', subtotal: 2000 }],
    })).resolves.toEqual(expected)
    expect(repo.findCouponByCode).not.toHaveBeenCalled()
  })

  it('normalizes and rejects an empty code on both coupon validation entry points', async () => {
    const context = { userId: 'user-1', couponCode: '  ', subtotal: 2000, shopSubtotals: [{ shopId: 'shop-1', subtotal: 2000 }] }

    await expect(service.validateCouponForsubtotal(repo, context)).rejects.toMatchObject({ code: 'INVALID_COUPON' })
    await expect(service.validateLoadedCouponForSubtotal(repo, createCoupon(), context)).rejects.toMatchObject({ code: 'INVALID_COUPON' })
    expect(repo.findCouponByCode).not.toHaveBeenCalled()
  })

  it('rechecks per-user redemption counts for each loaded coupon validation', async () => {
    const coupon = createCoupon({ perUserLimit: 1 })
    const context = { userId: 'user-1', couponCode: 'SAVE', subtotal: 2000, shopSubtotals: [{ shopId: 'shop-1', subtotal: 2000 }] }
    vi.mocked(repo.countCouponRedemptionsForUser).mockResolvedValueOnce(0).mockResolvedValueOnce(1)

    await expect(service.validateLoadedCouponForSubtotal(repo, coupon, context)).resolves.toMatchObject({ discount: 500 })
    await expect(service.validateLoadedCouponForSubtotal(repo, coupon, context)).rejects.toMatchObject({ code: 'COUPON_USER_LIMIT_REACHED' })
    expect(repo.countCouponRedemptionsForUser).toHaveBeenCalledTimes(2)
    expect(repo.findCouponByCode).not.toHaveBeenCalled()
  })

  it('returns only redeemable public coupons using the API field contract', async () => {
    vi.mocked(repo.listPublicCoupons).mockResolvedValue(listPageResult([{
      ...createCoupon(), discountValue: 500n, minOrder: 1_000n, maxDiscount: null,
      titleTh: 'ลดห้าบาท', titleEn: 'Five off', descriptionTh: null, descriptionEn: null,
      endsAt: '2999-01-01T00:00:00.000Z',
    }] as any, 1, {}))

    await expect(service.listPublicCoupons('en')).resolves.toMatchObject({ data: [expect.objectContaining({
      code: 'SAVE',
      title: 'Five off',
      discountValueCents: 500n,
      minOrderCents: 1_000n,
      endsAt: '2999-01-01T00:00:00.000Z',
    })], meta: { totalCount: 1 } })
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
    vi.mocked(repo.listBuyerCoupons).mockResolvedValue(listPageResult([coupon] as any, 1, {}))
    vi.mocked(repo.findCouponForClaim).mockResolvedValue(coupon as any)
    vi.mocked(repo.createCouponClaim).mockResolvedValue(coupon.claims[0] as any)

    await expect(service.listBuyerCoupons({ id: 'user-1', role: 'USER' }, 'en')).resolves.toMatchObject({ data: [
      expect.objectContaining({ code: 'SAVE', claimed: true, claimedAt: '2026-05-13T00:00:00.000Z' }),
    ], meta: { totalCount: 1 } })
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

  it('keeps percentage coupon minor units exact near the safe amount limit', async () => {
    vi.mocked(repo.findCouponByCode).mockResolvedValue(createCoupon({ discountType: 'PERCENT', discountPercentBps: 9999 }))
    await expect(validate(9007199254740990)).resolves.toMatchObject({ discountCents: 9006298534815515 })
  })

  it('marks a free-shipping coupon without discounting product subtotal', async () => {
    vi.mocked(repo.findCouponByCode).mockResolvedValue(createCoupon({
      discountType: 'FREE_SHIPPING',
      discountValueCents: null,
    }))

    await expect(validate(2_000)).resolves.toMatchObject({ discountCents: 0, freeShipping: true })
  })

  it('scopes a seller coupon to its own shop subtotal', async () => {
    vi.mocked(repo.findCouponByCode).mockResolvedValue(createCoupon({
      shopId: 'shop-1',
      discountValueCents: 1_500,
    }))

    await expect(service.validateCouponForsubtotal(repo, {
      userId: 'user-1',
      couponCode: 'SAVE',
      subtotal: 3_000,
      shopSubtotals: [
        { shopId: 'shop-1', subtotal: 1_000 },
        { shopId: 'shop-2', subtotal: 2_000 },
      ],
    })).resolves.toMatchObject({
      discountCents: 1_000,
      couponShopId: 'shop-1',
    })
  })

  it('rejects a seller coupon when the selected cart has no items from its shop', async () => {
    vi.mocked(repo.findCouponByCode).mockResolvedValue(createCoupon({ shopId: 'shop-2' }))

    await expect(validate()).rejects.toMatchObject({ code: 'COUPON_SHOP_MISMATCH' })
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
    vi.mocked(repo.listSellerCoupons).mockResolvedValue(listPageResult([createCoupon({ shopId: 'shop-1' }) as any], 1, {}))
    vi.mocked(repo.createCoupon).mockResolvedValue(createCoupon({ shopId: 'shop-1' }) as any)

    await expect(service.listSellerCoupons({ id: 'seller-1', role: 'USER' })).resolves.toMatchObject({ data: [expect.objectContaining({ shopId: 'shop-1' })], meta: { totalCount: 1 } })
    expect(repo.listSellerCoupons).toHaveBeenCalledWith(['shop-1'], {})

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

  it('rejects a flash-sale item update at or above the active variant price', async () => {
    ;(repo as any).findFlashSaleItemById = vi.fn().mockResolvedValue({
      id: 'flash-item-1',
      shopId: 'shop-1',
      salePrice: 900,
      stockLimit: 10,
      soldCount: 2,
      perUserLimit: 2,
      variant: { price: 1_200 },
      flashSale: { id: 'flash-1', shopId: null, status: 'SCHEDULED', startsAt: new Date('2999-01-01T00:00:00.000Z'), endsAt: new Date('2999-01-02T00:00:00.000Z') },
    })
    ;(repo as any).sumActiveFlashSaleReservations = vi.fn().mockResolvedValue(1)

    await expect(service.updateFlashSaleItem(
      { id: 'admin-1', role: 'ADMIN' },
      'flash-item-1',
      { salePriceBaht: 12 },
    )).rejects.toMatchObject({ code: 'FLASH_SALE_PRICE_INVALID' })
    expect(repo.updateFlashSaleItem).not.toHaveBeenCalled()
  })

  it.each(['stockLimit', 'perUserLimit'] as const)('rejects invalid Int32 %s on flash item create and update', async (field) => {
    const campaign = { id: 'flash-1', shopId: null, title: 'Sale', description: null, status: 'DRAFT' as const,
      startsAt: new Date('2999-01-01'), endsAt: new Date('2999-01-02'), createdAt: new Date(), updatedAt: new Date(), items: [] }
    const item = { id: 'item-1', flashSaleId: campaign.id, shopId: 'shop-1', productId: 'product-1', variantId: 'variant-1',
      salePrice: 500n, originalPrice: 1000n, stockLimit: 10, soldCount: 0, perUserLimit: null,
      isActive: true, createdAt: new Date(), updatedAt: new Date() }
    vi.mocked(repo.findFlashSaleById).mockResolvedValue(campaign)
    vi.mocked(repo.findActiveProductVariant).mockResolvedValue({ id: 'variant-1', price: 1000n, product: { id: 'product-1', shopId: 'shop-1' } })
    vi.mocked(repo.findFlashSaleItemById).mockResolvedValue({ ...item, variant: { price: 1000n }, flashSale: campaign })
    vi.mocked(repo.sumActiveFlashSaleReservations).mockResolvedValue(0)
    for (const value of [-1, 0.5, 2_147_483_648, 9007199254740993, 1e100]) {
      await expect(service.addFlashSaleItem({ id: 'admin-1', role: 'ADMIN' }, campaign.id, {
        productId: 'product-1', variantId: 'variant-1', salePriceBaht: 5, stockLimit: 10, [field]: value,
      })).rejects.toMatchObject({ status: 400, code: 'FLASH_SALE_QUOTA_INVALID' })
      await expect(service.updateFlashSaleItem({ id: 'admin-1', role: 'ADMIN' }, item.id, { [field]: value }))
        .rejects.toMatchObject({ status: 400, code: 'FLASH_SALE_QUOTA_INVALID' })
    }
    expect(repo.createFlashSaleItem).not.toHaveBeenCalled()
    expect(repo.updateFlashSaleItem).not.toHaveBeenCalled()
  })

  it('accepts maximum Int32 flash quotas and preserves zero only for an unsold update', async () => {
    const campaign = { id: 'flash-1', shopId: null, title: 'Sale', description: null, status: 'DRAFT' as const,
      startsAt: new Date('2999-01-01'), endsAt: new Date('2999-01-02'), createdAt: new Date(), updatedAt: new Date(), items: [] }
    const item = { id: 'item-1', flashSaleId: campaign.id, shopId: 'shop-1', productId: 'product-1', variantId: 'variant-1',
      salePrice: 500n, originalPrice: 1000n, stockLimit: 10, soldCount: 0, perUserLimit: null,
      isActive: true, createdAt: new Date(), updatedAt: new Date() }
    vi.mocked(repo.findFlashSaleById).mockResolvedValue(campaign)
    vi.mocked(repo.findActiveProductVariant).mockResolvedValue({ id: 'variant-1', price: 1000n, product: { id: 'product-1', shopId: 'shop-1' } })
    vi.mocked(repo.findFlashSaleItemById).mockResolvedValue({ ...item, variant: { price: 1000n }, flashSale: campaign })
    vi.mocked(repo.sumActiveFlashSaleReservations).mockResolvedValue(0)
    vi.mocked(repo.createFlashSaleItem).mockResolvedValue(item)
    vi.mocked(repo.updateFlashSaleItem).mockResolvedValue(item)
    const quotas = { stockLimit: 2_147_483_647, perUserLimit: 2_147_483_647 }
    await service.addFlashSaleItem({ id: 'admin-1', role: 'ADMIN' }, campaign.id, {
      productId: 'product-1', variantId: 'variant-1', salePriceBaht: 5, ...quotas,
    })
    await service.updateFlashSaleItem({ id: 'admin-1', role: 'ADMIN' }, item.id, quotas)
    expect(repo.createFlashSaleItem).toHaveBeenCalledWith(campaign.id, expect.objectContaining(quotas))
    expect(repo.updateFlashSaleItem).toHaveBeenCalledWith(item.id, quotas)
    await service.updateFlashSaleItem({ id: 'admin-1', role: 'ADMIN' }, item.id, { stockLimit: 0, perUserLimit: null })
    expect(repo.updateFlashSaleItem).toHaveBeenLastCalledWith(item.id, { stockLimit: 0, perUserLimit: null })
    await expect(service.addFlashSaleItem({ id: 'admin-1', role: 'ADMIN' }, campaign.id, {
      productId: 'product-1', variantId: 'variant-1', salePriceBaht: 5, stockLimit: 0,
    })).rejects.toMatchObject({ status: 400, code: 'FLASH_SALE_QUOTA_INVALID' })
    await expect(service.updateFlashSaleItem({ id: 'admin-1', role: 'ADMIN' }, item.id, { perUserLimit: 0 }))
      .rejects.toMatchObject({ status: 400, code: 'FLASH_SALE_QUOTA_INVALID' })
  })

  it('lets a seller enroll an owned active variant in a scheduled platform flash sale', async () => {
    vi.mocked(repo.findSellerShops).mockResolvedValue([{ id: 'shop-1', ownerId: 'seller-1' }])
    vi.mocked(repo.findFlashSaleById).mockResolvedValue({
      id: 'flash-1',
      shopId: null,
      title: 'Platform sale',
      description: null,
      status: 'SCHEDULED',
      startsAt: new Date('2999-01-01T00:00:00.000Z'),
      endsAt: new Date('2999-01-02T00:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    } as any)
    vi.mocked(repo.findActiveProductVariant).mockResolvedValue({
      id: 'variant-1',
      price: 1_200,
      product: { id: 'product-1', shopId: 'shop-1' },
    } as any)
    vi.mocked(repo.createFlashSaleItem).mockResolvedValue({ id: 'flash-item-1' } as any)

    await expect(Promise.resolve().then(() => (service as any).addSellerFlashSaleItem(
      { id: 'seller-1', role: 'USER' },
      'flash-1',
      { productId: 'product-1', variantId: 'variant-1', salePriceBaht: 9, stockLimit: 10, perUserLimit: 2 },
    ))).resolves.toMatchObject({ id: 'flash-item-1' })
    expect(repo.createFlashSaleItem).toHaveBeenCalledWith('flash-1', expect.objectContaining({
      shopId: 'shop-1',
      originalPrice: 1_200,
    }))
  })

  it('prevents a seller from enrolling in another shop scoped flash sale', async () => {
    vi.mocked(repo.findSellerShops).mockResolvedValue([{ id: 'shop-1', ownerId: 'seller-1' }])
    vi.mocked(repo.findFlashSaleById).mockResolvedValue({
      id: 'flash-1', shopId: 'shop-2', title: 'Private sale', description: null, status: 'SCHEDULED',
      startsAt: new Date('2999-01-01T00:00:00.000Z'), endsAt: new Date('2999-01-02T00:00:00.000Z'),
      createdAt: new Date(), updatedAt: new Date(), items: [],
    } as any)

    await expect(service.addSellerFlashSaleItem(
      { id: 'seller-1', role: 'USER' },
      'flash-1',
      { productId: 'product-1', variantId: 'variant-1', salePriceBaht: 9, stockLimit: 10, perUserLimit: 2 },
    )).rejects.toMatchObject({ code: 'FLASH_SALE_NOT_AVAILABLE' })
    expect(repo.createFlashSaleItem).not.toHaveBeenCalled()
  })

  it('rejects enrollment when the atomic repository overlap check loses a race', async () => {
    vi.mocked(repo.findSellerShops).mockResolvedValue([{ id: 'shop-1', ownerId: 'seller-1' }] as any)
    vi.mocked(repo.findFlashSaleById).mockResolvedValue({
      id: 'flash-1', shopId: null, title: 'Sale', description: null, status: 'SCHEDULED',
      startsAt: new Date(Date.now() + 60_000), endsAt: new Date(Date.now() + 120_000), items: [],
    } as any)
    vi.mocked(repo.findActiveProductVariant).mockResolvedValue({ id: 'variant-1', price: 1000, product: { id: 'product-1', shopId: 'shop-1' } } as any)
    vi.mocked(repo.createFlashSaleItem).mockResolvedValue(null)

    await expect(service.addSellerFlashSaleItem(
      { id: 'seller-1', role: 'USER' }, 'flash-1',
      { productId: 'product-1', variantId: 'variant-1', salePriceBaht: 5, stockLimit: 1 },
    )).rejects.toMatchObject({ code: 'FLASH_SALE_OVERLAP' })
  })

  it('rejects a campaign schedule update when the atomic repository check finds overlap', async () => {
    vi.mocked(repo.findFlashSaleById).mockResolvedValue({
      id: 'flash-1', shopId: null, title: 'Sale', description: null, status: 'DRAFT',
      startsAt: new Date('2999-01-01T00:00:00.000Z'), endsAt: new Date('2999-01-02T00:00:00.000Z'),
      items: [{ variantId: 'variant-1' }],
    } as any)
    vi.mocked(repo.updateFlashSaleSafely).mockResolvedValue(null)

    await expect(service.updateFlashSale(
      { id: 'admin-1', role: 'ADMIN' }, 'flash-1', { status: 'SCHEDULED' },
    )).rejects.toMatchObject({ code: 'FLASH_SALE_OVERLAP' })
  })

  it('prevents deleting live or reserved flash sale items', async () => {
    vi.mocked(repo.findFlashSaleItemById).mockResolvedValue({
      id: 'flash-item-1', shopId: 'shop-1', salePrice: 900, stockLimit: 10, soldCount: 0,
      perUserLimit: 2, variant: { price: 1_200 },
      flashSale: { id: 'flash-1', shopId: null, status: 'ACTIVE', startsAt: new Date('2000-01-01T00:00:00.000Z'), endsAt: new Date('2999-01-02T00:00:00.000Z') },
    } as any)

    await expect(service.deleteFlashSaleItem({ id: 'admin-1', role: 'ADMIN' }, 'flash-item-1'))
      .rejects.toMatchObject({ code: 'FLASH_SALE_ITEM_LOCKED' })
    expect(repo.deleteFlashSaleItem).not.toHaveBeenCalled()
  })

  it('returns the buyer coin wallet and recent ledger history', async () => {
    ;(repo as any).findBuyerCoinWallet = vi.fn().mockResolvedValue({
      balance: 25n,
      pendingBalance: 3n,
      debtBalance: 0n,
      lifetimeEarned: 40n,
      lifetimeSpent: 15n,
    })
    ;(repo as any).listBuyerCoinLedger = vi.fn().mockResolvedValue([{
      id: 'coin-entry-1',
      type: 'EARNED',
      status: 'AVAILABLE',
      amount: 10n,
      reason: '1% order cashback',
      orderId: 'order-1',
      createdAt: new Date('2026-05-13T00:00:00.000Z'),
    }])

    await expect(Promise.resolve().then(() => (service as any).getBuyerCoins(
      { id: 'user-1', role: 'USER' },
      20,
    ))).resolves.toEqual({
      balance: 25n,
      pendingBalance: 3n,
      debtBalance: 0n,
      lifetimeEarned: 40n,
      lifetimeSpent: 15n,
      entries: [expect.objectContaining({ id: 'coin-entry-1', amount: 10n })],
      nextCursor: null,
    })
    expect(repo.listBuyerCoinLedger).toHaveBeenCalledWith('user-1', 21, undefined)
  })
})
