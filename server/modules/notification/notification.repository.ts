import { Prisma } from '#generated/client/client.ts'
import type { Notification, Order, PrismaClient, Refund, ReturnRequest, Shipment } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { NotificationData, NotificationType } from './notification.types.ts'

export type NotificationScope = 'all' | 'seller'
export type NotificationCategory = 'all' | 'order' | 'payment' | 'refund' | 'chat' | 'promotion'
export interface NotificationPageInput { cursor?: string; limit?: number; category?: NotificationCategory }
export type NotificationRecord = Notification

function notificationFilter(userId: string, scope: NotificationScope, category: NotificationCategory = 'all') {
  const seller = scope === 'seller' ? Prisma.sql`AND (
    lower("type") = 'payout_paid' OR (
      jsonb_typeof("data") = 'object' AND (
        "data"->>'audience' = 'seller' OR (
          lower("type") = 'order_paid' AND jsonb_typeof("data"->'orderNo') IS DISTINCT FROM 'string'
        )
      )
    )
  )` : Prisma.empty
  const group = Prisma.sql`CASE
    WHEN lower("type") LIKE '%payment%' OR lower("type") LIKE '%payout%' THEN 'payment'
    WHEN lower("type") LIKE '%refund%' OR lower("type") LIKE '%return%' THEN 'refund'
    WHEN lower("type") LIKE '%chat%' THEN 'chat'
    WHEN lower("type") LIKE '%promo%' OR lower("type") LIKE '%coupon%' THEN 'promotion'
    ELSE 'order' END`
  return Prisma.sql`"userId" = ${userId}::uuid ${seller} ${category === 'all' ? Prisma.empty : Prisma.sql`AND (${group}) = ${category}`}`
}

export type NotificationOrder = Pick<Order, 'id' | 'orderNumber' | 'userId'>

export type NotificationShipment = Shipment & {
  order: Pick<Order, 'id' | 'orderNumber' | 'userId'>
}

export type NotificationRefund = Refund & {
  order: Pick<Order, 'id' | 'orderNumber' | 'userId'>
}

export type NotificationReturn = Pick<ReturnRequest, 'id' | 'orderId' | 'shopId' | 'userId'> & {
  order: Pick<Order, 'id' | 'orderNumber' | 'userId'>
  shop: { ownerId: string }
}

export interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  body?: string | null
  data?: NotificationData | null
}

export interface INotificationRepository {
  findRecipientForNotification?(userId: string): Promise<{ name: string; email: string } | null>
  createNotification(input: CreateNotificationInput): Promise<NotificationRecord>
  findNotificationsForUser(userId: string, scope: NotificationScope, page: Required<Pick<NotificationPageInput, 'limit'>> & NotificationPageInput): Promise<NotificationRecord[]>
  countUnreadForUser(userId: string, scope?: NotificationScope, excludeChat?: boolean): Promise<number>
  findNotificationById(notificationId: string): Promise<NotificationRecord | null>
  markAsRead(notificationId: string, readAt: Date): Promise<NotificationRecord>
  markAllAsRead(userId: string, readAt: Date, scope?: NotificationScope): Promise<number>
  findOrderForNotification(orderId: string): Promise<NotificationOrder | null>
  findSellerUserIdsForOrder(orderId: string): Promise<string[]>
  findReturnForNotification(returnId: string): Promise<NotificationReturn | null>
  findShipmentForNotification(shipmentId: string): Promise<NotificationShipment | null>
  findRefundForNotification(refundId: string): Promise<NotificationRefund | null>
}

export class PrismaNotificationRepository implements INotificationRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  findRecipientForNotification(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })
  }

  createNotification(input: CreateNotificationInput): Promise<NotificationRecord> {
    this.logger.info('PrismaNotificationRepository.createNotification', {
      userId: input.userId,
      type: input.type,
    })
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data as Prisma.InputJsonValue | undefined,
      },
    })
  }

  findNotificationsForUser(userId: string, scope: NotificationScope, page: Required<Pick<NotificationPageInput, 'limit'>> & NotificationPageInput): Promise<NotificationRecord[]> {
    // Resolve the owned cursor inside PostgreSQL to preserve timestamp precision and UUID ties.
    // A deleted or foreign cursor has no anchor and returns an empty terminal page.
    const cursor = page.cursor ? Prisma.sql`AND ("createdAt", "id") < (
      SELECT "createdAt", "id" FROM "Notification" WHERE "id" = ${page.cursor}::uuid AND "userId" = ${userId}::uuid
    )` : Prisma.empty
    return this.prisma.$queryRaw<NotificationRecord[]>(Prisma.sql`
      SELECT * FROM "Notification" WHERE ${notificationFilter(userId, scope, page.category)} ${cursor}
      ORDER BY "createdAt" DESC, "id" DESC LIMIT ${page.limit + 1}
    `)
  }

  async countUnreadForUser(userId: string, scope: NotificationScope = 'all', excludeChat = false): Promise<number> {
    const result = await this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT count(*) AS count FROM "Notification"
      WHERE ${notificationFilter(userId, scope)} AND "readAt" IS NULL
      ${excludeChat ? Prisma.sql`AND lower("type") NOT LIKE '%chat%'` : Prisma.empty}
    `)
    return Number(result[0]?.count ?? 0n)
  }

  findNotificationById(notificationId: string): Promise<NotificationRecord | null> {
    this.logger.debug('PrismaNotificationRepository.findNotificationById', { notificationId })
    return this.prisma.notification.findUnique({
      where: { id: notificationId },
    })
  }

  markAsRead(notificationId: string, readAt: Date): Promise<NotificationRecord> {
    this.logger.info('PrismaNotificationRepository.markAsRead', { notificationId })
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt },
    })
  }

  async markAllAsRead(userId: string, readAt: Date, scope: NotificationScope = 'all'): Promise<number> {
    return this.prisma.$executeRaw(Prisma.sql`
      UPDATE "Notification" SET "readAt" = ${readAt}
      WHERE ${notificationFilter(userId, scope)} AND "readAt" IS NULL
    `)
  }

  findOrderForNotification(orderId: string): Promise<NotificationOrder | null> {
    this.logger.debug('PrismaNotificationRepository.findOrderForNotification', { orderId })
    return this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
      },
    })
  }

  async findSellerUserIdsForOrder(orderId: string): Promise<string[]> {
    this.logger.debug('PrismaNotificationRepository.findSellerUserIdsForOrder', { orderId })
    const shops = await this.prisma.shop.findMany({
      where: { orderItems: { some: { orderId } } },
      select: { ownerId: true },
    })
    return [...new Set(shops.map((shop) => shop.ownerId))]
  }

  findReturnForNotification(returnId: string): Promise<NotificationReturn | null> {
    this.logger.debug('PrismaNotificationRepository.findReturnForNotification', { returnId })
    return this.prisma.returnRequest.findUnique({
      where: { id: returnId },
      select: {
        id: true,
        orderId: true,
        shopId: true,
        userId: true,
        order: { select: { id: true, orderNumber: true, userId: true } },
        shop: { select: { ownerId: true } },
      },
    })
  }

  findShipmentForNotification(shipmentId: string): Promise<NotificationShipment | null> {
    this.logger.debug('PrismaNotificationRepository.findShipmentForNotification', { shipmentId })
    return this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            userId: true,
          },
        },
      },
    })
  }

  findRefundForNotification(refundId: string): Promise<NotificationRefund | null> {
    this.logger.debug('PrismaNotificationRepository.findRefundForNotification', { refundId })
    return this.prisma.refund.findUnique({
      where: { id: refundId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            userId: true,
          },
        },
      },
    })
  }
}
