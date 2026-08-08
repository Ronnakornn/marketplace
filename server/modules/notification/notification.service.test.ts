import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { INotificationRepository, NotificationRecord } from './notification.repository.ts'
import { NotificationService } from './notification.service.ts'

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

  it('lists only the authenticated user notifications', async () => {
    const result = await service.listNotifications(createActor())

    expect(repo.findNotificationsForUser).toHaveBeenCalledWith('user-1')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      type: 'order_paid',
      data: { orderId: 'order-1' },
    })
  })

  it('lists only seller notifications for the seller scope', async () => {
    vi.mocked(repo.findNotificationsForUser).mockResolvedValue([
      createNotification({ id: 'buyer-notification', data: { orderId: 'order-1', orderNo: 'ORD-1' } }),
      createNotification({ id: 'seller-notification', title: 'New paid order', data: { orderId: 'order-2', audience: 'seller' } }),
      createNotification({ id: 'payout-notification', type: 'payout_paid', data: { payoutId: 'payout-1' } }),
    ])

    const result = await service.listNotifications(createActor(), 'seller')

    expect(result.map((notification) => notification.id)).toEqual(['seller-notification', 'payout-notification'])
  })

  it('marks only seller notifications as read for the seller scope', async () => {
    vi.mocked(repo.findNotificationsForUser).mockResolvedValue([
      createNotification({ id: 'buyer-notification', data: { orderId: 'order-1', orderNo: 'ORD-1' } }),
      createNotification({ id: 'seller-notification', data: { orderId: 'order-2', audience: 'seller' } }),
      createNotification({ id: 'already-read-seller', type: 'payout_paid', readAt: now, data: { payoutId: 'payout-1' } }),
    ])

    await expect(service.markAllNotificationsAsRead(createActor(), 'seller')).resolves.toEqual({ updatedCount: 1 })
    expect(repo.markAsRead).toHaveBeenCalledTimes(1)
    expect(repo.markAsRead).toHaveBeenCalledWith('seller-notification', expect.any(Date))
  })

  it('does not let a user read another user notification', async () => {
    vi.mocked(repo.findNotificationById).mockResolvedValue(createNotification({ userId: 'other-user' }))

    await expect(service.markNotificationAsRead(createActor(), 'notification-1')).rejects.toMatchObject({
      code: 'NOTIFICATION_FORBIDDEN',
    })
  })

  it('counts only unread notifications through repository filter', async () => {
    await expect(service.getUnreadCount(createActor())).resolves.toEqual({ unreadCount: 2 })
    expect(repo.countUnreadForUser).toHaveBeenCalledWith('user-1')
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
    expect(repo.markAllAsRead).toHaveBeenCalledWith('user-1', expect.any(Date))
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
})
