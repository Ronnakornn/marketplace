import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  FulfillmentStatus,
  OrderStatus,
  PaymentStatus,
  ProductStatus,
  Role,
  ShipmentStatus,
  VariantStatus,
} from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import { CacheService, type CacheClient } from '#server/modules/cache'
import type {
  ISellerDashboardRepository,
  SellerDashboardOrder,
  SellerLowStockVariant,
  SellerSalesOrderItem,
} from './seller-dashboard.repository.ts'
import { SellerDashboardService } from './seller-dashboard.service.ts'

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

function createRepoMock(): ISellerDashboardRepository {
  return {
    findSellerShops: vi.fn(),
    findSalesOrderItems: vi.fn(),
    findShipments: vi.fn(),
    countProductsByStatus: vi.fn(),
    findLowStockVariants: vi.fn(),
    findRecentOrders: vi.fn(),
  }
}

function createCacheService() {
  const store = new Map<string, string>()
  const client: CacheClient = {
    get: vi.fn(async (key) => store.get(key) ?? null),
    set: vi.fn(async (key, value) => {
      store.set(key, value)
      return 'OK'
    }),
    del: vi.fn(async (...keys) => {
      keys.forEach((key) => store.delete(key))
      return keys.length
    }),
    keys: vi.fn(async () => []),
  }
  return new CacheService(createAppContext(), {
    enabled: true,
    redisUrl: 'redis://localhost:6379',
    defaultTtlSeconds: 300,
    productTtlSeconds: 120,
    searchTtlSeconds: 60,
    sellerDashboardTtlSeconds: 30,
    keyPrefix: 'v1',
  }, client)
}

function createActor(role: Role = 'USER') {
  return {
    id: 'seller-1',
    role,
  }
}

const now = new Date()

function createSalesItem(overrides: Partial<{
  shopId: string
  lineTotal: number
  createdAt: Date
  status: OrderStatus
  paymentStatus: PaymentStatus
}> = {}): SellerSalesOrderItem {
  return {
    id: 'item-1',
    shopId: overrides.shopId ?? 'shop-1',
    lineTotal: overrides.lineTotal ?? 1000,
    quantity: 1,
    order: {
      id: 'order-1',
      orderNumber: 'ORD-1',
      status: overrides.status ?? 'PAID',
      paymentStatus: overrides.paymentStatus ?? 'SUCCEEDED',
      createdAt: overrides.createdAt ?? now,
    },
  }
}

function createOrderItem(overrides: Partial<{
  id: string
  shopId: string
  lineTotal: number
  fulfillmentStatus: FulfillmentStatus
}> = {}) {
  return {
    id: overrides.id ?? 'item-1',
    orderId: 'order-1',
    shopId: overrides.shopId ?? 'shop-1',
    variantId: 'variant-1',
    productTitle: 'Cotton Tee',
    productSlug: 'cotton-tee',
    variantTitle: 'Black / M',
    variantSku: 'TEE-BLK-M',
    shopName: 'Shop One',
    shopSlug: 'shop-one',
    quantity: 2,
    unitPrice: 1200,
    lineTotal: overrides.lineTotal ?? 2400,
    currency: 'USD',
    fulfillmentStatus: overrides.fulfillmentStatus ?? 'PENDING',
  }
}

function createRecentOrder(items = [createOrderItem()]): SellerDashboardOrder {
  return {
    id: 'order-1',
    orderNumber: 'ORD-1',
    status: 'PAID',
    paymentStatus: 'SUCCEEDED',
    createdAt: now,
    items,
  }
}

function createLowStockVariant(overrides: Partial<{
  quantityOnHand: number
  quantityReserved: number
  reorderLevel: number
  shopId: string
}> = {}): SellerLowStockVariant {
  return {
    id: 'variant-1',
    productId: 'product-1',
    sku: 'TEE-BLK-M',
    title: 'Black / M',
    prices: 1200,
    currency: 'USD',
    status: 'ACTIVE' as VariantStatus,
    createdAt: now,
    updatedAt: now,
    inventory: {
      id: 'inventory-1',
      variantId: 'variant-1',
      quantityOnHand: overrides.quantityOnHand ?? 3,
      quantityReserved: overrides.quantityReserved ?? 1,
      reorderLevel: overrides.reorderLevel ?? 5,
      updatedAt: now,
    },
    product: {
      id: 'product-1',
      title: 'Cotton Tee',
      slug: 'cotton-tee',
      shopId: overrides.shopId ?? 'shop-1',
      status: 'ACTIVE' as ProductStatus,
    },
  }
}

let repo: ISellerDashboardRepository
let service: SellerDashboardService

