import type {
  Order,
  OrderItem,
  Payment,
  Prisma,
  PrismaClient,
  Product,
  ProductVariant,
  Refund,
  ReturnItem,
  ReturnRequest,
  Shipment,
  Shop,
  User,
  Brand,
} from '#generated/client/client.ts'
import type { OrderStatus, ProductStatus, RefundStatus, ReturnStatus, Role, ShopStatus, UserStatus } from '#generated/client/enums.ts'
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

export interface AdminShopWriteInput {
  ownerId: string
  name: string
  slug: string
  status: ShopStatus
  contactEmail?: string
  contactPhone?: string
}

export interface AdminShopUpdateInput {
  ownerId?: string
  name?: string
  slug?: string
  status?: ShopStatus
}

export interface AdminBrandListFilters {
  q?: string
  isActive?: boolean
}

export interface AdminBrandWriteInput {
  name: string
  nameTh?: string | null
  nameEn?: string | null
  slug: string
  code?: string | null
  description?: string | null
  descriptionTh?: string | null
  descriptionEn?: string | null
  logoUrl?: string | null
  websiteUrl?: string | null
  countryCode?: string | null
  sortOrder?: number
  isFeatured?: boolean
  isActive?: boolean
}

export type AdminBrandUpdateInput = Partial<AdminBrandWriteInput>

export interface AdminUserCreateInput {
  id: string
  name: string
  email: string
  role: Role
}

export interface AdminUserUpdateInput {
  name?: string
  email?: string
  role?: Role
  status?: UserStatus
}

export type AdminUserRecord = Pick<User, 'id' | 'name' | 'email' | 'role' | 'status' | 'createdAt' | 'updatedAt'>
export type AdminBrandRecord = Brand
export type AdminShopRecord = Shop & {
  owner: Pick<User, 'id' | 'name' | 'email' | 'status'>
}
export type AdminProductRecord = Product & {
  shop: Pick<Shop, 'id' | 'name' | 'slug' | 'status'>
  variants: Array<Pick<ProductVariant, 'id' | 'sku' | 'title' | 'price' | 'currency' | 'status'>>
}
export type AdminOrderRecord = Order & {
  items: OrderItem[]
  payments: Payment[]
  shipments: Shipment[]
  refunds: Array<Pick<Refund, 'id' | 'status' | 'amount' | 'reason' | 'createdAt'>>
}
export type AdminRefundRecord = Pick<Refund, 'id' | 'orderId' | 'paymentId' | 'status' | 'amount' | 'reason' | 'createdAt'> & {
  order: Pick<Order, 'id' | 'orderNumber' | 'status' | 'paymentStatus' | 'userId'>
  payment: Pick<Payment, 'id' | 'provider' | 'status' | 'amount' | 'currency'>
}
export type AdminReturnRecord = ReturnRequest & {
  order: Pick<Order, 'id' | 'orderNumber' | 'status' | 'paymentStatus' | 'userId' | 'currency'>
  user: Pick<User, 'id' | 'name' | 'email'>
  items: Array<ReturnItem & {
    orderItem: Pick<OrderItem, 'id' | 'shopId' | 'shopName' | 'productTitle' | 'variantTitle' | 'quantity' | 'lineTotal' | 'currency' | 'fulfillmentStatus'>
  }>
  refunds: Array<Pick<Refund, 'id' | 'status' | 'amount' | 'reason' | 'createdAt'>>
}

export interface AdminDashboardCounts {
  users: { total: number; buyers: number; sellers: number }
  shops: { total: number; active: number; suspended: number }
  products: { total: number; active: number; banned: number }
  orders: { total: number; paid: number; delivered: number; cancelled: number }
  refunds: { pending: number; success: number; failed: number }
  exceptions: {
    pendingPayments: number
    failedPayments: number
    delayedShipments: number
    returnEscalations: number
    refundEscalations: number
    pendingShops: number
    pendingProducts: number
    payoutApprovals: number
    fraudOpen: number
  }
}

