import type {
  Order,
  OrderItem,
  Payment,
  Prisma,
  PrismaClient,
  Product,
  ProductVariant,
  Refund,
  Shipment,
  Shop,
  User,
} from '#generated/client/client.ts'
import type { OrderStatus, ProductStatus, RefundStatus, Role, ShopStatus, UserStatus } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export interface AdminPaginationInput {
  page: number
  limit: number
}

export interface AdminPaginatedResult<T> {
  items: T[]
  total: number
}

export type AdminUserRecord = Pick<User, 'id' | 'name' | 'email' | 'role' | 'status' | 'createdAt' | 'updatedAt'>
export type AdminShopRecord = Shop & {
  owner: Pick<User, 'id' | 'name' | 'email' | 'status'>
}
export type AdminProductRecord = Product & {
  shop: Pick<Shop, 'id' | 'name' | 'slug' | 'status'>
  variants: Array<Pick<ProductVariant, 'id' | 'sku' | 'title' | 'priceCents' | 'currency' | 'status'>>
}
export type AdminOrderRecord = Order & {
  items: OrderItem[]
  payments: Payment[]
  shipments: Shipment[]
  refunds: Refund[]
}
export type AdminRefundRecord = Refund & {
  order: Pick<Order, 'id' | 'orderNumber' | 'status' | 'paymentStatus' | 'userId'>
  payment: Pick<Payment, 'id' | 'provider' | 'status' | 'amountCents' | 'currency'>
}

export interface AdminDashboardCounts {
  users: { total: number; buyers: number; sellers: number }
  shops: { total: number; active: number; suspended: number }
  products: { total: number; active: number; banned: number }
  orders: { total: number; paid: number; delivered: number; cancelled: number }
  refunds: { pending: number; success: number; failed: number }
}

export interface IAdminRepository {
  getDashboardCounts(): Promise<AdminDashboardCounts>
  listUsers(filters: { role?: Role; status?: UserStatus }, pagination: AdminPaginationInput): Promise<AdminPaginatedResult<AdminUserRecord>>
  findUserById(userId: string): Promise<User | null>
  updateUserStatus(userId: string, status: UserStatus): Promise<AdminUserRecord>
  listShops(filters: { status?: ShopStatus }, pagination: AdminPaginationInput): Promise<AdminPaginatedResult<AdminShopRecord>>
  findShopById(shopId: string): Promise<AdminShopRecord | null>
  updateShopStatus(shopId: string, status: ShopStatus): Promise<AdminShopRecord>
  listProducts(filters: { status?: ProductStatus }, pagination: AdminPaginationInput): Promise<AdminPaginatedResult<AdminProductRecord>>
  findProductById(productId: string): Promise<AdminProductRecord | null>
  updateProductStatus(productId: string, status: ProductStatus): Promise<AdminProductRecord>
  listOrders(filters: { status?: OrderStatus }, pagination: AdminPaginationInput): Promise<AdminPaginatedResult<AdminOrderRecord>>
  findOrderById(orderId: string): Promise<AdminOrderRecord | null>
  listRefunds(filters: { status?: RefundStatus }, pagination: AdminPaginationInput): Promise<AdminPaginatedResult<AdminRefundRecord>>
  findRefundById(refundId: string): Promise<AdminRefundRecord | null>
  updateRefundStatus(refundId: string, status: RefundStatus): Promise<AdminRefundRecord>
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const

const shopInclude = {
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
    },
  },
} as const

const productInclude = {
  shop: {
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
    },
  },
  variants: {
    select: {
      id: true,
      sku: true,
      title: true,
      priceCents: true,
      currency: true,
      status: true,
    },
    orderBy: { createdAt: 'asc' },
  },
} as const

const orderInclude = {
  items: { orderBy: { id: 'asc' } },
  payments: { orderBy: { createdAt: 'desc' } },
  shipments: { orderBy: { createdAt: 'asc' } },
  refunds: { orderBy: { createdAt: 'desc' } },
} as const

const refundInclude = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      userId: true,
    },
  },
  payment: {
    select: {
      id: true,
      provider: true,
      status: true,
      amountCents: true,
      currency: true,
    },
  },
} as const

