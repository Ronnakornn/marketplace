import type { AuditAction, Role } from '#generated/client/enums.ts'

export const auditActions = [
  'USER_STATUS_CHANGED',
  'SELLER_APPLICATION_STATUS_CHANGED',
  'SELLER_PROFILE_STATUS_CHANGED',
  'SHOP_STATUS_CHANGED',
  'PRODUCT_STATUS_CHANGED',
  'ORDER_STATUS_CHANGED',
  'SHIPMENT_STATUS_CHANGED',
  'REFUND_STATUS_CHANGED',
  'PAYOUT_STATUS_CHANGED',
  'RETURN_STATUS_CHANGED',
  'REVIEW_STATUS_CHANGED',
  'REVIEW_REPORT_STATUS_CHANGED',
  'PRODUCT_QUESTION_STATUS_CHANGED',
  'PRODUCT_ANSWER_STATUS_CHANGED',
  'FRAUD_CASE_REVIEWED',
  'FRAUD_CASE_RESOLVED',
  'ADMIN_LOGIN',
  'ADMIN_CONFIG_CHANGED',
] as const satisfies readonly AuditAction[]

export interface AuditActor {
  id?: string | null
  role: Role
}

export interface AuditLogQueryInput {
  actorUserId?: string
  action?: string
  entityType?: string
  entityId?: string
  from?: string
  to?: string
  page?: number | string
  limit?: number | string
}

export interface NormalizedAuditLogQuery {
  actorUserId?: string
  action?: AuditAction
  entityType?: string
  entityId?: string
  from?: Date
  to?: Date
  page: number
  limit: number
}

export interface CreateAuditLogInput {
  actorUserId?: string | null
  actorRole: Role
  action: AuditAction
  entityType: string
  entityId: string
  before?: unknown
  after?: unknown
  metadata?: unknown
  ipAddress?: string | null
  userAgent?: string | null
  nonCritical?: boolean
}
