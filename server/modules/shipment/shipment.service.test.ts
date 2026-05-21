import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  BuyerShipment,
  IShipmentRepository,
  SellerShipment,
  ShipmentOrderForCreation,
} from './shipment.repository.ts'
import { ShipmentService } from './shipment.service.ts'

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

function createRepoMock(): IShipmentRepository {
  return {
    transaction: vi.fn(async (callback) => callback(repo)),
    findOrderForShipmentCreation: vi.fn(),
    createShipment: vi.fn(),
    findSellerShops: vi.fn(),
    findSellerShipments: vi.fn(),
    findSellerShipmentById: vi.fn(),
    findBuyerShipmentById: vi.fn(),
    updateShipmentPacked: vi.fn(),
    updateShipmentShipped: vi.fn(),
    updateShipmentDelivered: vi.fn(),
    updateOrderItemsStatus: vi.fn(),
    updateOrderStatus: vi.fn(),
  }
}

let repo: IShipmentRepository

function createPaidOrder(overrides: Partial<ShipmentOrderForCreation> = {}): any {
  const now = new Date('2026-05-13T00:00:00.000Z')
  return {
    id: 'order-1',
    checkoutId: 'checkout-1',
    userId: 'buyer-1',
    orderNumber: 'ORD-TEST',
    status: 'PAID',
    paymentStatus: 'SUCCEEDED',
    subtotal: 5000,
    discountTotal: 0,
    shippingTotal: 500,
    taxTotal: 0,
    grandTotal: 5500,
    currency: 'USD',
    shippingName: 'Jane Buyer',
    shippingPhone: null,
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
        id: 'item-1',
        orderId: 'order-1',
        shopId: 'shop-1',
        variantId: 'variant-1',
        productTitle: 'Shop 1 Tee',
        productSlug: 'shop-1-tee',
        variantTitle: 'Black / M',
        variantSku: 'TEE-BLK-M',
        shopName: 'Shop One',
        shopSlug: 'shop-one',
        quantity: 2,
        unitPrice: 1200,
        lineTotal: 2400,
        currency: 'USD',
        fulfillmentStatus: 'PENDING',
      },
      {
        id: 'item-2',
        orderId: 'order-1',
        shopId: 'shop-2',
        variantId: 'variant-2',
        productTitle: 'Shop 2 Bag',
        productSlug: 'shop-2-bag',
        variantTitle: 'Canvas',
        variantSku: 'BAG-CANVAS',
        shopName: 'Shop Two',
        shopSlug: 'shop-two',
        quantity: 1,
        unitPrice: 2600,
        lineTotal: 2600,
        currency: 'USD',
        fulfillmentStatus: 'PENDING',
      },
    ],
    shipments: [],
    ...overrides,
  } as ShipmentOrderForCreation
}

function createShipment(id: string, shopId: string, orderItemId: string, quantity: number): any {
  const now = new Date('2026-05-13T00:00:00.000Z')
  return {
    id,
    orderId: 'order-1',
    shopId,
    status: 'PENDING_PACK',
    carrier: null,
    trackingNumber: null,
    shippedAt: null,
    deliveredAt: null,
    createdAt: now,
    updatedAt: now,
    items: [
      {
        id: `${id}-item`,
        shipmentId: id,
        orderItemId,
        quantity,
      },
    ],
  }
}