export class PrismaAdminRepository implements IAdminRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  async getDashboardCounts(): Promise<AdminDashboardCounts> {
    this.logger.debug('PrismaAdminRepository.getDashboardCounts')
    const [
      totalUsers,
      buyers,
      sellers,
      totalShops,
      activeShops,
      suspendedShops,
      totalProducts,
      activeProducts,
      bannedProducts,
      totalOrders,
      paidOrders,
      deliveredOrders,
      cancelledOrders,
      pendingRefunds,
      successRefunds,
      failedRefunds,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'USER' } }),
      this.prisma.user.count({ where: { role: 'SELLER' } }),
      this.prisma.shop.count(),
      this.prisma.shop.count({ where: { status: 'ACTIVE' } }),
      this.prisma.shop.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.product.count(),
      this.prisma.product.count({ where: { status: 'ACTIVE' } }),
      this.prisma.product.count({ where: { status: 'ARCHIVED' } }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: 'PAID' } }),
      this.prisma.order.count({ where: { status: 'DELIVERED' } }),
      this.prisma.order.count({ where: { status: 'CANCELED' } }),
      this.prisma.refund.count({ where: { status: 'PENDING' } }),
      this.prisma.refund.count({ where: { status: 'SUCCESS' } }),
      this.prisma.refund.count({ where: { status: 'FAILED' } }),
    ])

    return {
      users: { total: totalUsers, buyers, sellers },
      shops: { total: totalShops, active: activeShops, suspended: suspendedShops },
      products: { total: totalProducts, active: activeProducts, banned: bannedProducts },
      orders: { total: totalOrders, paid: paidOrders, delivered: deliveredOrders, cancelled: cancelledOrders },
      refunds: { pending: pendingRefunds, success: successRefunds, failed: failedRefunds },
    }
  }

  listUsers(filters: { role?: Role; status?: UserStatus }, pagination: AdminPaginationInput): Promise<AdminPaginatedResult<AdminUserRecord>> {
    const where: Prisma.UserWhereInput = {
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    }
    return this.paginate(
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { createdAt: 'desc' },
        ...this.toSkipTake(pagination),
      }),
      this.prisma.user.count({ where }),
    )
  }

  findUserById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id: userId } })
  }

  updateUserStatus(userId: string, status: UserStatus): Promise<AdminUserRecord> {
    return this.prisma.user.update({ where: { id: userId }, data: { status }, select: userSelect })
  }

  listShops(filters: { status?: ShopStatus }, pagination: AdminPaginationInput): Promise<AdminPaginatedResult<AdminShopRecord>> {
    const where: Prisma.ShopWhereInput = filters.status ? { status: filters.status } : {}
    return this.paginate(
      this.prisma.shop.findMany({ where, include: shopInclude, orderBy: { createdAt: 'desc' }, ...this.toSkipTake(pagination) }),
      this.prisma.shop.count({ where }),
    )
  }

  findShopById(shopId: string): Promise<AdminShopRecord | null> {
    return this.prisma.shop.findUnique({ where: { id: shopId }, include: shopInclude })
  }

  updateShopStatus(shopId: string, status: ShopStatus): Promise<AdminShopRecord> {
    return this.prisma.shop.update({ where: { id: shopId }, data: { status }, include: shopInclude })
  }

  listProducts(filters: { status?: ProductStatus }, pagination: AdminPaginationInput): Promise<AdminPaginatedResult<AdminProductRecord>> {
    const where: Prisma.ProductWhereInput = filters.status ? { status: filters.status } : {}
    return this.paginate(
      this.prisma.product.findMany({ where, include: productInclude, orderBy: { createdAt: 'desc' }, ...this.toSkipTake(pagination) }),
      this.prisma.product.count({ where }),
    )
  }

  findProductById(productId: string): Promise<AdminProductRecord | null> {
    return this.prisma.product.findUnique({ where: { id: productId }, include: productInclude })
  }

  updateProductStatus(productId: string, status: ProductStatus): Promise<AdminProductRecord> {
    return this.prisma.product.update({ where: { id: productId }, data: { status }, include: productInclude })
  }

  listOrders(filters: { status?: OrderStatus }, pagination: AdminPaginationInput): Promise<AdminPaginatedResult<AdminOrderRecord>> {
    const where: Prisma.OrderWhereInput = filters.status ? { status: filters.status } : {}
    return this.paginate(
      this.prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: 'desc' }, ...this.toSkipTake(pagination) }),
      this.prisma.order.count({ where }),
    )
  }

  findOrderById(orderId: string): Promise<AdminOrderRecord | null> {
    return this.prisma.order.findUnique({ where: { id: orderId }, include: orderInclude })
  }

  listRefunds(filters: { status?: RefundStatus }, pagination: AdminPaginationInput): Promise<AdminPaginatedResult<AdminRefundRecord>> {
    const where: Prisma.RefundWhereInput = filters.status ? { status: filters.status } : {}
    return this.paginate(
      this.prisma.refund.findMany({ where, include: refundInclude, orderBy: { createdAt: 'desc' }, ...this.toSkipTake(pagination) }),
      this.prisma.refund.count({ where }),
    )
  }

  findRefundById(refundId: string): Promise<AdminRefundRecord | null> {
    return this.prisma.refund.findUnique({ where: { id: refundId }, include: refundInclude })
  }

  updateRefundStatus(refundId: string, status: RefundStatus): Promise<AdminRefundRecord> {
    return this.prisma.refund.update({ where: { id: refundId }, data: { status }, include: refundInclude })
  }

  private async paginate<T>(itemsPromise: Promise<T[]>, totalPromise: Promise<number>): Promise<AdminPaginatedResult<T>> {
    const [items, total] = await Promise.all([itemsPromise, totalPromise])
    return { items, total }
  }

  private toSkipTake(pagination: AdminPaginationInput) {
    return {
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    }
  }
}
