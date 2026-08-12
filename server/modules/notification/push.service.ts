import webpush, { type WebPushError } from 'web-push'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { NotificationActor, NotificationResponse } from './notification.service.ts'
import type { IPushRepository, PushSubscriptionInput } from './push.repository.ts'

const pushedTypes = new Set(['order_paid', 'payment_failed', 'payment_expired', 'shipment_shipped', 'shipment_delivered', 'return_approved', 'return_rejected', 'refund_processing', 'refund_success'])

export interface PushConfig {
  enabled: boolean
  publicKey?: string
  privateKey?: string
  subject?: string
}

export class PushService {
  private logger: ILogger

  constructor(appContext: AppContext, private repo: IPushRepository, private config: PushConfig) {
    this.logger = appContext.logger
    if (config.enabled && config.publicKey && config.privateKey && config.subject) {
      webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)
    }
  }

  getConfig(): { enabled: boolean; publicKey?: string } {
    return this.config.enabled && this.config.publicKey
      ? { enabled: true, publicKey: this.config.publicKey }
      : { enabled: false }
  }

  async subscribe(actor: NotificationActor, input: PushSubscriptionInput): Promise<{ subscribed: true }> {
    await this.repo.upsert(actor.id, input)
    return { subscribed: true }
  }

  async unsubscribe(actor: NotificationActor, endpoint: string): Promise<{ subscribed: false }> {
    await this.repo.deleteOwned(actor.id, endpoint)
    return { subscribed: false }
  }

  async sendTest(actor: NotificationActor): Promise<{ deliveredCount: number }> {
    return { deliveredCount: await this.send(actor.id, (locale) => locale === 'th' ? {
      title: 'เปิดการแจ้งเตือนแล้ว',
      body: 'คุณจะได้รับอัปเดตคำสั่งซื้อสำคัญที่นี่',
      url: '/notifications',
    } : {
      title: 'Notifications enabled',
      body: 'You will receive important order updates here.',
      url: '/notifications',
    }) }
  }

  async deliver(userId: string, notification: NotificationResponse): Promise<void> {
    if (!pushedTypes.has(notification.type) || notification.data?.audience === 'seller') return
    await this.send(userId, (locale) => ({
      ...localizedPushCopy(notification.type, locale),
      url: notificationUrl(notification),
    }))
  }

  private async send(
    userId: string,
    createPayload: (locale: 'th' | 'en') => { title: string; body: string; url: string },
  ): Promise<number> {
    if (!this.config.enabled) return 0
    const subscriptions = await this.repo.findForUser(userId)
    const staleIds: string[] = []
    let deliveredCount = 0
    await Promise.all(subscriptions.map(async ({ id, locale, ...subscription }) => {
      if (subscription.expirationTime && subscription.expirationTime < Date.now()) {
        staleIds.push(id)
        return
      }
      try {
        const payload = createPayload(locale)
        await webpush.sendNotification(subscription, JSON.stringify({
          ...payload,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
        }))
        deliveredCount += 1
      } catch (error) {
        const statusCode = (error as WebPushError).statusCode
        if (statusCode === 404 || statusCode === 410) staleIds.push(id)
        this.logger.warn('PushService delivery failed', {
          userId,
          statusCode,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }))
    await this.repo.deleteByIds(staleIds)
    return deliveredCount
  }
}

export function getPushConfigFromEnv(env: NodeJS.ProcessEnv = process.env): PushConfig {
  const enabled = env['PUSH_NOTIFICATIONS_ENABLED'] === 'true'
    && Boolean(env['NEXT_PUBLIC_VAPID_PUBLIC_KEY']?.trim())
    && Boolean(env['VAPID_PRIVATE_KEY']?.trim())
    && Boolean(env['VAPID_SUBJECT']?.trim())
  if (!enabled) return { enabled: false }
  return {
    enabled,
    publicKey: env['NEXT_PUBLIC_VAPID_PUBLIC_KEY']?.trim(),
    privateKey: env['VAPID_PRIVATE_KEY']?.trim(),
    subject: env['VAPID_SUBJECT']?.trim(),
  }
}

function notificationUrl(notification: NotificationResponse): string {
  const targetPath = notification.data?.targetPath
  if (typeof targetPath === 'string' && targetPath.startsWith('/')) return targetPath
  const orderId = notification.data?.orderId
  return typeof orderId === 'string' ? `/orders/${encodeURIComponent(orderId)}` : '/notifications'
}

function localizedPushCopy(type: string, locale: 'th' | 'en'): { title: string; body: string } {
  const copy = {
    th: {
      order_paid: ['ยืนยันการชำระเงินแล้ว', 'เราได้รับการชำระเงินสำหรับคำสั่งซื้อของคุณแล้ว'],
      payment_failed: ['ชำระเงินไม่สำเร็จ', 'คำสั่งซื้อถูกยกเลิก กรุณาตรวจสอบเพื่อดำเนินการต่อ'],
      payment_expired: ['หมดเวลาชำระเงิน', 'คำสั่งซื้อถูกยกเลิก กรุณาตรวจสอบเพื่อดำเนินการต่อ'],
      shipment_shipped: ['จัดส่งสินค้าแล้ว', 'คำสั่งซื้อของคุณกำลังเดินทาง'],
      shipment_delivered: ['จัดส่งสำเร็จ', 'คำสั่งซื้อของคุณถูกจัดส่งเรียบร้อยแล้ว'],
      refund_processing: ['กำลังดำเนินการคืนเงิน', 'สถานะการคืนเงินของคุณมีการอัปเดต'],
      refund_success: ['คืนเงินสำเร็จ', 'ดำเนินการคืนเงินของคุณเรียบร้อยแล้ว'],
      return_approved: ['อนุมัติการคืนสินค้าแล้ว', 'คำขอคืนสินค้าของคุณได้รับการอนุมัติ และกำลังดำเนินการคืนเงิน'],
      return_rejected: ['ไม่อนุมัติการคืนสินค้า', 'คำขอคืนสินค้าของคุณไม่ได้รับการอนุมัติ'],
    },
    en: {
      order_paid: ['Payment confirmed', 'We received the payment for your order.'],
      payment_failed: ['Payment failed', 'Your order was cancelled. Review it for next steps.'],
      payment_expired: ['Payment expired', 'Your order was cancelled. Review it for next steps.'],
      shipment_shipped: ['Order shipped', 'Your order is on the way.'],
      shipment_delivered: ['Order delivered', 'Your order was delivered successfully.'],
      refund_processing: ['Refund processing', 'Your refund status was updated.'],
      refund_success: ['Refund completed', 'Your refund was completed successfully.'],
      return_approved: ['Return approved', 'Your return was approved and the refund is now processing.'],
      return_rejected: ['Return rejected', 'Your return request was not approved.'],
    },
  } as const
  const [title, body] = copy[locale][type as keyof typeof copy.en] ?? (locale === 'th'
    ? ['อัปเดตคำสั่งซื้อ', 'สถานะคำสั่งซื้อของคุณมีการอัปเดต']
    : ['Order updated', 'Your order status was updated.'])
  return { title, body }
}
