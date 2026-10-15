import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import { InMemoryRealtimeAdapter, RealtimeService } from '#server/modules/realtime'
import type { INotificationRepository, NotificationRecord } from './notification.repository.ts'
import { NotificationService } from './notification.service.ts'
import type { NotificationRuntimeConfig } from './notification-runtime.contract.ts'

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

function createRepoMock(): INotificationRepository {
  return {
    createNotification: vi.fn(),
    findNotificationsForUser: vi.fn(),
    countUnreadForUser: vi.fn(),
    findNotificationById: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    findOrderForNotification: vi.fn(),
    findSellerUserIdsForOrder: vi.fn(),
    findReturnForNotification: vi.fn(),
    findShipmentForNotification: vi.fn(),
    findRefundForNotification: vi.fn(),
  }
}

function createActor(role: Role = 'USER') {
  return {
    id: 'user-1',
    role,
  }
}

const now = new Date('2026-05-13T00:00:00.000Z')

function createNotification(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    id: overrides.id ?? '11111111-1111-4111-8111-111111111111',
    userId: overrides.userId ?? 'user-1',
    type: overrides.type ?? 'order_paid',
    title: overrides.title ?? 'Payment confirmed',
    body: overrides.body === undefined ? 'Order ORD-1 has been paid.' : overrides.body,
    data: overrides.data === undefined ? { orderId: 'order-1' } : overrides.data,
    readAt: overrides.readAt ?? null,
    createdAt: overrides.createdAt ?? now,
  }
}

let repo: INotificationRepository
let service: NotificationService

