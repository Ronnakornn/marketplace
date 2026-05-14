import type { NotificationData, NotificationType } from '#server/modules/notification/notification.types.ts'

export const jobNames = [
  'send_notification',
  'send_email_placeholder',
  'release_expired_payment_stock',
  'cleanup_abandoned_carts',
  'sync_order_status',
] as const

export type JobName = typeof jobNames[number]

export interface SendNotificationJobPayload {
  userId: string
  type: NotificationType
  title: string
  body?: string | null
  data?: NotificationData | null
}

export interface SendEmailPlaceholderJobPayload {
  to: string
  subject: string
  body?: string | null
}

export interface ReleaseExpiredPaymentStockJobPayload {
  now?: string
  paymentTimeoutMinutes?: number
}

export interface CleanupAbandonedCartsJobPayload {
  now?: string
  olderThanMinutes?: number
}

export interface SyncOrderStatusJobPayload {
  orderId: string
}

export type JobPayloadByName = {
  send_notification: SendNotificationJobPayload
  send_email_placeholder: SendEmailPlaceholderJobPayload
  release_expired_payment_stock: ReleaseExpiredPaymentStockJobPayload
  cleanup_abandoned_carts: CleanupAbandonedCartsJobPayload
  sync_order_status: SyncOrderStatusJobPayload
}

export type AnyJobPayload = JobPayloadByName[JobName]
