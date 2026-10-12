import type { NotificationData, NotificationType } from '#server/modules/notification/notification.types.ts'

export const jobNames = [
  'send_notification',
  'send_email',
  'release_expired_payment_stock',
  'cleanup_abandoned_carts',
  'sync_order_status',
  'reconcile_seller_earnings',
  'process_admin_report_schedules',
  'prepare_admin_payouts',
] as const

export type JobName = typeof jobNames[number]

export interface SendNotificationJobPayload {
  userId: string
  type: NotificationType
  title: string
  body?: string | null
  data?: NotificationData | null
}

export interface SendEmailJobPayload {
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

export interface ReconcileSellerEarningsJobPayload {
  limit?: number
}

export interface AdminScheduledJobPayload { now?: string }

export type JobPayloadByName = {
  send_notification: SendNotificationJobPayload
  send_email: SendEmailJobPayload
  release_expired_payment_stock: ReleaseExpiredPaymentStockJobPayload
  cleanup_abandoned_carts: CleanupAbandonedCartsJobPayload
  sync_order_status: SyncOrderStatusJobPayload
  reconcile_seller_earnings: ReconcileSellerEarningsJobPayload
  process_admin_report_schedules: AdminScheduledJobPayload
  prepare_admin_payouts: AdminScheduledJobPayload
}

export type AnyJobPayload = JobPayloadByName[JobName]
