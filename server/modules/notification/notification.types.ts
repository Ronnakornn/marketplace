export type NotificationType =
  | 'order_paid'
  | 'order_cancelled'
  | 'shipment_shipped'
  | 'shipment_delivered'
  | 'return_requested'
  | 'return_approved'
  | 'return_rejected'
  | 'refund_processing'
  | 'refund_success'
  | 'coupon_available'

export type NotificationData = Record<string, unknown>
