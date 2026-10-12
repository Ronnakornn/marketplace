import type { AdminPermission } from '#server/modules/admin-access/admin-access.contract.ts'

export const adminNavigationPermissions = {
  '/admin/dashboard': 'dashboard.read',
  '/admin/users': 'users.read',
  '/admin/shops': 'shops.read',
  '/admin/shop-policies': 'shops.read',
  '/admin/catalog/imports': 'catalog.read',
  '/admin/catalog': 'catalog.read',
  '/admin/products': 'catalog.read',
  '/admin/categories': 'catalog.read',
  '/admin/orders': 'orders.read',
  '/admin/order-documents': 'orders.read',
  '/admin/returns': 'orders.read',
  '/admin/refunds': 'finance.read',
  '/admin/payouts': 'finance.read',
  '/admin/commissions': 'finance.read',
  '/admin/finance': 'finance.read',
  '/admin/reconciliation': 'finance.read',
  '/admin/flash-sales': 'marketing.read',
  '/admin/marketing': 'marketing.read',
  '/admin/affiliates': 'marketing.read',
  '/admin/content-moderation': 'content.read',
  '/admin/content': 'content.read',
  '/admin/templates': 'settings.read',
  '/admin/support': 'support.read',
  '/admin/reports': 'reports.read',
  '/admin/report-schedules': 'reports.export',
  '/admin/settings': 'settings.read',
  '/admin/shipping': 'settings.read',
  '/admin/fraud': 'security.read',
  '/admin/audit-logs': 'security.read',
  '/admin/security/access': 'security.read',
  '/admin/team': 'team.manage',
} satisfies Record<string, AdminPermission>

export function adminPath(path: string) {
  return path.split('?')[0].replace(/^\/(en|th)(?=\/|$)/, '')
}

export function canVisitAdminPath(permissions: readonly string[] | undefined, path: string) {
  if (!permissions) return false
  const normalized = adminPath(path)
  if (normalized === '/admin') return permissions.includes('dashboard.read')
  const entry = Object.entries(adminNavigationPermissions).find(([route]) => normalized === route || normalized.startsWith(`${route}/`))
  return Boolean(entry && permissions.includes(entry[1]))
}
