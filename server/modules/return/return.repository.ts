import { moneyInteger } from '#server/lib/money.ts'
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
  Shipment,
  Upload,
} from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { calculateReturnRefund } from '#server/modules/refund/refund-amount.service.ts'
import { loadRefundSettlementState, saveRefundSettlementPlan } from '#server/modules/refund/refund.repository.ts'
import { ReturnServiceError } from './return.errors.ts'
import type { SettlementRefundState } from '#server/modules/refund/settlement-refund.service.ts'
import { createSettlementRefundPlan, invalidSettlementRefund } from '#server/modules/refund/settlement-refund.service.ts'

type ReturnTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

export type ReturnOrderItem = OrderItem & {
  order: Order & {
    payments: Payment[]
    refunds: Refund[]
    items: Array<Pick<OrderItem, 'shopId' | 'fulfillmentStatus'>>
    shipments: Array<Pick<Shipment, 'shopId' | 'status' | 'deliveredAt'>>
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

export type ReturnUpload = Pick<Upload, 'id' | 'userId' | 'usage' | 'status' | 'contentType' | 'publicUrl'>

export interface CreateReturnInput {
  orderId: string
  userId: string
  shopId: string
  orderItemId: string
  quantity: number
  reason: string
  description?: string | null
  images: string[]
}

export interface IReturnRepository {
  transaction<T>(callback: (repo: IReturnRepository) => Promise<T>): Promise<T>
  lockOrder(orderId: string): Promise<void>
  findReturnOrderId(returnId: string): Promise<string | null>
  findReturnSettlementState(orderId: string, currency: string): Promise<SettlementRefundState | null>
  findOrderItemForReturn(orderItemId: string): Promise<ReturnOrderItem | null>
  findUploadsByIds(uploadIds: string[]): Promise<ReturnUpload[]>
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
    private readonly inTransaction = false,
  ) {
    this.logger = appContext.logger
  }

  transaction<T>(callback: (repo: IReturnRepository) => Promise<T>): Promise<T> {
    if (this.inTransaction) return callback(this)
    const client = this.prisma as PrismaClient
    if (typeof client.$transaction !== 'function') return callback(new PrismaReturnRepository({ logger: this.logger, config: { environment: 'transaction' } }, this.prisma, true))

    return client.$transaction((tx) =>
      callback(new PrismaReturnRepository({ logger: this.logger, config: { environment: 'transaction' } }, tx, true)),
    )
  }

  async lockOrder(orderId: string): Promise<void> {
    await this.prisma.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId}::uuid FOR UPDATE`
  }

  async findReturnOrderId(returnId: string): Promise<string | null> {
    const reference = await this.prisma.returnRequest.findUnique({ where: { id: returnId }, select: { orderId: true } })
    return reference?.orderId ?? null
  }

  findReturnSettlementState(orderId: string, currency: string): Promise<SettlementRefundState | null> {
    return loadRefundSettlementState(this.prisma, orderId, currency)
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
            refunds: true,
            items: { select: { shopId: true, fulfillmentStatus: true } },
            shipments: { select: { shopId: true, status: true, deliveredAt: true } },
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

  findUploadsByIds(uploadIds: string[]): Promise<ReturnUpload[]> {
    this.logger.debug('PrismaReturnRepository.findUploadsByIds', { count: uploadIds.length })
    return this.prisma.upload.findMany({
      where: { id: { in: uploadIds } },
      select: {
        id: true,
        userId: true,
        usage: true,
        status: true,
        contentType: true,
        publicUrl: true,
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
        shopId: input.shopId,
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
    return this.updateRequestedReturn(returnId, status)
  }

  private async updateRequestedReturn(returnId: string, status: ReturnStatus): Promise<ReturnRecord> {
    const updated = await this.prisma.returnRequest.updateMany({ where: { id: returnId, status: 'REQUESTED' }, data: { status } })
    if (updated.count !== 1) throw new ReturnServiceError('Return is no longer requested', 409, 'INVALID_RETURN_STATE')
    return this.prisma.returnRequest.findUniqueOrThrow({ where: { id: returnId }, include: returnInclude })
  }

  async createPendingRefundForReturn(returnRecord: ReturnRecord): Promise<Refund> {
    if (!this.inTransaction) return this.transaction((repository) => repository.createPendingRefundForReturn(returnRecord))
    await this.lockOrder(returnRecord.orderId)
    const payment = returnRecord.order.payments.find((row) => row.status === 'SUCCEEDED')
    if (!payment) throw new Error('Refund requires a successful payment')
    const state = await loadRefundSettlementState(this.prisma, returnRecord.orderId, returnRecord.order.currency)
    if (state) {
      if (payment.orderId !== returnRecord.orderId || payment.currency !== returnRecord.order.currency || BigInt(payment.amount) !== BigInt(returnRecord.order.grandTotal)
        || returnRecord.items.some((item) => state.items.find((row) => row.id === item.orderItemId)?.shopId !== returnRecord.shopId)) invalidSettlementRefund()
      const existing = await this.prisma.refund.findUnique({ where: { returnRequestId: returnRecord.id } })
      if (existing) return existing
      const plan = createSettlementRefundPlan(state, { items: returnRecord.items.map((item) => ({ orderItemId: item.orderItemId, quantity: item.quantity })), shipping: [] })
      const refund = await this.prisma.refund.create({ data: { orderId: returnRecord.orderId, paymentId: payment.id, returnRequestId: returnRecord.id, status: 'PENDING', amount: plan.amount, reason: returnRecord.reason } })
      await saveRefundSettlementPlan(this.prisma, refund.id, plan)
      return refund
    }
    const [shopOrder, orderItems] = await Promise.all([
      this.prisma.shopOrder.findUniqueOrThrow({ where: { orderId_shopId: { orderId: returnRecord.orderId, shopId: returnRecord.shopId } }, select: { subtotal: true, discountTotal: true } }),
      this.prisma.orderItem.findMany({ where: { orderId: returnRecord.orderId, shopId: returnRecord.shopId }, select: { id: true, lineTotal: true, quantity: true } }),
    ])
    const amount = calculateReturnRefund(shopOrder, orderItems, returnRecord.items)
    this.logger.info('PrismaReturnRepository.createPendingRefundForReturn', {
      returnId: returnRecord.id,
      orderId: returnRecord.orderId,
      amount: moneyInteger(amount),
    })
    return this.prisma.refund.create({
      data: {
        orderId: returnRecord.orderId,
        paymentId: payment!.id,
        returnRequestId: returnRecord.id,
        status: 'PENDING',
        amount,
        reason: returnRecord.reason,
      },
    })
  }
}
