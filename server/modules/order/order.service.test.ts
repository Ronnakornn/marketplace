import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IOrderRepository, OrderRecord } from './order.repository.ts'
import { OrderService } from './order.service.ts'

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

function createRepoMock(): IOrderRepository {
  return {
    findBuyerOrders: vi.fn(),
    findBuyerOrderById: vi.fn(),
    findSellerShops: vi.fn(),
    findSellerOrders: vi.fn(),
    findSellerOrderById: vi.fn(),
  }
}

function createOrder(): OrderRecord {
  const now = new Date('2026-05-13T00:00:00.000Z')
  return {
    id: '13131313-1313-4131-8131-131313131313',
    checkoutId: '12121212-1212-4121-8121-121212121212',
    userId: 'buyer-1',
    orderNumber: 'ORD-TEST',
    status: 'PAID',
    paymentStatus: 'SUCCEEDED',
    subtotal: BigInt(5000),
    discountTotal: BigInt(0),
    shippingTotal: BigInt(500),
    taxTotal: BigInt(0),
    grandTotal: BigInt(5500),
    currency: 'USD',
    shippingName: 'Jane Buyer',
    shippingPhone: '0800000000',
    shippingLine1: '123 Market Road',
    shippingLine2: null,
    shippingCity: 'Bangkok',
    shippingRegion: 'Bangkok',
    shippingPostalCode: '10110',
    shippingCountry: 'TH',
    createdAt: now,
    updatedAt: now,
    items: [
      {
        id: 'item-shop-1',
        orderId: '13131313-1313-4131-8131-131313131313',
        shopId: 'shop-1',
        variantId: 'variant-1',
        productTitle: 'Shop 1 Tee',
        productSlug: 'shop-1-tee',
        variantTitle: 'Black / M',
        variantSku: 'TEE-BLK-M',
        shopName: 'Shop One',
        shopSlug: 'shop-one',
        quantity: 2,
        unitPrice: BigInt(1200),
        lineTotal: BigInt(2400),
        currency: 'USD',
        fulfillmentStatus: 'PENDING',
      },
      {
        id: 'item-shop-2',
        orderId: '13131313-1313-4131-8131-131313131313',
        shopId: 'shop-2',
        variantId: 'variant-2',
        productTitle: 'Shop 2 Bag',
        productSlug: 'shop-2-bag',
        variantTitle: 'Canvas',
        variantSku: 'BAG-CANVAS',
        shopName: 'Shop Two',
        shopSlug: 'shop-two',
        quantity: 1,
        unitPrice: BigInt(2600),
        lineTotal: BigInt(2600),
        currency: 'USD',
        fulfillmentStatus: 'PENDING',
      },
    ],
    shipments: [
      {
        id: 'shipment-1',
        orderId: '13131313-1313-4131-8131-131313131313',
        shopId: 'shop-1',
        status: 'PENDING_PACK',
        carrier: null,
        trackingNumber: null,
        shippedAt: null,
        deliveredAt: null,
        createdAt: now,
        updatedAt: now,
        items: [
          {
            id: 'shipment-item-1',
            shipmentId: 'shipment-1',
            orderItemId: 'item-shop-1',
            quantity: 2,
            orderItem: {
              id: 'item-shop-1',
              orderId: '13131313-1313-4131-8131-131313131313',
              shopId: 'shop-1',
              variantId: 'variant-1',
              productTitle: 'Shop 1 Tee',
              productSlug: 'shop-1-tee',
              variantTitle: 'Black / M',
              variantSku: 'TEE-BLK-M',
              shopName: 'Shop One',
              shopSlug: 'shop-one',
              quantity: 2,
              unitPrice: BigInt(1200),
              lineTotal: BigInt(2400),
              currency: 'USD',
              fulfillmentStatus: 'PENDING',
            },
          },
        ],
      },
      {
        id: 'shipment-2',
        orderId: '13131313-1313-4131-8131-131313131313',
        shopId: 'shop-2',
        status: 'PENDING_PACK',
        carrier: null,
        trackingNumber: null,
        shippedAt: null,
        deliveredAt: null,
        createdAt: now,
        updatedAt: now,
        items: [
          {
            id: 'shipment-item-2',
            shipmentId: 'shipment-2',
            orderItemId: 'item-shop-2',
            quantity: 1,
            orderItem: {
              id: 'item-shop-2',
              orderId: '13131313-1313-4131-8131-131313131313',
              shopId: 'shop-2',
              variantId: 'variant-2',
              productTitle: 'Shop 2 Bag',
              productSlug: 'shop-2-bag',
              variantTitle: 'Canvas',
              variantSku: 'BAG-CANVAS',
              shopName: 'Shop Two',
              shopSlug: 'shop-two',
              quantity: 1,
              unitPrice: BigInt(2600),
              lineTotal: BigInt(2600),
              currency: 'USD',
              fulfillmentStatus: 'PENDING',
            },
          },
        ],
      },
    ],
  } as OrderRecord
}

