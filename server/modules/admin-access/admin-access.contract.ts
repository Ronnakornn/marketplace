import type { User } from '#generated/client/client.ts'

export const adminPermissions = [
  'dashboard.read',
  'users.read',
  'users.write',
  'shops.read',
  'shops.write',
  'catalog.read',
  'catalog.write',
  'orders.read',
  'orders.write',
  'finance.read',
  'finance.reconcile',
  'refunds.process',
  'refunds.complete',
  'payouts.approve',
  'payouts.complete',
  'marketing.read',
  'marketing.write',
  'content.read',
  'content.write',
  'support.read',
  'support.write',
  'reports.read',
  'reports.export',
  'settings.read',
  'settings.write',
  'security.read',
  'security.write',
  'team.manage',
] as const

export type AdminPermission = (typeof adminPermissions)[number]
export type AdminActor = Pick<User, 'id' | 'role'>

export interface AdminAuthorizer {
  require(actor: AdminActor, permission: AdminPermission): Promise<void>
}
