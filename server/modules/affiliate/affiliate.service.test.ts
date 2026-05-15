import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Affiliate, AffiliateClick, AffiliateCommission, AffiliateLink } from '#generated/client/client.ts'
import type { IAffiliateRepository } from './affiliate.repository.ts'
import { AffiliateService } from './affiliate.service.ts'

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

function createAppContext() {
  return {
    logger: createLogger(),
    config: { environment: 'test' },
  }
}

function createRepoMock(): IAffiliateRepository {
  return {
    transaction: vi.fn(async (callback) => callback(repo)),
    findOrCreateAffiliate: vi.fn(),
    findAffiliateByUserId: vi.fn(),
    findAffiliateById: vi.fn(),
    listAffiliates: vi.fn(),
    updateAffiliateStatus: vi.fn(),
    findLinkByCode: vi.fn(),
    findLinkById: vi.fn(),
    listLinksByUserId: vi.fn(),
    createLink: vi.fn(),
    updateLinkStatus: vi.fn(),
    productExists: vi.fn(),
    shopExists: vi.fn(),
    campaignExists: vi.fn(),
    searchTargets: vi.fn(),
    createClick: vi.fn(),
    findLatestAttributableClick: vi.fn(),
    findOrderForCommission: vi.fn(),
    findCommissionByOrderId: vi.fn(),
    createCommission: vi.fn(),
    getStats: vi.fn(),
  }
}

let repo: IAffiliateRepository

const now = new Date('2026-05-15T00:00:00.000Z')
const affiliate: Affiliate = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userId: '11111111-1111-4111-8111-111111111111',
  status: 'ACTIVE',
  createdAt: now,
  updatedAt: now,
}
const link: AffiliateLink = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  affiliateId: affiliate.id,
  code: 'CREATOR10',
  targetType: 'product',
  targetId: '22222222-2222-4222-8222-222222222222',
  status: 'ACTIVE',
  createdAt: now,
  updatedAt: now,
}
const click: AffiliateClick = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  affiliateId: affiliate.id,
  linkId: link.id,
  buyerUserId: '33333333-3333-4333-8333-333333333333',
  sessionId: 'session-1',
  refParam: 'creator',
  ipHash: 'hash',
  userAgentHash: 'ua',
  clickedAt: now,
  expiresAt: new Date('2026-06-14T00:00:00.000Z'),
}
const order = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  checkoutId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  userId: '33333333-3333-4333-8333-333333333333',
  orderNumber: 'ORD-1',
  status: 'PAID',
  paymentStatus: 'SUCCEEDED',
  subtotalCents: 10_000,
  discountTotalCents: 1_000,
  shippingTotalCents: 500,
  taxTotalCents: 0,
  grandTotalCents: 9_500,
  currency: 'USD',
  shippingName: 'Buyer',
  shippingPhone: null,
  shippingLine1: '1 Road',
  shippingLine2: null,
  shippingCity: 'Bangkok',
  shippingRegion: null,
  shippingPostalCode: '10110',
  shippingCountry: 'TH',
  createdAt: now,
  updatedAt: now,
  items: [
    {
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      orderId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      shopId: '44444444-4444-4444-8444-444444444444',
      variantId: '55555555-5555-4555-8555-555555555555',
      productTitle: 'Product',
      productSlug: 'product',
      variantTitle: 'Default',
      variantSku: 'SKU',
      shopName: 'Shop',
      shopSlug: 'shop',
      quantity: 1,
      unitPriceCents: 10_000,
      lineTotalCents: 10_000,
      currency: 'USD',
      fulfillmentStatus: 'PENDING',
    },
  ],
} as const

function setup() {
  repo = createRepoMock()
  vi.mocked(repo.findOrCreateAffiliate).mockResolvedValue(affiliate)
  vi.mocked(repo.findAffiliateById).mockResolvedValue({ ...affiliate, user: { id: affiliate.userId, email: 'a@test.dev', name: 'Creator' }, links: [link] })
  vi.mocked(repo.findLinkByCode).mockResolvedValue(null)
  vi.mocked(repo.findLinkById).mockResolvedValue({ ...link, affiliate })
  vi.mocked(repo.productExists).mockResolvedValue({ id: link.targetId })
  vi.mocked(repo.shopExists).mockResolvedValue({ id: link.targetId })
  vi.mocked(repo.campaignExists).mockResolvedValue({ id: link.targetId })
  vi.mocked(repo.searchTargets).mockResolvedValue([{ id: link.targetId, label: 'Product', description: 'Shop / product', type: 'product' }])
  vi.mocked(repo.createLink).mockResolvedValue(link)
  vi.mocked(repo.createClick).mockResolvedValue(click)
  vi.mocked(repo.findLatestAttributableClick).mockResolvedValue(click)
  vi.mocked(repo.findOrderForCommission).mockResolvedValue(order as never)
  vi.mocked(repo.findCommissionByOrderId).mockResolvedValue(null)
  vi.mocked(repo.createCommission).mockImplementation(async (input) => ({ id: 'commission-1', status: 'PENDING', createdAt: now, updatedAt: now, ...input }) as AffiliateCommission)
  vi.mocked(repo.getStats).mockResolvedValue({ clicks: 1, conversions: 1, commissionCents: 450 })
  return new AffiliateService(createAppContext(), repo, {
    enabled: true,
    attributionWindowDays: 30,
    commissionBps: 500,
    blockSelfReferral: true,
  })
}