describe('NotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repo = createRepoMock()
    service = new NotificationService(createAppContext(), repo)
    vi.mocked(repo.findNotificationsForUser).mockResolvedValue([createNotification()])
    vi.mocked(repo.countUnreadForUser).mockResolvedValue(2)
    vi.mocked(repo.findNotificationById).mockResolvedValue(createNotification())
    vi.mocked(repo.markAsRead).mockImplementation(async (notificationId, readAt) =>
      createNotification({ id: notificationId, readAt }))
    vi.mocked(repo.markAllAsRead).mockResolvedValue(3)
    vi.mocked(repo.createNotification).mockImplementation(async (input) =>
      createNotification({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data as NotificationRecord['data'],
      }))
  })

  it('returns durable notification and read results when realtime transport rejects', async () => {
    const context = createAppContext()
    const adapter = new InMemoryRealtimeAdapter(context)
    const realtime = new RealtimeService(context, {
      findLiveSession: vi.fn(), findChatRoomAccess: vi.fn(), findShopOwnerId: vi.fn(),
    }, adapter)
    vi.spyOn(adapter, 'publish').mockRejectedValue(new Error('transport failure'))
    service = new NotificationService(context, repo, realtime)

    await expect(service.createNotification('user-1', 'chat_message', 'New message', 'Hello')).resolves.toMatchObject({
      id: '11111111-1111-4111-8111-111111111111', title: 'New message', body: 'You received a new chat message.',
    })
    await expect(service.markAsRead('11111111-1111-4111-8111-111111111111', 'user-1')).resolves.toMatchObject({ readAt: expect.any(Date) })
    await expect(service.markAllAsRead('user-1')).resolves.toEqual({ updatedCount: 3 })
    expect(repo.createNotification).toHaveBeenCalledOnce()
    expect(repo.markAsRead).toHaveBeenCalledOnce()
    expect(repo.markAllAsRead).toHaveBeenCalledOnce()
    expect(context.logger.warn).toHaveBeenCalledWith('Realtime publication failed', expect.any(Object))
  })

  it('redacts legacy chat previews in list and read projections without changing other notification bodies', async () => {
    const chat = createNotification({ type: 'chat_message', body: 'Removed private message' })
    vi.mocked(repo.findNotificationsForUser).mockResolvedValue([chat, createNotification({ id: 'order', body: 'Payment detail' })])
    expect((await service.listNotifications(createActor())).items.map((item) => item.body)).toEqual(['You received a new chat message.', 'Payment detail'])
    vi.mocked(repo.findNotificationById).mockResolvedValue({ ...chat, readAt: now })
    expect((await service.markAsRead(chat.id, chat.userId)).body).toBe('You received a new chat message.')
    expect(repo.markAsRead).not.toHaveBeenCalled()
  })

  it('lists only the authenticated user notifications', async () => {
    const result = await service.listNotifications(createActor())

    expect(repo.findNotificationsForUser).toHaveBeenCalledWith('user-1', 'all', { limit: 30 })
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      type: 'order_paid',
      data: { orderId: 'order-1' },
    })
  })

  it('delegates seller pagination to the repository', async () => {
    vi.mocked(repo.findNotificationsForUser).mockResolvedValue([createNotification({ id: 'seller' })])
    const result = await service.listNotifications(createActor(), 'seller', { category: 'payment', limit: 1 })
    expect(result.items.map((item) => item.id)).toEqual(['seller'])
    expect(repo.findNotificationsForUser).toHaveBeenCalledWith('user-1', 'seller', { category: 'payment', limit: 1 })
  })

  it('marks the seller scope as read with one bulk update', async () => {
    vi.mocked(repo.markAllAsRead).mockResolvedValue(1)
    await expect(service.markAllNotificationsAsRead(createActor(), 'seller')).resolves.toEqual({ updatedCount: 1 })
    expect(repo.markAllAsRead).toHaveBeenCalledWith('user-1', expect.any(Date), 'seller')
    expect(repo.markAsRead).not.toHaveBeenCalled()
    expect(repo.findNotificationsForUser).not.toHaveBeenCalled()
  })

  it('returns a bounded page and cursor for its last emitted row', async () => {
    vi.mocked(repo.findNotificationsForUser).mockResolvedValue([createNotification({ id: 'a' }), createNotification({ id: 'b' })])
    const page = await service.listNotifications(createActor(), 'all', { limit: 1 })
    expect(page.items.map((item) => item.id)).toEqual(['a'])
    expect(page.nextCursor).toBe('a')
  })

  it.each([0, -1, 101, 1.5, NaN])('rejects invalid page size %s before accessing the repository', async (limit) => {
    await expect(service.listNotifications(createActor(), 'all', { limit })).rejects.toMatchObject({ code: 'NOTIFICATION_INVALID_PAGE' })
    expect(repo.findNotificationsForUser).not.toHaveBeenCalled()
  })

  it('rejects invalid cursors and unauthenticated pages', async () => {
    await expect(service.listNotifications(createActor(), 'all', { cursor: 'invalid' })).rejects.toMatchObject({ code: 'NOTIFICATION_INVALID_PAGE' })
    await expect(service.listNotifications({ id: '', role: 'USER' })).rejects.toMatchObject({ code: 'NOTIFICATION_FORBIDDEN' })
    expect(repo.findNotificationsForUser).not.toHaveBeenCalled()
  })

  it('requests a scoped count with chat excluded only when requested', async () => {
    await service.getUnreadCount(createActor(), 'seller', true)
    expect(repo.countUnreadForUser).toHaveBeenCalledWith('user-1', 'seller', true)
    expect(repo.findNotificationsForUser).not.toHaveBeenCalled()
  })

  it('does not let a user read another user notification', async () => {
    vi.mocked(repo.findNotificationById).mockResolvedValue(createNotification({ userId: 'other-user' }))

    await expect(service.markNotificationAsRead(createActor(), 'notification-1')).rejects.toMatchObject({
      code: 'NOTIFICATION_FORBIDDEN',
    })
  })

  it('counts only unread notifications through repository filter', async () => {
    await expect(service.getUnreadCount(createActor())).resolves.toEqual({ unreadCount: 2 })
    expect(repo.countUnreadForUser).toHaveBeenCalledWith('user-1', 'all', false)
  })

  it('marks an owned notification as read', async () => {
    const result = await service.markNotificationAsRead(createActor(), 'notification-1')

    expect(repo.markAsRead).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', expect.any(Date))
    expect(result.readAt).toBeInstanceOf(Date)
  })

  it('returns not found for missing notifications', async () => {
    vi.mocked(repo.findNotificationById).mockResolvedValue(null)

    await expect(service.markNotificationAsRead(createActor(), 'missing')).rejects.toMatchObject({
      code: 'NOTIFICATION_NOT_FOUND',
    })
  })

  it('marks all own notifications as read', async () => {
    await expect(service.markAllNotificationsAsRead(createActor())).resolves.toEqual({ updatedCount: 3 })
    expect(repo.markAllAsRead).toHaveBeenCalledWith('user-1', expect.any(Date), 'all')
  })

  it('creates notifications with JSON data', async () => {
    const result = await service.createNotification(
      'user-1',
      'shipment_shipped',
      ' Shipment shipped ',
      ' Your order is on the way. ',
      { shipmentId: 'shipment-1', nested: { ok: true } },
    )

    expect(repo.createNotification).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'shipment_shipped',
      title: 'Shipment shipped',
      body: 'Your order is on the way.',
      data: { shipmentId: 'shipment-1', nested: { ok: true } },
    })
    expect(result.data).toEqual({ shipmentId: 'shipment-1', nested: { ok: true } })
  })

  it('notifies the buyer when payment fails or expires', async () => {
    vi.mocked(repo.findOrderForNotification).mockResolvedValue({
      id: 'order-1', userId: 'user-1', orderNumber: 'ORD-1',
    })

    await service.notifyOrderCancelled('order-1', 'payment_failed')
    await service.notifyOrderCancelled('order-1', 'payment_expired')

    expect(repo.createNotification).toHaveBeenNthCalledWith(1, expect.objectContaining({
      userId: 'user-1', type: 'payment_failed', data: { orderId: 'order-1', orderNo: 'ORD-1' },
    }))
    expect(repo.createNotification).toHaveBeenNthCalledWith(2, expect.objectContaining({
      userId: 'user-1', type: 'payment_expired', data: { orderId: 'order-1', orderNo: 'ORD-1' },
    }))
  })

  it('resolves shop owners for a paid order and notifies each seller once', async () => {
    vi.mocked(repo.findSellerUserIdsForOrder).mockResolvedValue(['seller-1', 'seller-2'])

    await service.notifySellerOrderPaid('order-1')

    expect(repo.createNotification).toHaveBeenCalledTimes(2)
    expect(repo.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'seller-1', type: 'order_paid',
      data: { orderId: 'order-1', audience: 'seller', targetPath: '/seller/orders' },
    }))
  })

  it('notifies the shop owner of a return request and the buyer of its decision', async () => {
    vi.mocked(repo.findReturnForNotification).mockResolvedValue({
      id: 'return-1', orderId: 'order-1', shopId: 'shop-1', userId: 'buyer-1',
      order: { id: 'order-1', orderNumber: 'ORD-1', userId: 'buyer-1' },
      shop: { ownerId: 'seller-1' },
    })

    await service.notifyReturnRequested('return-1')
    await service.notifyReturnDecision('return-1', 'approved')
    await service.notifyReturnDecision('return-1', 'rejected')

    expect(repo.createNotification).toHaveBeenNthCalledWith(1, expect.objectContaining({
      userId: 'seller-1', type: 'return_requested',
      data: expect.objectContaining({ audience: 'seller', targetPath: '/seller/returns' }),
    }))
    expect(repo.createNotification).toHaveBeenNthCalledWith(2, expect.objectContaining({
      userId: 'buyer-1', type: 'return_approved',
      body: expect.stringContaining('refund is now processing'),
    }))
    expect(repo.createNotification).toHaveBeenNthCalledWith(3, expect.objectContaining({
      userId: 'buyer-1', type: 'return_rejected',
    }))
  })

  it('handles missing optional body and data', async () => {
    const result = await service.createNotification('user-1', 'coupon_available', 'Coupon available')

    expect(repo.createNotification).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'coupon_available',
      title: 'Coupon available',
      body: null,
      data: null,
    })
    expect(result.body).toBeUndefined()
    expect(result.data).toBeUndefined()
  })

  it('delivers push after persisting a notification', async () => {
    const pushService = { deliver: vi.fn().mockResolvedValue(undefined) }
    service = new NotificationService(createAppContext(), repo, undefined, pushService as any)

    await service.createNotification('user-1', 'order_paid', 'Payment confirmed')

    expect(pushService.deliver).toHaveBeenCalledWith('user-1', expect.objectContaining({ type: 'order_paid' }))
  })

  it('keeps the notification when push delivery fails', async () => {
    const pushService = { deliver: vi.fn().mockRejectedValue(new Error('push unavailable')) }
    service = new NotificationService(createAppContext(), repo, undefined, pushService as any)

    await expect(service.createNotification('user-1', 'order_paid', 'Payment confirmed')).resolves.toMatchObject({
      type: 'order_paid',
    })
  })

  it('publishes notification created and read events', async () => {
    const realtimeService = { publish: vi.fn() }
    service = new NotificationService(createAppContext(), repo, realtimeService as any)

    await service.createNotification('user-1', 'coupon_available', 'Coupon available')
    await service.markNotificationAsRead(createActor(), 'notification-1')
    await service.markAllNotificationsAsRead(createActor())

    expect(realtimeService.publish).toHaveBeenCalledWith('notification.created', 'user:user-1:notifications', expect.objectContaining({ type: 'coupon_available' }))
    expect(realtimeService.publish).toHaveBeenCalledWith('notification.read', 'user:user-1:notifications', expect.objectContaining({ id: '11111111-1111-4111-8111-111111111111' }))
    expect(realtimeService.publish).toHaveBeenCalledWith('notification.read', 'user:user-1:notifications', { updatedCount: 3 })
  })

  it('uses actual recipient and projected purchase values in each enabled channel template', async () => {
    repo.findRecipientForNotification = vi.fn(async () => ({ name: 'Actual buyer', email: 'actual@example.test' }))
    const runtime: NotificationRuntimeConfig = {
      deliveryConfig: vi.fn(async () => ({ inApp: true, push: true, email: true })),
      renderNotification: vi.fn(async input => ({ subject: `${input.channel} ${input.values.name}`, body: `Order ${input.values.orderNumber}, tracking ${input.values.trackingNumber}` })),
    }
    const push = { deliver: vi.fn(async () => {}) }, email = { sendMessage: vi.fn(async () => {}) }, realtime = { publish: vi.fn(async () => 1) }
    service = new NotificationService(createAppContext(), repo, realtime, push, runtime, email)
    await service.createNotification('user-1', 'shipment_shipped', 'Fallback', 'Fallback body', { orderNo: 'ORD-actual', trackingNo: 'TRACK-actual' })
    expect(repo.createNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'IN_APP Actual buyer', body: 'Order ORD-actual, tracking TRACK-actual' }))
    expect(push.deliver).toHaveBeenCalledWith('user-1', expect.objectContaining({ title: 'PUSH Actual buyer' }))
    expect(email.sendMessage).toHaveBeenCalledWith({ to: 'actual@example.test', subject: 'EMAIL Actual buyer', text: 'Order ORD-actual, tracking TRACK-actual' })
  })

  it('disables in-app persistence, realtime and push independently while preserving enabled email', async () => {
    repo.findRecipientForNotification = vi.fn(async () => ({ name: 'Recipient', email: 'actual@example.test' }))
    const runtime: NotificationRuntimeConfig = { deliveryConfig: vi.fn(async () => ({ inApp: false, push: false, email: true })), renderNotification: vi.fn(async () => null) }
    const push = { deliver: vi.fn(async () => {}) }, email = { sendMessage: vi.fn(async () => {}) }, realtime = { publish: vi.fn(async () => 1) }
    service = new NotificationService(createAppContext(), repo, realtime, push, runtime, email)
    await service.createNotification('user-1', 'order_paid', 'Purchase', 'Saved purchase')
    expect(repo.createNotification).not.toHaveBeenCalled(); expect(realtime.publish).not.toHaveBeenCalled(); expect(push.deliver).not.toHaveBeenCalled()
    expect(runtime.renderNotification).toHaveBeenCalledOnce()
    expect(email.sendMessage).toHaveBeenCalledWith({ to: 'actual@example.test', subject: 'Purchase', text: 'Saved purchase' })
  })

  it('preserves default delivery and falls back to projected text when a configured template is invalid', async () => {
    const runtime: NotificationRuntimeConfig = { deliveryConfig: vi.fn(async () => ({ inApp: true, push: false, email: false })), renderNotification: vi.fn(async () => { throw new Error('Missing variable') }) }
    service = new NotificationService(createAppContext(), repo, undefined, undefined, runtime)
    await service.createNotification('user-1', 'order_paid', 'Actual fallback', 'Order actual')
    expect(repo.createNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Actual fallback', body: 'Order actual' }))
    const email = { sendMessage: vi.fn(async () => {}) }
    service = new NotificationService(createAppContext(), repo, undefined, undefined, undefined, email)
    await service.createNotification('user-1', 'order_paid', 'Legacy behavior')
    expect(email.sendMessage).not.toHaveBeenCalled()
  })
})
