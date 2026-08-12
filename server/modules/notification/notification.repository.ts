import type { Notification, Order, Prisma, PrismaClient, Refund, ReturnRequest, Shipment } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { NotificationData, NotificationType } from './notification.types.ts'

export type NotificationRecord = Notification

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
  createNotification(input: CreateNotificationInput): Promise<NotificationRecord>
  findNotificationsForUser(userId: string): Promise<NotificationRecord[]>
  countUnreadForUser(userId: string): Promise<number>
  findNotificationById(notificationId: string): Promise<NotificationRecord | null>
  markAsRead(notificationId: string, readAt: Date): Promise<NotificationRecord>
  markAllAsRead(userId: string, readAt: Date): Promise<number>
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

  findNotificationsForUser(userId: string): Promise<NotificationRecord[]> {
    this.logger.debug('PrismaNotificationRepository.findNotificationsForUser', { userId })
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
  }

  countUnreadForUser(userId: string): Promise<number> {
    this.logger.debug('PrismaNotificationRepository.countUnreadForUser', { userId })
    return this.prisma.notification.count({
      where: {
        userId,
        readAt: null,
      },
    })
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

  async markAllAsRead(userId: string, readAt: Date): Promise<number> {
    this.logger.info('PrismaNotificationRepository.markAllAsRead', { userId })
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: { readAt },
    })
    return result.count
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