function setup() {
  repo = createRepoMock()
  service = new SellerDashboardService(createAppContext(), repo)
  vi.mocked(repo.findSellerShops).mockResolvedValue([{ id: 'shop-1', name: 'Shop One', slug: 'shop-one' }])
  vi.mocked(repo.findSalesOrderItems).mockResolvedValue([createSalesItem({ lineTotal: 1000 })])
  vi.mocked(repo.findShipments).mockResolvedValue([
    { id: 's1', status: 'PENDING_PACK' as ShipmentStatus },
    { id: 's2', status: 'SHIPPED' as ShipmentStatus },
    { id: 's3', status: 'DELIVERED' as ShipmentStatus },
    { id: 's4', status: 'CANCELED' as ShipmentStatus },
  ])
  vi.mocked(repo.countProductsByStatus).mockImplementation(async (_shopIds, active) => active ? 3 : 2)
  vi.mocked(repo.findLowStockVariants).mockResolvedValue([createLowStockVariant()])
  vi.mocked(repo.findRecentOrders).mockResolvedValue([createRecentOrder()])
}

describe('SellerDashboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setup()
  })

  it('lets seller view own dashboard', async () => {
    const result = await service.getDashboard(createActor())

    expect(repo.findSellerShops).toHaveBeenCalledWith('seller-1')
    expect(result).toMatchObject({
      sales: { totalSalesCents: 1000 },
      orders: { pendingPack: 1, shipped: 1, delivered: 1, cancelled: 1 },
      products: { active: 3, inactive: 2, lowStock: 1 },
    })
  })

  it('seller dashboard cache is shop-scoped', async () => {
    const cache = createCacheService()
    service = new SellerDashboardService(createAppContext(), repo, cache)

    await service.getDashboard(createActor())
    await service.getDashboard(createActor())
    expect(repo.findSalesOrderItems).toHaveBeenCalledTimes(1)

    vi.mocked(repo.findSellerShops).mockResolvedValue([{ id: 'shop-2', name: 'Shop Two', slug: 'shop-two' }])
    await service.getDashboard(createActor())

    expect(repo.findSalesOrderItems).toHaveBeenCalledTimes(2)
    expect(repo.findSalesOrderItems).toHaveBeenLastCalledWith(['shop-2'])
  })

  it('fails when a user has no active shop', async () => {
    vi.mocked(repo.findSellerShops).mockResolvedValue([])
    await expect(service.getDashboard(createActor())).rejects.toMatchObject({ code: 'SELLER_SHOP_NOT_ACTIVE' })
  })

  it('counts sales only for seller shop items returned by repository', async () => {
    vi.mocked(repo.findSalesOrderItems).mockResolvedValue([
      createSalesItem({ shopId: 'shop-1', lineTotal: 1000 }),
      createSalesItem({ shopId: 'shop-1', lineTotal: 2500 }),
    ])

    const result = await service.getSalesSummary(createActor())

    expect(repo.findSalesOrderItems).toHaveBeenCalledWith(['shop-1'])
    expect(result.totalSalesCents).toBe(3500)
  })

  it('recent orders include only seller items', async () => {
    vi.mocked(repo.findRecentOrders).mockResolvedValue([
      createRecentOrder([createOrderItem({ id: 'own-item', shopId: 'shop-1', lineTotal: 1500 })]),
    ])

    const result = await service.getRecentOrders(createActor(), 5)

    expect(repo.findRecentOrders).toHaveBeenCalledWith(['shop-1'], 5)
    expect(result[0]).toMatchObject({ totalCents: 1500 })
    expect(result[0]!.items).toHaveLength(1)
    expect(result[0]!.items[0]!.orderItemId).toBe('own-item')
  })

  it('low stock returns only seller variants that are at or below reorder level', async () => {
    vi.mocked(repo.findLowStockVariants).mockResolvedValue([
      createLowStockVariant({ quantityOnHand: 3, quantityReserved: 1, reorderLevel: 5 }),
      createLowStockVariant({ quantityOnHand: 10, quantityReserved: 0, reorderLevel: 2 }),
    ])

    const result = await service.getLowStock(createActor())

    expect(repo.findLowStockVariants).toHaveBeenCalledWith(['shop-1'])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      variantId: 'variant-1',
      availableQuantity: 2,
      reorderLevel: 5,
    })
  })

  it('dashboard works with no orders', async () => {
    vi.mocked(repo.findSalesOrderItems).mockResolvedValue([])
    vi.mocked(repo.findShipments).mockResolvedValue([])
    vi.mocked(repo.findRecentOrders).mockResolvedValue([])

    const result = await service.getDashboard(createActor())

    expect(result.sales.totalSalesCents).toBe(0)
    expect(result.orders).toEqual({ pendingPack: 0, shipped: 0, delivered: 0, cancelled: 0 })
    expect(result.recentOrders).toEqual([])
  })

  it('dashboard works with no products', async () => {
    vi.mocked(repo.countProductsByStatus).mockResolvedValue(0)
    vi.mocked(repo.findLowStockVariants).mockResolvedValue([])

    const result = await service.getDashboard(createActor())

    expect(result.products).toEqual({ active: 0, inactive: 0, lowStock: 0 })
    expect(result.lowStockItems).toEqual([])
  })
})
