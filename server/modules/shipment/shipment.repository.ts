import type {
  FulfillmentStatus,
  Order,
  OrderStatus,
  OrderItem,
  PrismaClient,
  Shipment,
  ShipmentStatus,
  ShipmentItem,
  Shop,
  Prisma,
} from '#generated/client/client.ts'
import { listPage, listPageResult, type ListPageInput } from '#server/lib/list-page.ts'
import { escapeLikeLiteral } from '#server/lib/sql-like.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

type ShipmentTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

export type ShipmentWithItems = Shipment & {
  items: ShipmentItem[]
}

export type ShipmentOrderForCreation = Order & {
  items: OrderItem[]
  shipments: ShipmentWithItems[]
}

export type SellerShipment = Shipment & {
  order: Order & {
    shipments: Shipment[]
  }
  items: Array<ShipmentItem & {
    orderItem: OrderItem
  }>
}

export type BuyerShipment = Shipment & {
  order: Order
  items: Array<ShipmentItem & {
    orderItem: OrderItem
  }>
}

export interface ShipmentCreateInput {
  orderId: string
  shopId: string
  items: Array<{
    orderItemId: string
    quantity: number
  }>
}

export interface ShipmentListInput extends ListPageInput {
  q?: string
  status?: ShipmentStatus
  shopId?: string
}

const shipmentListSelect = {
  id: true, orderId: true, shopId: true, status: true, carrier: true, trackingNumber: true,
  order: { select: { orderNumber: true, shippingName: true, shippingPhone: true,
    shippingLine1: true, shippingLine2: true, shippingCity: true, shippingRegion: true,
    shippingPostalCode: true, shippingCountry: true } },
  items: { select: { id: true, orderItemId: true, quantity: true,
    orderItem: { select: { productTitle: true, productSlug: true, variantTitle: true, variantSku: true, fulfillmentStatus: true } },
  }, orderBy: { id: 'asc' } },
} satisfies Prisma.ShipmentSelect

export type SellerShipmentListRecord = Prisma.ShipmentGetPayload<{ select: typeof shipmentListSelect }>

export interface IShipmentCreationRepository {
  findOrderForShipmentCreation(orderId: string): Promise<ShipmentOrderForCreation | null>
  createShipment(input: ShipmentCreateInput): Promise<ShipmentWithItems>
}

export interface IShipmentRepository extends IShipmentCreationRepository {
  transaction<T>(callback: (repo: IShipmentRepository) => Promise<T>): Promise<T>
  lockShipmentOrder(shipmentId: string): Promise<void>
  findSellerShops(ownerId: string): Promise<Pick<Shop, 'id'>[]>
  findSellerShipments(shopIds: string[], input: ShipmentListInput): Promise<ReturnType<typeof listPageResult<SellerShipmentListRecord>>>
  findSellerShipmentById(shipmentId: string, shopIds: string[]): Promise<SellerShipment | null>
  findShipmentById(shipmentId: string): Promise<SellerShipment | null>
  findBuyerShipmentById(shipmentId: string, userId: string): Promise<BuyerShipment | null>
  updateShipmentPacked(shipmentId: string): Promise<SellerShipment>
  updateShipmentShipped(shipmentId: string, carrier: string, trackingNo: string, shippedAt: Date): Promise<SellerShipment>
  updateShipmentDelivered(shipmentId: string, deliveredAt: Date): Promise<SellerShipment>
  updateOrderItemsStatus(orderItemIds: string[], status: FulfillmentStatus): Promise<void>
  updateOrderStatus(orderId: string, status: OrderStatus): Promise<void>
}

const shipmentInclude = {
  items: true,
} as const

const sellerShipmentInclude = {
  order: {
    include: {
      shipments: true,
    },
  },
  items: {
    include: {
      orderItem: true,
    },
    orderBy: { id: 'asc' },
  },
} as const

const buyerShipmentInclude = {
  order: true,
  items: {
    include: {
      orderItem: true,
    },
    orderBy: { id: 'asc' },
  },
} as const