describe('AffiliateService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('user can create affiliate link', async () => {
    const service = setup()
    const result = await service.createLink({ id: affiliate.userId }, {
      code: link.code,
      targetType: 'product',
      targetId: link.targetId,
    })

    expect(result).toEqual(link)
    expect(repo.productExists).toHaveBeenCalledWith(link.targetId)
    expect(repo.createLink).toHaveBeenCalledWith({
      userId: affiliate.id,
      code: link.code,
      targetType: 'product',
      targetId: link.targetId,
    })
  })

  it('duplicate affiliate code fails', async () => {
    const service = setup()
    vi.mocked(repo.findLinkByCode).mockResolvedValue({ ...link, affiliate })

    await expect(service.createLink({ id: affiliate.userId }, {
      code: link.code,
      targetType: 'product',
      targetId: link.targetId,
    })).rejects.toMatchObject({ code: 'AFFILIATE_CODE_EXISTS' })
  })

  it('invalid target fails', async () => {
    const service = setup()
    vi.mocked(repo.productExists).mockResolvedValue(null)

    await expect(service.createLink({ id: affiliate.userId }, {
      code: link.code,
      targetType: 'product',
      targetId: link.targetId,
    })).rejects.toMatchObject({ code: 'INVALID_AFFILIATE_TARGET' })
  })

  it('public click tracking works without storing raw ip or user agent', async () => {
    const service = setup()
    vi.mocked(repo.findLinkByCode).mockResolvedValue({ ...link, affiliate })

    const result = await service.trackClick({
      code: link.code,
      sessionId: 'session-1',
      refParam: 'creator',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    })

    expect(result.clickId).toBe(click.id)
    expect(repo.createClick).toHaveBeenCalledWith(expect.objectContaining({
      affiliateId: affiliate.id,
      linkId: link.id,
      ipHash: expect.not.stringMatching('127.0.0.1'),
      userAgentHash: expect.not.stringMatching('vitest'),
    }))
  })

  it('authenticated target search returns product shop and campaign options', async () => {
    const service = setup()

    await expect(service.searchTargets({ targetType: 'product', q: 'tee', limit: 5 })).resolves.toEqual({
      items: [{ id: link.targetId, label: 'Product', description: 'Shop / product', type: 'product' }],
    })
    expect(repo.searchTargets).toHaveBeenCalledWith({ targetType: 'product', q: 'tee', limit: 5 })
  })

  it('invalid target type fails target search', async () => {
    const service = setup()

    await expect(service.searchTargets({ targetType: 'unknown' as never })).rejects.toMatchObject({
      code: 'INVALID_AFFILIATE_TARGET',
    })
  })

  it('attribution window works', async () => {
    const service = setup()
    vi.mocked(repo.findLatestAttributableClick).mockResolvedValue(null)

    const result = await service.createCommissionForPaidOrder({ orderId: order.id, buyerUserId: order.userId, now })

    expect(result).toBeNull()
    expect(repo.createCommission).not.toHaveBeenCalled()
  })

  it('paid order creates affiliate commission once', async () => {
    const service = setup()

    const result = await service.createCommissionForPaidOrder({ orderId: order.id, buyerUserId: order.userId, now })

    expect(result?.commissionCents).toBe(450)
    expect(repo.createCommission).toHaveBeenCalledWith(expect.objectContaining({
      orderId: order.id,
      eligibleSubtotalCents: 9000,
      commissionBps: 500,
      commissionCents: 450,
    }))
  })

  it('duplicate payment webhook does not duplicate commission', async () => {
    const service = setup()
    vi.mocked(repo.findCommissionByOrderId).mockResolvedValue({ id: 'commission-1' } as AffiliateCommission)

    const result = await service.createCommissionForPaidOrder({ orderId: order.id, buyerUserId: order.userId, now })

    expect(result).toEqual({ id: 'commission-1' })
    expect(repo.createCommission).not.toHaveBeenCalled()
  })

  it('cancelled or refunded order does not create commission', async () => {
    const service = setup()
    vi.mocked(repo.findOrderForCommission).mockResolvedValue({ ...order, status: 'REFUNDED' } as never)

    const result = await service.createCommissionForPaidOrder({ orderId: order.id, buyerUserId: order.userId, now })

    expect(result).toBeNull()
    expect(repo.createCommission).not.toHaveBeenCalled()
  })

  it('self-referral is blocked', async () => {
    const service = setup()
    vi.mocked(repo.findAffiliateById).mockResolvedValue({
      ...affiliate,
      userId: order.userId,
      user: { id: order.userId, email: 'buyer@test.dev', name: 'Buyer' },
      links: [link],
    })

    await expect(service.createCommissionForPaidOrder({ orderId: order.id, buyerUserId: order.userId, now }))
      .rejects.toMatchObject({ code: 'AFFILIATE_FORBIDDEN' })
  })

  it('affiliate stats show clicks conversions and commission', async () => {
    const service = setup()

    await expect(service.getStats({ id: affiliate.userId })).resolves.toEqual({
      clicks: 1,
      conversions: 1,
      commissionCents: 450,
    })
  })

  it('admin can disable affiliate account', async () => {
    const service = setup()
    vi.mocked(repo.updateAffiliateStatus).mockResolvedValue({ ...affiliate, status: 'DISABLED' })

    const result = await service.updateAffiliateStatus(affiliate.id, 'DISABLED')

    expect(result.status).toBe('DISABLED')
    expect(repo.updateAffiliateStatus).toHaveBeenCalledWith(affiliate.id, 'DISABLED')
  })
})