function createSellerShipment(overrides: Partial<SellerShipment> = {}): any {
  const now = new Date('2026-05-13T00:00:00.000Z')
  const status = overrides.status ?? 'PENDING_PACK'
  return {
    id: overrides.id ?? 'shipment-1',
    orderId: overrides.orderId ?? 'order-1',
    shopId: overrides.shopId ?? 'shop-1',
    status,
    carrier: overrides.carrier ?? null,
    trackingNumber: overrides.trackingNumber ?? null,
    shippedAt: overrides.shippedAt ?? null,
    deliveredAt: overrides.deliveredAt ?? null,
    createdAt: now,
    updatedAt: now,
    order: overrides.order ?? {
      id: 'order-1',
      checkoutId: 'checkout-1',
      userId: 'buyer-1',
      orderNumber: 'ORD-TEST',
      status: 'PAID',
      paymentStatus: 'SUCCEEDED',
      subtotal: 2400,
      discountTotal: 0,
      shippingTotal: 500,
      taxTotal: 0,
      grandTotal: 2900,
      currency: 'USD',
      shippingName: 'Jane Buyer',
      shippingPhone: null,
      shippingLine1: '123 Market Road',
      shippingLine2: null,
      shippingCity: 'Bangkok',
      shippingRegion: 'Bangkok',
      shippingPostalCode: '10110',
      shippingCountry: 'TH',
      createdAt: now,
      updatedAt: now,
      shipments: [
        {
          id: 'shipment-1',
          orderId: 'order-1',
          shopId: 'shop-1',
          status,
          carrier: null,
          trackingNumber: null,
          shippedAt: null,
          deliveredAt: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
    items: overrides.items ?? [
      {
        id: 'shipment-item-1',
        shipmentId: 'shipment-1',
        orderItemId: 'item-1',
        quantity: 2,
        orderItem: {
          id: 'item-1',
          orderId: 'order-1',
          shopId: 'shop-1',
          variantId: 'variant-1',
          productTitle: 'Shop 1 Tee',
          productSlug: 'shop-1-tee',
          variantTitle: 'Black / M',
          variantSku: 'TEE-BLK-M',
          shopName: 'Shop One',
          shopSlug: 'shop-one',
          quantity: 2,
          unitPrice: 1200,
          lineTotal: 2400,
          currency: 'USD',
          fulfillmentStatus: 'PENDING',
        },
      },
    ],
    ...overrides,
  } as SellerShipment
}

function createBuyerShipment(overrides: Partial<BuyerShipment> = {}): any {
  const sellerShipment = createSellerShipment(overrides as Partial<SellerShipment>)
  return {
    ...sellerShipment,
    order: {
      ...sellerShipment.order,
      shipments: undefined as never,
    },
  } as BuyerShipment
}

describe('ShipmentService', () => {
  let service: ShipmentService

  beforeEach(() => {
    repo = createRepoMock()
    service = new ShipmentService(createAppContext(), repo)
    vi.clearAllMocks()
  })

  it('creates shipments split by shop with shipment items referencing order items', async () => {
    vi.mocked(repo.findOrderForShipmentCreation).mockResolvedValue(createPaidOrder())
    vi.mocked(repo.createShipment)
      .mockResolvedValueOnce(createShipment('shipment-1', 'shop-1', 'item-1', 2))
      .mockResolvedValueOnce(createShipment('shipment-2', 'shop-2', 'item-2', 1))

    const result = await service.createShipmentsForPaidOrder('order-1')

    expect(repo.transaction).toHaveBeenCalledOnce()
    expect(repo.createShipment).toHaveBeenCalledTimes(2)
    expect(repo.createShipment).toHaveBeenNthCalledWith(1, {
      orderId: 'order-1',
      shopId: 'shop-1',
      items: [{ orderItemId: 'item-1', quantity: 2 }],
    })
    expect(repo.createShipment).toHaveBeenNthCalledWith(2, {
      orderId: 'order-1',
      shopId: 'shop-2',
      items: [{ orderItemId: 'item-2', quantity: 1 }],
    })
    expect(result.map((shipment) => shipment.status)).toEqual(['PENDING_PACK', 'PENDING_PACK'])
  })

  it('is idempotent when shipments already exist', async () => {
    const existing = [
      createShipment('shipment-1', 'shop-1', 'item-1', 2),
      createShipment('shipment-2', 'shop-2', 'item-2', 1),
    ]
    vi.mocked(repo.findOrderForShipmentCreation).mockResolvedValue(createPaidOrder({ shipments: existing }))

    const result = await service.createShipmentsForPaidOrder('order-1')

    expect(result).toEqual(existing)
    expect(repo.createShipment).not.toHaveBeenCalled()
  })

  it('rejects unpaid orders and rolls back failed shipment creation', async () => {
    vi.mocked(repo.findOrderForShipmentCreation).mockResolvedValue(createPaidOrder({ status: 'PENDING_PAYMENT' }))
    await expect(service.createShipmentsForPaidOrder('order-1')).rejects.toMatchObject({ code: 'ORDER_NOT_PAID' })

    vi.mocked(repo.findOrderForShipmentCreation).mockResolvedValue(createPaidOrder())
    vi.mocked(repo.createShipment).mockRejectedValue(new Error('rollback marker'))
    await expect(service.createShipmentsForPaidOrder('order-1')).rejects.toThrow('rollback marker')
  })

  it('lets sellers view own shipments and rejects another shop shipment', async () => {
    vi.mocked(repo.findSellerShops).mockResolvedValue([{ id: 'shop-1' }])
    vi.mocked(repo.findSellerShipments).mockResolvedValue([createSellerShipment()])

    const list = await service.listSellerShipments({ id: 'seller-1', role: 'USER' })
    expect(list).toHaveLength(1)
    expect(list[0]!.shopId).toBe('shop-1')

    vi.mocked(repo.findSellerShipmentById).mockResolvedValue(null)
    await expect(service.getSellerShipment({ id: 'seller-1', role: 'USER' }, 'shipment-2')).rejects.toMatchObject({
      code: 'SHIPMENT_NOT_FOUND',
    })
  })

  it('lets buyers view tracking for their own shipment and hides seller/internal fields', async () => {
    vi.mocked(repo.findBuyerShipmentById).mockResolvedValue(createBuyerShipment({
      status: 'SHIPPED',
      carrier: 'DHL',
      trackingNumber: 'TRACK-1',
      shippedAt: new Date('2026-05-13T01:00:00.000Z'),
    }))

    const result = await service.getBuyerShipmentTracking({ id: 'buyer-1', role: 'USER' }, 'shipment-1')

    expect(repo.findBuyerShipmentById).toHaveBeenCalledWith('shipment-1', 'buyer-1')
    expect(result).toMatchObject({
      orderId: 'order-1',
      orderNo: 'ORD-TEST',
      orderStatus: 'PAID',
      shipments: [
        {
          shipmentId: 'shipment-1',
          shopId: 'shop-1',
          shopName: 'Shop One',
          carrier: 'DHL',
          trackingNo: 'TRACK-1',
          status: 'shipped',
        },
      ],
    })
    expect(result.shipments[0]!.items[0]).toMatchObject({
      id: 'item-1',
      productTitle: 'Shop 1 Tee',
      variantSku: 'TEE-BLK-M',
    })
    expect(result.shipments[0]!.timeline.map((event) => event.status)).toEqual(['pending_pack', 'packed', 'shipped'])
    expect(result.shipments[0]).not.toHaveProperty('shippingAddress')
  })

  it('does not let buyers view tracking for another buyer shipment', async () => {
    vi.mocked(repo.findBuyerShipmentById).mockResolvedValue(null)

    await expect(service.getBuyerShipmentTracking({ id: 'buyer-1', role: 'USER' }, 'shipment-2')).rejects.toMatchObject({
      code: 'SHIPMENT_NOT_FOUND',
    })
  })

  it('packs a pending shipment and updates order item statuses and order processing state', async () => {
    vi.mocked(repo.findSellerShops).mockResolvedValue([{ id: 'shop-1' }])
    vi.mocked(repo.findSellerShipmentById).mockResolvedValue(createSellerShipment({ status: 'PENDING_PACK' }))
    vi.mocked(repo.updateShipmentPacked).mockResolvedValue(createSellerShipment({ status: 'PACKED' }))

    const result = await service.packSellerShipment({ id: 'seller-1', role: 'USER' }, 'shipment-1')

    expect(result.status).toBe('packed')
    expect(repo.updateOrderItemsStatus).toHaveBeenCalledWith(['item-1'], 'PACKED')
    expect(repo.updateOrderStatus).toHaveBeenCalledWith('order-1', 'PROCESSING')
  })

  it('does not ship before pack and requires carrier and tracking number', async () => {
    vi.mocked(repo.findSellerShops).mockResolvedValue([{ id: 'shop-1' }])
    vi.mocked(repo.findSellerShipmentById).mockResolvedValue(createSellerShipment({ status: 'PENDING_PACK' }))

    await expect(service.shipSellerShipment({ id: 'seller-1', role: 'USER' }, 'shipment-1', {
      carrier: 'DHL',
      trackingNo: 'TRACK-1',
    })).rejects.toMatchObject({ code: 'INVALID_SHIPMENT_STATE' })

    await expect(service.shipSellerShipment({ id: 'seller-1', role: 'USER' }, 'shipment-1', {
      carrier: 'DHL',
      trackingNo: '',
    })).rejects.toMatchObject({ code: 'TRACKING_REQUIRED' })

    await expect(service.shipSellerShipment({ id: 'seller-1', role: 'USER' }, 'shipment-1', {
      carrier: '',
      trackingNo: 'TRACK-1',
    })).rejects.toMatchObject({ code: 'CARRIER_REQUIRED' })
  })

  it('ships a packed shipment with tracking and advances order status', async () => {
    vi.mocked(repo.findSellerShops).mockResolvedValue([{ id: 'shop-1' }])
    vi.mocked(repo.findSellerShipmentById).mockResolvedValue(createSellerShipment({ status: 'PACKED' }))
    vi.mocked(repo.updateShipmentShipped).mockResolvedValue(createSellerShipment({
      status: 'SHIPPED',
      carrier: 'DHL',
      trackingNumber: 'TRACK-1',
      order: createSellerShipment({ status: 'SHIPPED' }).order,
    }))

    const result = await service.shipSellerShipment({ id: 'seller-1', role: 'USER' }, 'shipment-1', {
      carrier: 'DHL',
      trackingNo: 'TRACK-1',
    })

    expect(result.status).toBe('shipped')
    expect(result.trackingNumber).toBe('TRACK-1')
    expect(repo.updateOrderItemsStatus).toHaveBeenCalledWith(['item-1'], 'SHIPPED')
    expect(repo.updateOrderStatus).toHaveBeenCalledWith('order-1', 'SHIPPED')
  })

  it('delivers shipped shipment and only marks order delivered when all shipments are delivered', async () => {
    const now = new Date('2026-05-13T00:00:00.000Z')
    const orderWithTwoShipments = {
      ...createSellerShipment().order,
      status: 'SHIPPED',
      shipments: [
        {
          id: 'shipment-1',
          orderId: 'order-1',
          shopId: 'shop-1',
          status: 'SHIPPED',
          carrier: null,
          trackingNumber: null,
          shippedAt: null,
          deliveredAt: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'shipment-2',
          orderId: 'order-1',
          shopId: 'shop-2',
          status: 'SHIPPED',
          carrier: null,
          trackingNumber: null,
          shippedAt: null,
          deliveredAt: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    } as SellerShipment['order']

    vi.mocked(repo.findSellerShops).mockResolvedValue([{ id: 'shop-1' }])
    vi.mocked(repo.findSellerShipmentById).mockResolvedValue(createSellerShipment({ status: 'SHIPPED', order: orderWithTwoShipments }))
    vi.mocked(repo.updateShipmentDelivered).mockResolvedValue(createSellerShipment({
      status: 'DELIVERED',
      order: {
        ...orderWithTwoShipments,
        shipments: [
          { ...orderWithTwoShipments.shipments[0]!, status: 'DELIVERED' },
          orderWithTwoShipments.shipments[1]!,
        ],
      },
    }))

    await service.deliverSellerShipment({ id: 'seller-1', role: 'USER' }, 'shipment-1')
    expect(repo.updateOrderItemsStatus).toHaveBeenCalledWith(['item-1'], 'DELIVERED')
    expect(repo.updateOrderStatus).not.toHaveBeenCalledWith('order-1', 'DELIVERED')

    vi.mocked(repo.updateShipmentDelivered).mockResolvedValue(createSellerShipment({
      status: 'DELIVERED',
      order: {
        ...orderWithTwoShipments,
        shipments: orderWithTwoShipments.shipments.map((shipment) => ({ ...shipment, status: 'DELIVERED' })),
      },
    }))

    await service.deliverSellerShipment({ id: 'seller-1', role: 'USER' }, 'shipment-1')
    expect(repo.updateOrderStatus).toHaveBeenCalledWith('order-1', 'DELIVERED')
  })

  it('rejects delivered shipment updates and rolls back failed item status update', async () => {
    vi.mocked(repo.findSellerShops).mockResolvedValue([{ id: 'shop-1' }])
    vi.mocked(repo.findSellerShipmentById).mockResolvedValue(createSellerShipment({ status: 'DELIVERED' }))

    await expect(service.packSellerShipment({ id: 'seller-1', role: 'USER' }, 'shipment-1')).rejects.toMatchObject({
      code: 'INVALID_SHIPMENT_STATE',
    })

    vi.mocked(repo.findSellerShipmentById).mockResolvedValue(createSellerShipment({ status: 'PENDING_PACK' }))
    vi.mocked(repo.updateShipmentPacked).mockResolvedValue(createSellerShipment({ status: 'PACKED' }))
    vi.mocked(repo.updateOrderItemsStatus).mockRejectedValue(new Error('rollback marker'))

    await expect(service.packSellerShipment({ id: 'seller-1', role: 'USER' }, 'shipment-1')).rejects.toThrow('rollback marker')
    expect(repo.updateOrderStatus).not.toHaveBeenCalledWith('order-1', 'PROCESSING')
  })
})
