import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendWebPush } from './push.transport.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { IPushRepository } from './push.repository.ts'
import { PushService, maxConcurrentPushSends, maxConcurrentPushTransports } from './push.service.ts'

vi.mock('./push.transport.ts', () => ({ sendWebPush: vi.fn() }))

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}))

function appContext(): AppContext {
  return {
    config: { environment: 'test' },
    logger: {
      debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    },
  }
}

function repoMock(): IPushRepository {
  return {
    upsert: vi.fn(),
    deleteOwned: vi.fn(),
    findForUser: vi.fn().mockResolvedValue([{
      id: 'subscription-1',
      endpoint: 'https://push.example/1',
      locale: 'th',
      expirationTime: null,
      keys: { p256dh: 'p256dh', auth: 'auth' },
    }]),
    deleteByIds: vi.fn().mockResolvedValue(0),
  }
}

const config = { enabled: true, publicKey: 'public', privateKey: 'private', subject: 'mailto:test@example.com' }

describe('PushService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('bounds all concurrent fan-outs with no waiting queue and at most ten devices per user', async () => {
    const repo = repoMock()
    const subscription = (await repo.findForUser('user'))[0]!
    vi.mocked(repo.findForUser).mockClear().mockResolvedValue(Array.from({ length: 250 }, (_, i) => ({ ...subscription, id: String(i) })))
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    let active = 0
    let peak = 0
    vi.mocked(sendWebPush).mockImplementation(async () => {
      active++
      peak = Math.max(peak, active)
      await gate
      active--
    })
    const service = new PushService(appContext(), repo, config)
    const batches = Array.from({ length: 20 }, (_, i) => service.sendTest({ id: String(i), role: 'USER' }))
    await Promise.resolve()
    expect(repo.findForUser).toHaveBeenCalledTimes(maxConcurrentPushSends)
    expect(sendWebPush).toHaveBeenCalledTimes(maxConcurrentPushTransports)
    release()
    const results = await Promise.all(batches)
    expect(peak).toBe(maxConcurrentPushTransports)
    expect(sendWebPush).toHaveBeenCalledTimes(maxConcurrentPushSends * 10)
    expect(results.filter(result => result.deliveredCount === 0)).toHaveLength(16)
    await expect(service.sendTest({ id: 'after', role: 'USER' })).resolves.toEqual({ deliveredCount: 10 })
  })

  it('releases admission after repository failure and still deletes expired endpoints', async () => {
    const repo = repoMock()
    vi.mocked(repo.findForUser).mockRejectedValueOnce(new Error('database unavailable'))
    const service = new PushService(appContext(), repo, config)
    await expect(service.sendTest({ id: 'user', role: 'USER' })).rejects.toThrow('database unavailable')
    const subscription = (await repo.findForUser('user'))[0]!
    vi.mocked(repo.findForUser).mockResolvedValue([{ ...subscription, expirationTime: Date.now() - 1 }])
    await expect(service.sendTest({ id: 'user', role: 'USER' })).resolves.toEqual({ deliveredCount: 0 })
    expect(sendWebPush).not.toHaveBeenCalled()
    expect(repo.deleteByIds).toHaveBeenCalledWith([subscription.id])
  })

  it('sends localized privacy-safe transactional pushes', async () => {
    const repo = repoMock()
    vi.mocked(sendWebPush).mockResolvedValue({} as never)
    const service = new PushService(appContext(), repo, config)

    await service.deliver('user-1', {
      id: 'notification-1',
      type: 'shipment_shipped',
      title: 'Shipment shipped',
      body: 'Order SECRET-123 is on the way.',
      data: { orderId: 'order-1', orderNo: 'SECRET-123' },
      createdAt: new Date(),
    })

    const payload = JSON.parse(vi.mocked(sendWebPush).mock.calls[0]![1] as string)
    expect(payload).toMatchObject({
      title: 'จัดส่งสินค้าแล้ว',
      body: 'คำสั่งซื้อของคุณกำลังเดินทาง',
      url: '/orders/order-1',
    })
    expect(JSON.stringify(payload)).not.toContain('SECRET-123')
  })

  it('does not push promotional or seller notifications', async () => {
    const service = new PushService(appContext(), repoMock(), config)
    await service.deliver('user-1', { id: '1', type: 'coupon_available', title: 'Sale', createdAt: new Date() })
    await service.deliver('user-1', { id: '2', type: 'order_paid', title: 'Paid', data: { audience: 'seller' }, createdAt: new Date() })
    expect(sendWebPush).not.toHaveBeenCalled()
  })

  it('keeps payment cancellation pushes generic and links to the order', async () => {
    const repo = repoMock()
    vi.mocked(repo.findForUser).mockResolvedValue([{
      id: 'subscription-1', endpoint: 'https://push.example/1', locale: 'en', expirationTime: null,
      keys: { p256dh: 'p256dh', auth: 'auth' },
    }])
    vi.mocked(sendWebPush).mockResolvedValue({} as never)

    await new PushService(appContext(), repo, config).deliver('user-1', {
      id: 'notification-1', type: 'payment_failed', title: 'Payment failed',
      body: 'Payment for order SECRET-123 failed.',
      data: { orderId: 'order-1', orderNo: 'SECRET-123' }, createdAt: new Date(),
    })

    const payload = JSON.parse(vi.mocked(sendWebPush).mock.calls[0]![1] as string)
    expect(payload).toMatchObject({
      title: 'Payment failed', body: 'Your order was cancelled. Review it for next steps.', url: '/orders/order-1',
    })
    expect(JSON.stringify(payload)).not.toContain('SECRET-123')
  })

  it('pushes return decisions to the existing buyer order page', async () => {
    const repo = repoMock()
    vi.mocked(repo.findForUser).mockResolvedValue([{
      id: 'subscription-1', endpoint: 'https://push.example/1', locale: 'en', expirationTime: null,
      keys: { p256dh: 'p256dh', auth: 'auth' },
    }])
    vi.mocked(sendWebPush).mockResolvedValue({} as never)

    await new PushService(appContext(), repo, config).deliver('buyer-1', {
      id: 'notification-1', type: 'return_approved', title: 'Return approved',
      data: { orderId: 'order-1', targetPath: '/orders/order-1' }, createdAt: new Date(),
    })

    const payload = JSON.parse(vi.mocked(sendWebPush).mock.calls[0]![1] as string)
    expect(payload).toMatchObject({
      title: 'Return approved',
      body: 'Your return was approved and the refund is now processing.',
      url: '/orders/order-1',
    })
  })

  it('removes subscriptions rejected as gone by the provider', async () => {
    const repo = repoMock()
    vi.mocked(sendWebPush).mockRejectedValue(Object.assign(new Error('gone'), { statusCode: 410 }))
    const service = new PushService(appContext(), repo, config)

    await service.sendTest({ id: 'user-1', role: 'USER' })

    expect(repo.deleteByIds).toHaveBeenCalledWith(['subscription-1'])
  })
})
