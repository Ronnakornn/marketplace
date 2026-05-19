import type {
  Order,
  OrderItem,
  Payment,
  PrismaClient,
  Refund,
  ReturnItem,
  ReturnRequest,
  ReturnStatus,
  Shop,
} from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

type ReturnTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

export type ReturnOrderItem = OrderItem & {
  order: Order & {
    payments: Payment[]
  }
  returnItems: Array<ReturnItem & {
    returnRequest: Pick<ReturnRequest, 'id' | 'status'>
  }>
}

export type ReturnRecord = ReturnRequest & {
  order: Order & {
    payments: Payment[]
  }
  items: Array<ReturnItem & {
    orderItem: OrderItem
  }>
  refunds: Refund[]
}

export interface CreateReturnInput {
  orderId: string
  userId: string
  orderItemId: string
  quantity: number
  reason: string
  description?: string | null
  images: string[]
}

export interface IReturnRepository {
  transaction<T>(callback: (repo: IReturnRepository) => Promise<T>): Promise<T>
  findOrderItemForReturn(orderItemId: string): Promise<ReturnOrderItem | null>
  createReturn(input: CreateReturnInput): Promise<ReturnRecord>
  findBuyerReturns(userId: string): Promise<ReturnRecord[]>
  findBuyerReturnById(returnId: string, userId: string): Promise<ReturnRecord | null>
  findSellerShops(ownerId: string): Promise<Pick<Shop, 'id'>[]>
  findSellerReturns(shopIds: string[]): Promise<ReturnRecord[]>
  findSellerReturnById(returnId: string, shopIds: string[]): Promise<ReturnRecord | null>
  updateReturnStatus(returnId: string, status: ReturnStatus): Promise<ReturnRecord>
  createPendingRefundForReturn(returnRecord: ReturnRecord): Promise<Refund>
}

const returnInclude = {
  order: {
    include: {
      payments: {
        orderBy: { createdAt: 'desc' },
      },
    },
  },
  items: {
    include: {
      orderItem: true,
    },
    orderBy: { id: 'asc' },
  },
  refunds: {
    orderBy: { createdAt: 'desc' },
  },
} as const

export class PrismaReturnRepository implements IReturnRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient | ReturnTx,
  ) {
    this.logger = appContext.logger
  }

  transaction<T>(callback: (repo: IReturnRepository) => Promise<T>): Promise<T> {
    const client = this.prisma as PrismaClient
    if (typeof client.$transaction !== 'function') return callback(this)

    return client.$transaction((tx) =>
      callback(new PrismaReturnRepository({ logger: this.logger, config: { environment: 'transaction' } }, tx)),
    )
  }

  findOrderItemForReturn(orderItemId: string): Promise<ReturnOrderItem | null> {
    this.logger.debug('PrismaReturnRepository.findOrderItemForReturn', { orderItemId })
    return this.prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        order: {
          include: {
            payments: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        returnItems: {
          include: {
            returnRequest: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        },
      },
    })
  }

  createReturn(input: CreateReturnInput): Promise<ReturnRecord> {
    this.logger.info('PrismaReturnRepository.createReturn', {
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      userId: input.userId,
    })
    return this.prisma.returnRequest.create({
      data: {
        orderId: input.orderId,
        userId: input.userId,
        status: 'REQUESTED',
        reason: input.reason,
        description: input.description,
        images: input.images,
        items: {
          create: {
            orderItemId: input.orderItemId,
            quantity: input.quantity,
          },
        },
      },
      include: returnInclude,
    })
  }

  findBuyerReturns(userId: string): Promise<ReturnRecord[]> {
    this.logger.debug('PrismaReturnRepository.findBuyerReturns', { userId })
    return this.prisma.returnRequest.findMany({
      where: { userId },
      include: returnInclude,
      orderBy: { createdAt: 'desc' },
    })
  }

  findBuyerReturnById(returnId: string, userId: string): Promise<ReturnRecord | null> {
    this.logger.debug('PrismaReturnRepository.findBuyerReturnById', { returnId, userId })
    return this.prisma.returnRequest.findFirst({
      where: { id: returnId, userId },
      include: returnInclude,
    })
  }

  findSellerShops(ownerId: string): Promise<Pick<Shop, 'id'>[]> {
    this.logger.debug('PrismaReturnRepository.findSellerShops', { ownerId })
    return this.prisma.shop.findMany({
      where: { ownerId, status: 'ACTIVE' },
      select: { id: true },
    })
  }

  findSellerReturns(shopIds: string[]): Promise<ReturnRecord[]> {
    this.logger.debug('PrismaReturnRepository.findSellerReturns', { shopIds })
    if (shopIds.length === 0) return Promise.resolve([])

    return this.prisma.returnRequest.findMany({
      where: {
        items: {
          some: {
            orderItem: {
              shopId: { in: shopIds },
            },
          },
        },
      },
      include: returnInclude,
      orderBy: { createdAt: 'desc' },
    })
  }

  findSellerReturnById(returnId: string, shopIds: string[]): Promise<ReturnRecord | null> {
    this.logger.debug('PrismaReturnRepository.findSellerReturnById', { returnId, shopIds })
    if (shopIds.length === 0) return Promise.resolve(null)

    return this.prisma.returnRequest.findFirst({
      where: {
        id: returnId,
        items: {
          some: {
            orderItem: {
              shopId: { in: shopIds },
            },
          },
        },
      },
      include: returnInclude,
    })
  }

  updateReturnStatus(returnId: string, status: ReturnStatus): Promise<ReturnRecord> {
    this.logger.info('PrismaReturnRepository.updateReturnStatus', { returnId, status })
    return this.prisma.returnRequest.update({
      where: { id: returnId },
      data: { status },
      include: returnInclude,
    })
  }

  createPendingRefundForReturn(returnRecord: ReturnRecord): Promise<Refund> {
    const orderItem = returnRecord.items[0]?.orderItem
    const payment = returnRecord.order.payments?.find((row) => row.status === 'SUCCEEDED') ?? returnRecord.order.payments?.[0]
    this.logger.info('PrismaReturnRepository.createPendingRefundForReturn', {
      returnId: returnRecord.id,
      orderId: returnRecord.orderId,
      amount: orderItem?.lineTotal,
    })
    return this.prisma.refund.create({
      data: {
        orderId: returnRecord.orderId,
        paymentId: payment!.id,
        returnRequestId: returnRecord.id,
        status: 'PENDING',
        amount: orderItem!.lineTotal,
        reason: returnRecord.reason,
      },
    })
  }
}