describe('OrderService', () => {
  let repo: IOrderRepository
  let service: OrderService

  beforeEach(() => {
    repo = createRepoMock()
    service = new OrderService(createAppContext(), repo)
    vi.clearAllMocks()
  })

  it('lets buyers list only their own orders and groups items by shop', async () => {
    vi.mocked(repo.findBuyerOrders).mockResolvedValue([createOrder()])

    const result = await service.listBuyerOrders({ id: 'buyer-1', role: 'USER' })

    expect(repo.findBuyerOrders).toHaveBeenCalledWith('buyer-1')
    expect(result).toHaveLength(1)
    expect(result[0]!.shops).toHaveLength(2)
    expect(result[0]!.shops[0]!.items).toHaveLength(1)
    expect(result[0]!.shipments[0]!.status).toBe('pending_pack')
    expect(result[0]!.totals.grandTotal).toBe(5500)
    expect(result[0]!.items[0]!.lineTotal).toBe(2400)
    expect(() => JSON.stringify(result)).not.toThrow()
  })

  it('does not let a buyer see another buyer order', async () => {
    vi.mocked(repo.findBuyerOrderById).mockResolvedValue(null)

    await expect(service.getBuyerOrder({ id: 'buyer-1', role: 'USER' }, 'order-other')).rejects.toMatchObject({
      code: 'ORDER_NOT_FOUND',
    })
    expect(repo.findBuyerOrderById).toHaveBeenCalledWith('order-other', 'buyer-1')
  })

  it('lets buyers view own order detail and tracking with shipments split by shop and item snapshots', async () => {
    vi.mocked(repo.findBuyerOrderById).mockResolvedValue(createOrder())

    const detail = await service.getBuyerOrder({ id: 'buyer-1', role: 'USER' }, '13131313-1313-4131-8131-131313131313')
    expect(detail.shops).toHaveLength(2)
    expect(detail.shops[0]!.items[0]!.productTitle).toBe('Shop 1 Tee')

    const tracking = await service.getBuyerOrderTracking({ id: 'buyer-1', role: 'USER' }, '13131313-1313-4131-8131-131313131313')
    expect(tracking).toMatchObject({
      orderId: '13131313-1313-4131-8131-131313131313',
      orderNo: 'ORD-TEST',
      orderStatus: 'PAID',
    })
    expect(tracking.shipments).toHaveLength(2)
    expect(tracking.shipments[0]).toMatchObject({
      shipmentId: 'shipment-1',
      shopId: 'shop-1',
      shopName: 'Shop One',
      status: 'pending_pack',
      trackingNo: null,
    })
    expect(tracking.shipments[0]!.items[0]).toMatchObject({
      id: 'item-shop-1',
      productTitle: 'Shop 1 Tee',
      variantSku: 'TEE-BLK-M',
      quantity: 2,
    })
    expect(tracking.shipments[0]!.timeline[0]).toMatchObject({
      status: 'pending_pack',
      label: 'Seller is preparing your order',
    })
    expect(tracking.shipments[0]).not.toHaveProperty('shippingAddress')
  })

  it('does not let a buyer view tracking for another buyer order', async () => {
    vi.mocked(repo.findBuyerOrderById).mockResolvedValue(null)

    await expect(service.getBuyerOrderTracking({ id: 'buyer-1', role: 'USER' }, 'order-other')).rejects.toMatchObject({
      code: 'ORDER_NOT_FOUND',
    })
  })

  it('lets sellers list own shop orders and hides other shop items in the same order', async () => {
    vi.mocked(repo.findSellerShops).mockResolvedValue([{ id: 'shop-1', name: 'Shop One', slug: 'shop-one' }])
    vi.mocked(repo.findSellerOrders).mockResolvedValue([createOrder()])

    const result = await service.listSellerOrders({ id: 'seller-1', role: 'USER' })

    expect(repo.findSellerOrders).toHaveBeenCalledWith(['shop-1'])
    expect(result[0]!.items).toHaveLength(1)
    expect(result[0]!.items[0]!.shopId).toBe('shop-1')
    expect(result[0]!.shipments).toHaveLength(1)
    expect(result[0]!.shipments[0]!.shopId).toBe('shop-1')
    expect(result[0]!.shops).toHaveLength(1)
  })
})
