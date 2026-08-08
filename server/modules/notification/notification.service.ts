import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { RealtimeService } from '#server/modules/realtime'
import { NotificationServiceError } from './notification.errors.ts'
import type { INotificationRepository, NotificationRecord } from './notification.repository.ts'
import type { NotificationData, NotificationType } from './notification.types.ts'

export interface NotificationActor {
  id: string
  role: Role
}

export type NotificationScope = 'all' | 'seller'

export interface NotificationResponse {
  id: string
  type: string
  title: string
  body?: string
  data?: NotificationData
  readAt?: Date
  createdAt: Date
}

export class NotificationService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: INotificationRepository,
    private realtimeService?: RealtimeService,
  ) {
    this.logger = appContext.logger
  }

  async listNotifications(actor: NotificationActor, scope: NotificationScope = 'all'): Promise<NotificationResponse[]> {
    this.assertAuthenticated(actor)
    const notifications = await this.repo.findNotificationsForUser(actor.id)
    return notifications
      .filter((notification) => scope === 'all' || isSellerNotification(notification.type, notification.data))
      .map((notification) => this.toResponse(notification))
  }

  async getUnreadCount(actor: NotificationActor, scope: NotificationScope = 'all'): Promise<{ unreadCount: number }> {
    this.assertAuthenticated(actor)
    if (scope === 'seller') {
      const notifications = await this.repo.findNotificationsForUser(actor.id)
      return {
        unreadCount: notifications.filter((notification) => !notification.readAt && isSellerNotification(notification.type, notification.data)).length,
      }
    }
    return {
      unreadCount: await this.repo.countUnreadForUser(actor.id),
    }
  }

  async markAsRead(notificationId: string, userId: string): Promise<NotificationResponse> {
    const notification = await this.repo.findNotificationById(notificationId)
    if (!notification) throw new NotificationServiceError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND')
    if (notification.userId !== userId) {
      throw new NotificationServiceError('Notification does not belong to user', 403, 'NOTIFICATION_FORBIDDEN')
    }
    if (notification.readAt) return this.toResponse(notification)
    const response = this.toResponse(await this.repo.markAsRead(notification.id, new Date()))
    this.realtimeService?.publish('notification.read', `user:${userId}:notifications`, response)
    return response
  }

  async markAllAsRead(userId: string): Promise<{ updatedCount: number }> {
    const result = {
      updatedCount: await this.repo.markAllAsRead(userId, new Date()),
    }
    this.realtimeService?.publish('notification.read', `user:${userId}:notifications`, result)
    return result
  }

  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    body?: string | null,
    data?: NotificationData | null,
  ): Promise<NotificationResponse> {
    const notification = await this.repo.createNotification({
      userId,
      type,
      title: title.trim(),
      body: this.normalizeBody(body),
      data: this.normalizeData(data),
    })
    const response = this.toResponse(notification)
    this.realtimeService?.publish('notification.created', `user:${userId}:notifications`, response)
    return response
  }

  async notifyOrderPaid(orderId: string): Promise<void> {
    await this.bestEffort('notifyOrderPaid', async () => {
      const order = await this.repo.findOrderForNotification(orderId)
      if (!order) return
      await this.createNotification(
        order.userId,
        'order_paid',
        'Payment confirmed',
        `Order ${order.orderNumber} has been paid.`,
        { orderId: order.id, orderNo: order.orderNumber },
      )
    })
  }

  async notifyShipmentShipped(shipmentId: string): Promise<void> {
    await this.bestEffort('notifyShipmentShipped', async () => {
      const shipment = await this.repo.findShipmentForNotification(shipmentId)
      if (!shipment) return
      await this.createNotification(
        shipment.order.userId,
        'shipment_shipped',
        'Shipment shipped',
        `Order ${shipment.order.orderNumber} is on the way.`,
        {
          orderId: shipment.orderId,
          orderNo: shipment.order.orderNumber,
          shipmentId: shipment.id,
          trackingNo: shipment.trackingNumber,
          carrier: shipment.carrier,
        },
      )
    })
  }

  async notifyShipmentDelivered(shipmentId: string): Promise<void> {
    await this.bestEffort('notifyShipmentDelivered', async () => {
      const shipment = await this.repo.findShipmentForNotification(shipmentId)
      if (!shipment) return
      await this.createNotification(
        shipment.order.userId,
        'shipment_delivered',
        'Shipment delivered',
        `Order ${shipment.order.orderNumber} has been delivered.`,
        { orderId: shipment.orderId, orderNo: shipment.order.orderNumber, shipmentId: shipment.id },
      )
    })
  }

  async notifyRefundUpdated(refundId: string): Promise<void> {
    await this.bestEffort('notifyRefundUpdated', async () => {
      const refund = await this.repo.findRefundForNotification(refundId)
      if (!refund) return
      const type: NotificationType = refund.status === 'SUCCESS' ? 'refund_success' : 'refund_processing'
      await this.createNotification(
        refund.order.userId,
        type,
        refund.status === 'SUCCESS' ? 'Refund completed' : 'Refund updated',
        `Refund for order ${refund.order.orderNumber} is ${refund.status.toLowerCase()}.`,
        {
          orderId: refund.orderId,
          orderNo: refund.order.orderNumber,
          refundId: refund.id,
          status: refund.status.toLowerCase(),
        },
      )
    })
  }

  async markNotificationAsRead(actor: NotificationActor, notificationId: string): Promise<NotificationResponse> {
    this.assertAuthenticated(actor)
    return this.markAsRead(notificationId, actor.id)
  }

  async markAllNotificationsAsRead(actor: NotificationActor, scope: NotificationScope = 'all'): Promise<{ updatedCount: number }> {
    this.assertAuthenticated(actor)
    if (scope === 'seller') {
      const notifications = await this.repo.findNotificationsForUser(actor.id)
      const unreadSellerNotifications = notifications.filter((notification) => !notification.readAt && isSellerNotification(notification.type, notification.data))
      const readAt = new Date()
      await Promise.all(unreadSellerNotifications.map((notification) => this.repo.markAsRead(notification.id, readAt)))
      const result = { updatedCount: unreadSellerNotifications.length }
      this.realtimeService?.publish('notification.read', `user:${actor.id}:notifications`, result)
      return result
    }
    return this.markAllAsRead(actor.id)
  }

  private assertAuthenticated(actor: NotificationActor): void {
    if (!actor?.id) {
      throw new NotificationServiceError('Authentication required', 403, 'NOTIFICATION_FORBIDDEN')
    }
  }

  private normalizeBody(body: string | null | undefined): string | null {
    const trimmed = body?.trim()
    return trimmed ? trimmed : null
  }

  private normalizeData(data: NotificationData | null | undefined): NotificationData | null {
    return data && Object.keys(data).length > 0 ? data : null
  }

  private async bestEffort(name: string, callback: () => Promise<void>): Promise<void> {
    try {
      await callback()
    } catch (error) {
      this.logger.warn('NotificationService best-effort notification failed', {
        name,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private toResponse(notification: NotificationRecord): NotificationResponse {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      ...(notification.body ? { body: notification.body } : {}),
      ...(this.isObjectData(notification.data) ? { data: notification.data } : {}),
      ...(notification.readAt ? { readAt: notification.readAt } : {}),
      createdAt: notification.createdAt,
    }
  }

  private isObjectData(data: unknown): data is NotificationData {
    return Boolean(data) && typeof data === 'object' && !Array.isArray(data)
  }
}

function isSellerNotification(type: string, data: unknown): boolean {
  if (type.toLowerCase() === 'payout_paid') return true
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  const record = data as Record<string, unknown>
  if (record.audience === 'seller') return true
  // Older seller order_paid notifications were created without an audience marker;
  // buyer notifications include orderNo, while seller notifications do not.
  return type.toLowerCase() === 'order_paid' && typeof record.orderNo !== 'string'
}