export class PrismaShipmentRepository implements IShipmentRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient | ShipmentTx,
  ) {
    this.logger = appContext.logger
  }

  transaction<T>(callback: (repo: IShipmentRepository) => Promise<T>): Promise<T> {
    const client = this.prisma as PrismaClient
    if (typeof client.$transaction !== 'function') {
      return callback(this)
    }

    return client.$transaction((tx) =>
      callback(new PrismaShipmentRepository({ logger: this.logger, config: { environment: 'transaction' } }, tx)),
    )
  }

  findOrderForShipmentCreation(orderId: string): Promise<ShipmentOrderForCreation | null> {
    this.logger.debug('PrismaShipmentRepository.findOrderForShipmentCreation', { orderId })
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        shipments: {
          include: shipmentInclude,
        },
      },
    })
  }

  async lockShipmentOrder(shipmentId: string): Promise<void> {
    // Serialize sibling shipment transitions before reading their aggregate state.
    // The caller holds this lock until its shipment/item/order transaction commits.
    await this.prisma.$queryRaw`
      SELECT "id" FROM "Order"
      WHERE "id" = (SELECT "orderId" FROM "Shipment" WHERE "id" = ${shipmentId}::uuid)
      FOR UPDATE
    `
  }

  async createShipment(input: ShipmentCreateInput): Promise<ShipmentWithItems> {
    this.logger.info('PrismaShipmentRepository.createShipment', {
      orderId: input.orderId,
      shopId: input.shopId,
    })
    const purchased = await this.prisma.shopOrder.findUnique({ where: { orderId_shopId: { orderId: input.orderId, shopId: input.shopId } }, select: { saleSnapshot: { select: { shippingProviderId: true, shippingProviderName: true } } } })
    const provider = purchased?.saleSnapshot?.shippingProviderId
      ? await this.prisma.shippingProvider.findUnique({ where: { id: purchased.saleSnapshot.shippingProviderId }, select: { id: true } }) : null
    return this.prisma.shipment.create({
      data: {
        orderId: input.orderId,
        shopId: input.shopId,
        status: 'PENDING_PACK',
        providerId: provider?.id ?? null,
        carrier: purchased?.saleSnapshot?.shippingProviderName ?? null,
        items: {
          create: input.items.map((item) => ({
            orderItemId: item.orderItemId,
            quantity: item.quantity,
          })),
        },
      },
      include: shipmentInclude,
    })
  }

  findSellerShops(ownerId: string): Promise<Pick<Shop, 'id'>[]> {
    this.logger.debug('PrismaShipmentRepository.findSellerShops', { ownerId })
    return this.prisma.shop.findMany({
      where: { ownerId, status: 'ACTIVE' },
      select: { id: true },
    })
  }

  async findSellerShipments(shopIds: string[], input: ShipmentListInput) {
    this.logger.debug('PrismaShipmentRepository.findSellerShipments', { shopIds })
    const allowed = input.shopId ? shopIds.filter((id) => id === input.shopId) : shopIds
    const q = input.q?.trim() ? escapeLikeLiteral(input.q.trim()) : undefined
    const where: Prisma.ShipmentWhereInput = {
      shopId: { in: allowed },
      ...(input.status ? { status: input.status } : {}),
      ...(q ? { OR: [
        { order: { orderNumber: { contains: q, mode: 'insensitive' } } },
        { order: { shippingName: { contains: q, mode: 'insensitive' } } },
        { items: { some: { orderItem: { productTitle: { contains: q, mode: 'insensitive' } } } } },
      ] } : {}),
    }
    const { skip, take } = listPage(input)
    const [data, totalCount] = await Promise.all([
      this.prisma.shipment.findMany({ where, select: shipmentListSelect, skip, take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      this.prisma.shipment.count({ where }),
    ])
    return listPageResult(data, totalCount, input)
  }

  findSellerShipmentById(shipmentId: string, shopIds: string[]): Promise<SellerShipment | null> {
    this.logger.debug('PrismaShipmentRepository.findSellerShipmentById', { shipmentId, shopIds })
    if (shopIds.length === 0) return Promise.resolve(null)

    return this.prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        shopId: { in: shopIds },
      },
      include: sellerShipmentInclude,
    })
  }

  findShipmentById(shipmentId: string): Promise<SellerShipment | null> {
    return this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: sellerShipmentInclude,
    })
  }

  findBuyerShipmentById(shipmentId: string, userId: string): Promise<BuyerShipment | null> {
    this.logger.debug('PrismaShipmentRepository.findBuyerShipmentById', { shipmentId, userId })
    return this.prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        order: {
          userId,
        },
      },
      include: buyerShipmentInclude,
    })
  }

  updateShipmentPacked(shipmentId: string): Promise<SellerShipment> {
    this.logger.info('PrismaShipmentRepository.updateShipmentPacked', { shipmentId })
    return this.updateShipment(shipmentId, { status: 'PACKED' })
  }

  updateShipmentShipped(shipmentId: string, carrier: string, trackingNo: string, shippedAt: Date): Promise<SellerShipment> {
    this.logger.info('PrismaShipmentRepository.updateShipmentShipped', { shipmentId })
    return this.updateShipment(shipmentId, {
      status: 'SHIPPED',
      carrier,
      trackingNumber: trackingNo,
      shippedAt,
    })
  }

  updateShipmentDelivered(shipmentId: string, deliveredAt: Date): Promise<SellerShipment> {
    this.logger.info('PrismaShipmentRepository.updateShipmentDelivered', { shipmentId })
    return this.updateShipment(shipmentId, {
      status: 'DELIVERED',
      deliveredAt,
    })
  }

  async updateOrderItemsStatus(orderItemIds: string[], status: FulfillmentStatus): Promise<void> {
    this.logger.info('PrismaShipmentRepository.updateOrderItemsStatus', { count: orderItemIds.length, status })
    if (orderItemIds.length === 0) return

    await this.prisma.orderItem.updateMany({
      where: {
        id: { in: orderItemIds },
      },
      data: {
        fulfillmentStatus: status,
      },
    })
  }

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    this.logger.info('PrismaShipmentRepository.updateOrderStatus', { orderId, status })
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status },
    })
  }

  private updateShipment(shipmentId: string, data: Partial<Pick<Shipment, 'status' | 'carrier' | 'trackingNumber' | 'shippedAt' | 'deliveredAt'>>): Promise<SellerShipment> {
    return this.prisma.shipment.update({
      where: { id: shipmentId },
      data: data as {
        status?: ShipmentStatus
        carrier?: string | null
        trackingNumber?: string | null
        shippedAt?: Date | null
        deliveredAt?: Date | null
      },
      include: sellerShipmentInclude,
    })
  }
}