export interface AdminReportMetrics {
  sales: { grossCents: number; paidOrderCount: number; averageOrderValueCents: number }
  orders: { total: number; pendingPayment: number; paid: number; shipped: number; delivered: number; cancelled: number; refunded: number }
  refunds: { totalCents: number; pending: number; processing: number; success: number; failed: number }
  payouts: { requestedCents: number; approvedCents: number; paidCents: number; requested: number; approved: number; paid: number }
  commissions: { pendingCents: number; approvedCents: number; voidCents: number }
  marketplace: { users: number; sellers: number; shops: number; products: number; activeProducts: number }
}

export interface IAdminRepository {
  getDashboardCounts(): Promise<AdminDashboardCounts>
  getReportMetrics(): Promise<AdminReportMetrics>
  listUsers(filters: { role?: Role; status?: UserStatus }, pagination: AdminPaginationInput): Promise<AdminPaginatedResult<AdminUserRecord>>
  findUserById(userId: string): Promise<User | null>
  findUserByEmail(email: string): Promise<User | null>
  countAdmins(excludeUserId?: string): Promise<number>
  createUser(input: AdminUserCreateInput): Promise<AdminUserRecord>
  updateUser(userId: string, input: AdminUserUpdateInput): Promise<AdminUserRecord>
  deleteUser(userId: string): Promise<AdminUserRecord>
  updateUserStatus(userId: string, status: UserStatus): Promise<AdminUserRecord>
  listBrands(filters: AdminBrandListFilters, pagination: AdminPaginationInput): Promise<AdminPaginatedResult<AdminBrandRecord>>
  findBrandById(brandId: string): Promise<AdminBrandRecord | null>
  findBrandBySlug(slug: string): Promise<AdminBrandRecord | null>
  findBrandByCode(code: string): Promise<AdminBrandRecord | null>
  createBrand(input: AdminBrandWriteInput): Promise<AdminBrandRecord>
  updateBrand(brandId: string, input: AdminBrandUpdateInput): Promise<AdminBrandRecord>
  updateBrandActive(brandId: string, isActive: boolean): Promise<AdminBrandRecord>
  listShops(filters: { status?: ShopStatus }, pagination: AdminPaginationInput): Promise<AdminPaginatedResult<AdminShopRecord>>
  createShop(input: AdminShopWriteInput): Promise<AdminShopRecord>
  findShopById(shopId: string): Promise<AdminShopRecord | null>
  findShopBySlug(slug: string): Promise<AdminShopRecord | null>
  findUserForShopOwner(input: { ownerId?: string; ownerEmail?: string }): Promise<Pick<User, 'id' | 'role' | 'status'> | null>
  countShopBlockingRelations(shopId: string): Promise<number>
  updateShop(shopId: string, input: AdminShopUpdateInput): Promise<AdminShopRecord>
  updateShopStatus(shopId: string, status: ShopStatus): Promise<AdminShopRecord>
  deleteShop(shopId: string): Promise<AdminShopRecord>
  listProducts(filters: { status?: ProductStatus }, pagination: AdminPaginationInput): Promise<AdminPaginatedResult<AdminProductRecord>>
  findProductById(productId: string): Promise<AdminProductRecord | null>
  updateProductStatus(productId: string, status: ProductStatus): Promise<AdminProductRecord>
  listOrders(filters: { status?: OrderStatus; shopId?: string }, pagination: AdminPaginationInput): Promise<AdminPaginatedResult<AdminOrderRecord>>
  findOrderById(orderId: string): Promise<AdminOrderRecord | null>
  listRefunds(filters: { status?: RefundStatus }, pagination: AdminPaginationInput): Promise<AdminPaginatedResult<AdminRefundRecord>>
  findRefundById(refundId: string): Promise<AdminRefundRecord | null>
  updateRefundStatus(refundId: string, status: RefundStatus): Promise<AdminRefundRecord>
  listReturns(filters: { status?: ReturnStatus }, pagination: AdminPaginationInput): Promise<AdminPaginatedResult<AdminReturnRecord>>
  findReturnById(returnId: string): Promise<AdminReturnRecord | null>
  updateReturnStatus(returnId: string, status: ReturnStatus): Promise<AdminReturnRecord>
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
      price: true,
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
  refunds: {
    select: {
      id: true,
      status: true,
      amount: true,
      reason: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  },
} as const

const refundInclude = {
  id: true,
  orderId: true,
  paymentId: true,
  status: true,
  amount: true,
  reason: true,
  createdAt: true,
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
      amount: true,
      currency: true,
    },
  },
} satisfies Prisma.RefundSelect

