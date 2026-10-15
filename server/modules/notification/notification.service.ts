import type { Role } from '#generated/client/enums.ts'
import { randomUUID } from 'node:crypto'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { RealtimeService } from '#server/modules/realtime'
import { NotificationServiceError } from './notification.errors.ts'
import type { INotificationRepository, NotificationRecord, NotificationScope, NotificationPageInput } from './notification.repository.ts'
import type { NotificationData, NotificationType } from './notification.types.ts'
import type { PushService } from './push.service.ts'
import type { NotificationRuntimeConfig, NotificationEmailSender } from './notification-runtime.contract.ts'

export interface NotificationActor {
  id: string
  role: Role
}

export type { NotificationScope } from './notification.repository.ts'

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
    private realtimeService?: Pick<RealtimeService, 'publish'>,
    private pushService?: Pick<PushService, 'deliver'>,
    private runtimeConfig?: NotificationRuntimeConfig,
    private emailService?: NotificationEmailSender,
  ) {
    this.logger = appContext.logger
  }

  async listNotifications(actor: NotificationActor, scope: NotificationScope = 'all', page: NotificationPageInput = {}) {
    this.assertAuthenticated(actor)
    const limit = page.limit ?? 30
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (page.cursor !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(page.cursor))) {
      throw new NotificationServiceError('Invalid notification pagination', 400, 'NOTIFICATION_INVALID_PAGE')
    }
    const notifications = await this.repo.findNotificationsForUser(actor.id, scope, { ...page, limit })
    const items = notifications.slice(0, limit).map((notification) => this.toResponse(notification))
    return { items, nextCursor: notifications.length > limit ? items.at(-1)?.id ?? null : null }
  }

  async getUnreadCount(actor: NotificationActor, scope: NotificationScope = 'all', excludeChat = false): Promise<{ unreadCount: number }> {
    this.assertAuthenticated(actor)
    return { unreadCount: await this.repo.countUnreadForUser(actor.id, scope, excludeChat) }
  }

  async markAsRead(notificationId: string, userId: string): Promise<NotificationResponse> {
    const notification = await this.repo.findNotificationById(notificationId)
    if (!notification) throw new NotificationServiceError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND')
    if (notification.userId !== userId) {
      throw new NotificationServiceError('Notification does not belong to user', 403, 'NOTIFICATION_FORBIDDEN')
    }
    if (notification.readAt) return this.toResponse(notification)
    const response = this.toResponse(await this.repo.markAsRead(notification.id, new Date()))
    await this.realtimeService?.publish('notification.read', `user:${userId}:notifications`, response)
    return response
  }

  async markAllAsRead(userId: string): Promise<{ updatedCount: number }> {
    const result = {
      updatedCount: await this.repo.markAllAsRead(userId, new Date()),
    }
    await this.realtimeService?.publish('notification.read', `user:${userId}:notifications`, result)
    return result
  }

  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    body?: string | null,
    data?: NotificationData | null,
  ): Promise<NotificationResponse> {
    const channels = this.runtimeConfig ? await this.runtimeConfig.deliveryConfig() : { inApp: true, push: true, email: false }
    const recipient = this.runtimeConfig ? await this.repo.findRecipientForNotification?.(userId) : null
    const text = (value: unknown) => typeof value === 'string' ? value : undefined
    const sellerAudience = data?.audience === 'seller' || type === 'payout_paid' || type === 'payout_rejected' || text(data?.targetPath)?.startsWith('/seller/')
    const money = (value: unknown) => typeof value === 'bigint' ? value.toString() : typeof value === 'string' && /^(0|[1-9][0-9]*|-[1-9][0-9]*)$/.test(value) ? value : undefined
    const values = {
      name: recipient?.name,
      buyerName: text(data?.buyerName) ?? (sellerAudience ? undefined : recipient?.name),
      orderNumber: text(data?.orderNumber) ?? text(data?.orderNo),
      shopName: text(data?.shopName),
      trackingNumber: text(data?.trackingNumber) ?? text(data?.trackingNo),
      supportTicketNumber: text(data?.supportTicketNumber),
      amount: money(data?.amount),
      currency: text(data?.currency),
    }
    const render = async (channel: 'EMAIL' | 'PUSH' | 'IN_APP') => {
      try { return await this.runtimeConfig?.renderNotification({ key: type, channel, values }) }
      catch (error) {
        this.logger.warn('Notification template rendering failed', { type, channel, error: error instanceof Error ? error.message : String(error) })
        return null
      }
    }
    const [inAppTemplate, pushTemplate, emailTemplate] = await Promise.all([
      channels.inApp ? render('IN_APP') : null,
      channels.push ? render('PUSH') : null,
      channels.email ? render('EMAIL') : null,
    ])
    const input = {
      userId,
      type,
      title: inAppTemplate?.subject?.trim() || title.trim(),
      body: this.normalizeBody(inAppTemplate?.body ?? body),
      data: this.normalizeData(data),
    }
    const notification = channels.inApp ? await this.repo.createNotification(input) : { ...input, id: randomUUID(), readAt: null, createdAt: new Date() }
    const response = this.toResponse(notification)
    if (channels.inApp) await this.realtimeService?.publish('notification.created', `user:${userId}:notifications`, response)
    if (channels.push) await this.bestEffort('deliverPush', () => this.pushService?.deliver(userId, { ...response, title: pushTemplate?.subject?.trim() || title.trim(), body: this.normalizeBody(pushTemplate?.body ?? body) ?? undefined }) ?? Promise.resolve())
    const emailService = this.emailService
    if (channels.email && recipient?.email && emailService) await this.bestEffort('deliverEmail', () => emailService.sendMessage({ to: recipient.email, subject: emailTemplate?.subject?.trim() || title.trim(), text: emailTemplate?.body ?? body?.trim() ?? title.trim() }))
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

  async notifySellerOrderPaid(orderId: string): Promise<void> {
    await this.bestEffort('notifySellerOrderPaid', async () => {
      const sellerUserIds = await this.repo.findSellerUserIdsForOrder(orderId)
      const order = this.runtimeConfig ? await this.repo.findOrderForNotification(orderId) : null
      await Promise.all(sellerUserIds.map((sellerUserId) => this.createNotification(
        sellerUserId,
        'order_paid',
        'New paid order',
        'A buyer paid for an order from your shop.',
        { orderId, ...(order ? { orderNo: order.orderNumber } : {}), audience: 'seller', targetPath: '/seller/orders' },
      )))
    })
  }

  async notifyReturnRequested(returnId: string): Promise<void> {
    await this.bestEffort('notifyReturnRequested', async () => {
      const returnRecord = await this.repo.findReturnForNotification(returnId)
      if (!returnRecord) return
      await this.createNotification(
        returnRecord.shop.ownerId,
        'return_requested',
        'New return request',
        `A buyer requested a return for order ${returnRecord.order.orderNumber}.`,
        {
          returnId: returnRecord.id,
          orderId: returnRecord.orderId,
          audience: 'seller',
          targetPath: '/seller/returns',
        },
      )
    })
  }

  async notifyReturnDecision(returnId: string, decision: 'approved' | 'rejected'): Promise<void> {
    await this.bestEffort('notifyReturnDecision', async () => {
      const returnRecord = await this.repo.findReturnForNotification(returnId)
      if (!returnRecord) return
      const approved = decision === 'approved'
      await this.createNotification(
        returnRecord.userId,
        approved ? 'return_approved' : 'return_rejected',
        approved ? 'Return approved' : 'Return rejected',
        approved
          ? `Your return for order ${returnRecord.order.orderNumber} was approved. The refund is now processing.`
          : `Your return for order ${returnRecord.order.orderNumber} was rejected.`,
        {
          returnId: returnRecord.id,
          orderId: returnRecord.orderId,
          orderNo: returnRecord.order.orderNumber,
          targetPath: `/orders/${returnRecord.orderId}`,
        },
      )
    })
  }

  async notifyOrderCancelled(orderId: string, cause: 'payment_failed' | 'payment_expired'): Promise<void> {
    await this.bestEffort('notifyOrderCancelled', async () => {
      const order = await this.repo.findOrderForNotification(orderId)
      if (!order) return
      const expired = cause === 'payment_expired'
      await this.createNotification(
        order.userId,
        cause,
        expired ? 'Payment expired' : 'Payment failed',
        expired
          ? `Payment time for order ${order.orderNumber} expired. The order was cancelled and reserved items were released.`
          : `Payment for order ${order.orderNumber} failed. The order was cancelled and reserved items were released.`,
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
    const result = { updatedCount: await this.repo.markAllAsRead(actor.id, new Date(), scope) }
    await this.realtimeService?.publish('notification.read', `user:${actor.id}:notifications`, result)
    return result
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

  private toResponse(notification: Pick<NotificationRecord, 'id' | 'type' | 'title' | 'body' | 'readAt' | 'createdAt'> & { data?: unknown }): NotificationResponse {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      ...(notification.type === 'chat_message' ? { body: 'You received a new chat message.' } : notification.body ? { body: notification.body } : {}),
      ...(this.isObjectData(notification.data) ? { data: notification.data } : {}),
      ...(notification.readAt ? { readAt: notification.readAt } : {}),
      createdAt: notification.createdAt,
    }
  }

  private isObjectData(data: unknown): data is NotificationData {
    return Boolean(data) && typeof data === 'object' && !Array.isArray(data)
  }
}