const returnInclude = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      userId: true,
      currency: true,
    },
  },
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  items: {
    include: {
      orderItem: {
        select: {
          id: true,
          shopId: true,
          shopName: true,
          productTitle: true,
          variantTitle: true,
          quantity: true,
          lineTotal: true,
          currency: true,
          fulfillmentStatus: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  },
  refunds: {
    select: {
      id: true,
      status: true,
      amount: true,
      reason: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  },
} as const

const shipmentDelayCutoff = () => new Date(Date.now() - 72 * 60 * 60 * 1000)

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
      pendingPayments,
      failedPayments,
      delayedShipments,
      returnEscalations,
      refundEscalations,
      pendingShops,
      pendingProducts,
      payoutApprovals,
      fraudOpen,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'USER' } }),
      this.prisma.user.count({ where: { shops: { some: { status: 'ACTIVE' } } } }),
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
      this.prisma.payment.count({ where: { status: { in: ['PENDING', 'REQUIRES_ACTION'] } } }),
      this.prisma.payment.count({ where: { status: 'FAILED' } }),
      this.prisma.shipment.count({ where: { status: { in: ['PENDING_PACK', 'PACKED', 'PENDING', 'READY'] }, createdAt: { lt: shipmentDelayCutoff() } } }),
      this.prisma.returnRequest.count({ where: { status: { in: ['REQUESTED', 'APPROVED', 'RECEIVED'] } } }),
      this.prisma.refund.count({ where: { status: { in: ['PENDING', 'PROCESSING', 'FAILED'] } } }),
      this.prisma.shop.count({ where: { status: 'PENDING' } }),
      this.prisma.product.count({ where: { status: 'DRAFT' } }),
      this.prisma.sellerPayout.count({ where: { status: { in: ['requested', 'approved'] } } }),
      this.prisma.fraudCase.count({ where: { status: { in: ['OPEN', 'REVIEWED'] } } }),
    ])

    return {
      users: { total: totalUsers, buyers, sellers },
      shops: { total: totalShops, active: activeShops, suspended: suspendedShops },
      products: { total: totalProducts, active: activeProducts, banned: bannedProducts },
      orders: { total: totalOrders, paid: paidOrders, delivered: deliveredOrders, cancelled: cancelledOrders },
      refunds: { pending: pendingRefunds, success: successRefunds, failed: failedRefunds },
      exceptions: {
        pendingPayments,
        failedPayments,
        delayedShipments,
        returnEscalations,
        refundEscalations,
        pendingShops,
        pendingProducts,
        payoutApprovals,
        fraudOpen,
      },
    }
  }

  async getReportMetrics(): Promise<AdminReportMetrics> {
    this.logger.debug('PrismaAdminRepository.getReportMetrics')
    const [
      paidSales,
      paidOrderCount,
      totalOrders,
      pendingPaymentOrders,
      paidOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      refundedOrders,
      refundTotal,
      pendingRefunds,
      processingRefunds,
      successRefunds,
      failedRefunds,
      requestedPayouts,
      approvedPayouts,
      paidPayouts,
      pendingCommissions,
      approvedCommissions,
      voidCommissions,
      totalUsers,
      sellers,
      totalShops,
      totalProducts,
      activeProducts,
    ] = await Promise.all([
      this.prisma.order.aggregate({ where: { paymentStatus: 'SUCCEEDED' }, _sum: { grandTotal: true } }),
      this.prisma.order.count({ where: { paymentStatus: 'SUCCEEDED' } }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: 'PENDING_PAYMENT' } }),
      this.prisma.order.count({ where: { status: 'PAID' } }),
      this.prisma.order.count({ where: { status: 'SHIPPED' } }),
      this.prisma.order.count({ where: { status: 'DELIVERED' } }),
      this.prisma.order.count({ where: { status: 'CANCELED' } }),
      this.prisma.order.count({ where: { status: 'REFUNDED' } }),
      this.prisma.refund.aggregate({ _sum: { amount: true } }),
      this.prisma.refund.count({ where: { status: 'PENDING' } }),
      this.prisma.refund.count({ where: { status: 'PROCESSING' } }),
      this.prisma.refund.count({ where: { status: 'SUCCESS' } }),
      this.prisma.refund.count({ where: { status: 'FAILED' } }),
      this.prisma.sellerPayout.aggregate({ where: { status: 'requested' }, _sum: { amount: true }, _count: true }),
      this.prisma.sellerPayout.aggregate({ where: { status: 'approved' }, _sum: { amount: true }, _count: true }),
      this.prisma.sellerPayout.aggregate({ where: { status: 'paid' }, _sum: { amount: true }, _count: true }),
      this.prisma.affiliateCommission.aggregate({ where: { status: 'PENDING' }, _sum: { commission: true } }),
      this.prisma.affiliateCommission.aggregate({ where: { status: 'APPROVED' }, _sum: { commission: true } }),
      this.prisma.affiliateCommission.aggregate({ where: { status: 'VOID' }, _sum: { commission: true } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { shops: { some: { status: 'ACTIVE' } } } }),
      this.prisma.shop.count(),
      this.prisma.product.count(),
      this.prisma.product.count({ where: { status: 'ACTIVE' } }),
    ])
    const grossCents = Number(paidSales._sum.grandTotal ?? 0)
    return {
      sales: {
        grossCents,
        paidOrderCount,
        averageOrderValueCents: paidOrderCount === 0 ? 0 : Math.round(grossCents / paidOrderCount),
      },
      orders: { total: totalOrders, pendingPayment: pendingPaymentOrders, paid: paidOrders, shipped: shippedOrders, delivered: deliveredOrders, cancelled: cancelledOrders, refunded: refundedOrders },
      refunds: { totalCents: Number(refundTotal._sum.amount ?? 0), pending: pendingRefunds, processing: processingRefunds, success: successRefunds, failed: failedRefunds },
      payouts: {
        requestedCents: Number(requestedPayouts._sum.amount ?? 0),
        approvedCents: Number(approvedPayouts._sum.amount ?? 0),
        paidCents: Number(paidPayouts._sum.amount ?? 0),
        requested: requestedPayouts._count,
        approved: approvedPayouts._count,
        paid: paidPayouts._count,
      },
      commissions: {
        pendingCents: Number(pendingCommissions._sum.commission ?? 0),
        approvedCents: Number(approvedCommissions._sum.commission ?? 0),
        voidCents: Number(voidCommissions._sum.commission ?? 0),
      },
      marketplace: { users: totalUsers, sellers, shops: totalShops, products: totalProducts, activeProducts },
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

  findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } })
  }

  countAdmins(excludeUserId?: string): Promise<number> {
    return this.prisma.user.count({
      where: {
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerified: true,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
    })
  }

  createUser(input: AdminUserCreateInput): Promise<AdminUserRecord> {
    return this.prisma.user.update({
      where: { id: input.id },
      data: { name: input.name, email: input.email, role: input.role },
      select: userSelect,
    })
  }

  updateUser(userId: string, input: AdminUserUpdateInput): Promise<AdminUserRecord> {
    return this.prisma.user.update({ where: { id: userId }, data: input, select: userSelect })
  }

  deleteUser(userId: string): Promise<AdminUserRecord> {
    return this.prisma.user.delete({ where: { id: userId }, select: userSelect })
  }

  updateUserStatus(userId: string, status: UserStatus): Promise<AdminUserRecord> {
    return this.prisma.user.update({ where: { id: userId }, data: { status }, select: userSelect })
  }

  listBrands(filters: AdminBrandListFilters, pagination: AdminPaginationInput): Promise<AdminPaginatedResult<AdminBrandRecord>> {
    const where: Prisma.BrandWhereInput = {
      ...(filters.isActive === undefined ? {} : { isActive: filters.isActive }),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: 'insensitive' } },
              { nameTh: { contains: filters.q, mode: 'insensitive' } },
              { nameEn: { contains: filters.q, mode: 'insensitive' } },
              { slug: { contains: filters.q, mode: 'insensitive' } },
              { code: { contains: filters.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    }
    return this.paginate(
      this.prisma.brand.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], ...this.toSkipTake(pagination) }),
      this.prisma.brand.count({ where }),
    )
  }

  findBrandById(brandId: string): Promise<AdminBrandRecord | null> {
    return this.prisma.brand.findUnique({ where: { id: brandId } })
  }

  findBrandBySlug(slug: string): Promise<AdminBrandRecord | null> {
    return this.prisma.brand.findUnique({ where: { slug } })
  }

  findBrandByCode(code: string): Promise<AdminBrandRecord | null> {
    return this.prisma.brand.findUnique({ where: { code } })
  }

  createBrand(input: AdminBrandWriteInput): Promise<AdminBrandRecord> {
    return this.prisma.brand.create({ data: input })
  }

  updateBrand(brandId: string, input: AdminBrandUpdateInput): Promise<AdminBrandRecord> {
    return this.prisma.brand.update({ where: { id: brandId }, data: input })
  }

  updateBrandActive(brandId: string, isActive: boolean): Promise<AdminBrandRecord> {
    return this.prisma.brand.update({ where: { id: brandId }, data: { isActive } })
  }

  listShops(filters: { status?: ShopStatus }, pagination: AdminPaginationInput): Promise<AdminPaginatedResult<AdminShopRecord>> {
    const where: Prisma.ShopWhereInput = filters.status ? { status: filters.status } : {}
    return this.paginate(
      this.prisma.shop.findMany({ where, include: shopInclude, orderBy: { createdAt: 'desc' }, ...this.toSkipTake(pagination) }),
      this.prisma.shop.count({ where }),
    )
  }

  async createShop(input: AdminShopWriteInput): Promise<AdminShopRecord> {
    const owner = await this.prisma.user.findUnique({
      where: { id: input.ownerId },
      select: { id: true, name: true, email: true },
    })
    if (!owner) throw new Error('Shop owner not found')

    const sellerProfile = await this.prisma.sellerProfile.upsert({
      where: { userId: owner.id },
      create: {
        userId: owner.id,
        displayName: owner.name,
        contactEmail: owner.email,
      },
      update: {},
      select: { id: true },
    })

    return this.prisma.shop.create({
      data: {
        ownerId: owner.id,
        sellerProfileId: sellerProfile.id,
        name: input.name,
        slug: input.slug,
        status: input.status,
        contactEmail: input.contactEmail ?? owner.email,
        contactPhone: input.contactPhone ?? 'N/A',
      },
      include: shopInclude,
    })
  }

  findShopById(shopId: string): Promise<AdminShopRecord | null> {
    return this.prisma.shop.findUnique({ where: { id: shopId }, include: shopInclude })
  }

  findShopBySlug(slug: string): Promise<AdminShopRecord | null> {
    return this.prisma.shop.findFirst({ where: { slug }, include: shopInclude })
  }

  findUserForShopOwner(input: { ownerId?: string; ownerEmail?: string }): Promise<Pick<User, 'id' | 'role' | 'status'> | null> {
    if (input.ownerId) {
      return this.prisma.user.findUnique({ where: { id: input.ownerId }, select: { id: true, role: true, status: true } })
    }
    if (input.ownerEmail) {
      return this.prisma.user.findUnique({ where: { email: input.ownerEmail }, select: { id: true, role: true, status: true } })
    }
    return Promise.resolve(null)
  }

  async countShopBlockingRelations(shopId: string): Promise<number> {
    const [products, orderItems, shipments, coupons, chatThreads, followers, wallet, payouts] = await Promise.all([
      this.prisma.product.count({ where: { shopId } }),
      this.prisma.orderItem.count({ where: { shopId } }),
      this.prisma.shipment.count({ where: { shopId } }),
      this.prisma.coupon.count({ where: { shopId } }),
      this.prisma.chatThread.count({ where: { shopId } }),
      this.prisma.shopFollow.count({ where: { shopId } }),
      this.prisma.shopWallet.count({ where: { shopId } }),
      this.prisma.sellerPayout.count({ where: { shopId } }),
    ])
    return products + orderItems + shipments + coupons + chatThreads + followers + wallet + payouts
  }

  updateShop(shopId: string, input: AdminShopUpdateInput): Promise<AdminShopRecord> {
    return this.prisma.shop.update({ where: { id: shopId }, data: input, include: shopInclude })
  }

  updateShopStatus(shopId: string, status: ShopStatus): Promise<AdminShopRecord> {
    return this.prisma.shop.update({ where: { id: shopId }, data: { status }, include: shopInclude })
  }

  deleteShop(shopId: string): Promise<AdminShopRecord> {
    return this.prisma.shop.delete({ where: { id: shopId }, include: shopInclude })
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

  listOrders(filters: { status?: OrderStatus; shopId?: string }, pagination: AdminPaginationInput): Promise<AdminPaginatedResult<AdminOrderRecord>> {
    const where: Prisma.OrderWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.shopId ? { items: { some: { shopId: filters.shopId } } } : {}),
    }
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
      this.prisma.refund.findMany({ where, select: refundInclude, orderBy: { createdAt: 'desc' }, ...this.toSkipTake(pagination) }),
      this.prisma.refund.count({ where }),
    )
  }

  findRefundById(refundId: string): Promise<AdminRefundRecord | null> {
    return this.prisma.refund.findUnique({ where: { id: refundId }, select: refundInclude })
  }

  updateRefundStatus(refundId: string, status: RefundStatus): Promise<AdminRefundRecord> {
    return this.prisma.refund.update({ where: { id: refundId }, data: { status }, select: refundInclude })
  }

  listReturns(filters: { status?: ReturnStatus }, pagination: AdminPaginationInput): Promise<AdminPaginatedResult<AdminReturnRecord>> {
    const where: Prisma.ReturnRequestWhereInput = filters.status ? { status: filters.status } : {}
    return this.paginate(
      this.prisma.returnRequest.findMany({ where, include: returnInclude, orderBy: { createdAt: 'desc' }, ...this.toSkipTake(pagination) }),
      this.prisma.returnRequest.count({ where }),
    )
  }

  findReturnById(returnId: string): Promise<AdminReturnRecord | null> {
    return this.prisma.returnRequest.findUnique({ where: { id: returnId }, include: returnInclude })
  }

  updateReturnStatus(returnId: string, status: ReturnStatus): Promise<AdminReturnRecord> {
    return this.prisma.returnRequest.update({ where: { id: returnId }, data: { status }, include: returnInclude })
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
