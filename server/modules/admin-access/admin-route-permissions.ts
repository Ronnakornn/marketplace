import type { AdminPermission } from './admin-access.contract.ts'

export type AdminRoutePermission = {
  method: string
  path: string
  permission: AdminPermission
}

export const legacyAdminRoutePermissions: AdminRoutePermission[] = [
  { method: 'GET', path: '/api/admin/dashboard', permission: 'dashboard.read' },
  { method: 'GET', path: '/api/admin/reports', permission: 'reports.read' },
  { method: 'GET', path: '/api/admin/commissions', permission: 'finance.read' },
  {
    method: 'PATCH',
    path: '/api/admin/commissions/:commissionId/status',
    permission: 'finance.reconcile',
  },
  { method: 'GET', path: '/api/admin/settings', permission: 'settings.read' },
  { method: 'GET', path: '/api/admin/settings/:key', permission: 'settings.read' },
  {
    method: 'PUT',
    path: '/api/admin/settings/:key',
    permission: 'settings.write',
  },
  { method: 'GET', path: '/api/admin/users', permission: 'users.read' },
  { method: 'GET', path: '/api/admin/brands', permission: 'catalog.read' },
  { method: 'POST', path: '/api/admin/brands', permission: 'catalog.write' },
  {
    method: 'PATCH',
    path: '/api/admin/brands/:brandId',
    permission: 'catalog.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/brands/:brandId/deactivate',
    permission: 'catalog.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/brands/:brandId/reactivate',
    permission: 'catalog.write',
  },
  { method: 'POST', path: '/api/admin/users', permission: 'users.write' },
  {
    method: 'PATCH',
    path: '/api/admin/users/:userId',
    permission: 'users.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/users/:userId/role',
    permission: 'users.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/users/:userId/status',
    permission: 'users.write',
  },
  {
    method: 'DELETE',
    path: '/api/admin/users/:userId',
    permission: 'users.write',
  },
  { method: 'GET', path: '/api/admin/shops', permission: 'shops.read' },
  { method: 'POST', path: '/api/admin/shops', permission: 'shops.write' },
  { method: 'GET', path: '/api/admin/shops/:shopId', permission: 'shops.read' },
  {
    method: 'PATCH',
    path: '/api/admin/shops/:shopId',
    permission: 'shops.write',
  },
  {
    method: 'DELETE',
    path: '/api/admin/shops/:shopId',
    permission: 'shops.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/shops/:shopId/status',
    permission: 'shops.write',
  },
  { method: 'GET', path: '/api/admin/products', permission: 'catalog.read' },
  {
    method: 'GET',
    path: '/api/admin/products/:productId',
    permission: 'catalog.read',
  },
  { method: 'GET', path: '/api/admin/orders', permission: 'orders.read' },
  {
    method: 'GET',
    path: '/api/admin/orders/:orderId',
    permission: 'orders.read',
  },
  {
    method: 'POST',
    path: '/api/admin/orders/:orderId/refunds',
    permission: 'refunds.process',
  },
  { method: 'GET', path: '/api/admin/refunds', permission: 'finance.read' },
  {
    method: 'GET',
    path: '/api/admin/refunds/:refundId',
    permission: 'finance.read',
  },
  {
    method: 'PATCH',
    path: '/api/admin/refunds/:refundId/plan',
    permission: 'refunds.process',
  },
  {
    method: 'PATCH',
    path: '/api/admin/refunds/:refundId/status',
    permission: 'refunds.complete',
  },
  { method: 'GET', path: '/api/admin/returns', permission: 'orders.read' },
  {
    method: 'GET',
    path: '/api/admin/returns/:returnId',
    permission: 'orders.read',
  },
  {
    method: 'PATCH',
    path: '/api/admin/returns/:returnId/status',
    permission: 'orders.write',
  },
  { method: 'GET', path: '/api/admin/me/access', permission: 'dashboard.read' },
  { method: 'GET', path: '/api/admin/team', permission: 'team.manage' },
  { method: 'PUT', path: '/api/admin/team/:userId', permission: 'team.manage' },
  {
    method: 'GET',
    path: '/api/admin/access-rules',
    permission: 'security.read',
  },
  {
    method: 'POST',
    path: '/api/admin/access-rules',
    permission: 'security.write',
  },
  {
    method: 'PUT',
    path: '/api/admin/access-rules/:id',
    permission: 'security.write',
  },
  {
    method: 'GET',
    path: '/api/admin/config/toggles',
    permission: 'settings.read',
  },
  {
    method: 'PUT',
    path: '/api/admin/config/toggles/:key',
    permission: 'settings.write',
  },
  {
    method: 'GET',
    path: '/api/admin/config/settings',
    permission: 'settings.read',
  },
  {
    method: 'PUT',
    path: '/api/admin/config/settings',
    permission: 'settings.write',
  },
  {
    method: 'GET',
    path: '/api/admin/config/templates',
    permission: 'settings.read',
  },
  {
    method: 'POST',
    path: '/api/admin/config/templates',
    permission: 'settings.write',
  },
  {
    method: 'PUT',
    path: '/api/admin/config/templates/:id',
    permission: 'settings.write',
  },
  {
    method: 'GET',
    path: '/api/admin/affiliates',
    permission: 'marketing.read',
  },
  {
    method: 'PATCH',
    path: '/api/admin/affiliates/:affiliateId/status',
    permission: 'marketing.write',
  },
  { method: 'GET', path: '/api/admin/audit-logs', permission: 'security.read' },
  {
    method: 'GET',
    path: '/api/admin/audit-logs/:auditLogId',
    permission: 'security.read',
  },
  { method: 'GET', path: '/api/admin/categories', permission: 'catalog.read' },
  {
    method: 'POST',
    path: '/api/admin/categories',
    permission: 'catalog.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/categories/:categoryId',
    permission: 'catalog.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/categories/:categoryId/deactivate',
    permission: 'catalog.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/categories/:categoryId/reactivate',
    permission: 'catalog.write',
  },
  {
    method: 'PUT',
    path: '/api/admin/categories/reorder',
    permission: 'catalog.write',
  },
  {
    method: 'GET',
    path: '/api/admin/categories/:categoryId/specs',
    permission: 'catalog.read',
  },
  {
    method: 'POST',
    path: '/api/admin/categories/:categoryId/specs',
    permission: 'catalog.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/categories/:categoryId/specs/:specId',
    permission: 'catalog.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/categories/:categoryId/specs/:specId/deactivate',
    permission: 'catalog.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/categories/:categoryId/specs/:specId/reactivate',
    permission: 'catalog.write',
  },
  {
    method: 'PUT',
    path: '/api/admin/categories/:categoryId/specs/reorder',
    permission: 'catalog.write',
  },
  {
    method: 'GET',
    path: '/api/admin/catalog/products',
    permission: 'catalog.read',
  },
  {
    method: 'GET',
    path: '/api/admin/catalog/products/:productId',
    permission: 'catalog.read',
  },
  {
    method: 'PATCH',
    path: '/api/admin/catalog/products/:productId',
    permission: 'catalog.write',
  },
  {
    method: 'POST',
    path: '/api/admin/catalog/products/:productId/variants',
    permission: 'catalog.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/catalog/products/:productId/variants/:variantId',
    permission: 'catalog.write',
  },
  {
    method: 'DELETE',
    path: '/api/admin/catalog/products/:productId/variants/:variantId',
    permission: 'catalog.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/catalog/products/:productId/suspend',
    permission: 'catalog.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/catalog/products/:productId/restore',
    permission: 'catalog.write',
  },
  {
    method: 'GET',
    path: '/api/admin/checkout/tax-policy',
    permission: 'settings.read',
  },
  {
    method: 'PUT',
    path: '/api/admin/checkout/tax-policy',
    permission: 'settings.write',
  },
  {
    method: 'GET',
    path: '/api/admin/content-moderation/reviews',
    permission: 'content.read',
  },
  {
    method: 'GET',
    path: '/api/admin/content-moderation/review-reports',
    permission: 'content.read',
  },
  {
    method: 'GET',
    path: '/api/admin/content-moderation/questions',
    permission: 'content.read',
  },
  {
    method: 'GET',
    path: '/api/admin/content-moderation/answers',
    permission: 'content.read',
  },
  {
    method: 'PATCH',
    path: '/api/admin/content-moderation/reviews/:reviewId/status',
    permission: 'content.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/content-moderation/review-reports/:reportId/status',
    permission: 'content.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/content-moderation/questions/:questionId/status',
    permission: 'content.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/content-moderation/answers/:answerId/status',
    permission: 'content.write',
  },
  {
    method: 'GET',
    path: '/api/admin/fraud/cases',
    permission: 'security.read',
  },
  {
    method: 'GET',
    path: '/api/admin/fraud/cases/:caseId',
    permission: 'security.read',
  },
  {
    method: 'PATCH',
    path: '/api/admin/fraud/cases/:caseId/review',
    permission: 'security.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/fraud/cases/:caseId/resolve',
    permission: 'security.write',
  },
  { method: 'GET', path: '/api/admin/payouts', permission: 'finance.read' },
  {
    method: 'GET',
    path: '/api/admin/payouts/:payoutId',
    permission: 'finance.read',
  },
  {
    method: 'PATCH',
    path: '/api/admin/payouts/:payoutId/approve',
    permission: 'payouts.approve',
  },
  {
    method: 'PATCH',
    path: '/api/admin/payouts/:payoutId/reject',
    permission: 'payouts.approve',
  },
  {
    method: 'PATCH',
    path: '/api/admin/payouts/:payoutId/mark-paid',
    permission: 'payouts.complete',
  },
  { method: 'GET', path: '/api/admin/coupons', permission: 'marketing.read' },
  {
    method: 'GET',
    path: '/api/admin/flash-sales',
    permission: 'marketing.read',
  },
  {
    method: 'POST',
    path: '/api/admin/flash-sales',
    permission: 'marketing.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/flash-sales/:flashSaleId',
    permission: 'marketing.write',
  },
  {
    method: 'POST',
    path: '/api/admin/flash-sales/:flashSaleId/items',
    permission: 'marketing.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/flash-sale-items/:itemId',
    permission: 'marketing.write',
  },
  {
    method: 'DELETE',
    path: '/api/admin/flash-sale-items/:itemId',
    permission: 'marketing.write',
  },
  { method: 'POST', path: '/api/admin/coupons', permission: 'marketing.write' },
  {
    method: 'PATCH',
    path: '/api/admin/coupons/:couponId',
    permission: 'marketing.write',
  },
  {
    method: 'DELETE',
    path: '/api/admin/coupons/:couponId',
    permission: 'marketing.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/refunds/:refundId/process',
    permission: 'refunds.process',
  },
  {
    method: 'GET',
    path: '/api/admin/seller-applications',
    permission: 'shops.read',
  },
  {
    method: 'GET',
    path: '/api/admin/seller-applications/:applicationId',
    permission: 'shops.read',
  },
  {
    method: 'PATCH',
    path: '/api/admin/seller-applications/:applicationId/review',
    permission: 'shops.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/seller-applications/:applicationId/documents/:documentId/review',
    permission: 'shops.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/shipments/:shipmentId/deliver',
    permission: 'orders.write',
  },
  {
    method: 'GET',
    path: '/api/admin/shop-reviews',
    permission: 'content.read',
  },
  {
    method: 'PATCH',
    path: '/api/admin/shop-reviews/:shopRatingId/moderate',
    permission: 'content.write',
  },
  {
    method: 'GET',
    path: '/api/admin/support/tickets',
    permission: 'support.read',
  },
  {
    method: 'GET',
    path: '/api/admin/support/tickets/:ticketId',
    permission: 'support.read',
  },
  {
    method: 'POST',
    path: '/api/admin/support/tickets/:ticketId/messages',
    permission: 'support.write',
  },
  {
    method: 'POST',
    path: '/api/admin/support/tickets/:ticketId/notes',
    permission: 'support.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/support/tickets/:ticketId/status',
    permission: 'support.write',
  },
  {
    method: 'PATCH',
    path: '/api/admin/support/tickets/:ticketId/dispute',
    permission: 'support.write',
  },
  { method: 'GET', path: '/api/users', permission: 'users.read' },
  { method: 'POST', path: '/api/users', permission: 'users.write' },
  { method: 'PATCH', path: '/api/users/:id', permission: 'users.write' },
  { method: 'PATCH', path: '/api/users/:id/role', permission: 'users.write' },
  { method: 'DELETE', path: '/api/users/:id', permission: 'users.write' },
]

export function resolveAdminRoutePermission(
  method: string,
  pathname: string,
  extra: AdminRoutePermission[] = [],
) {
  return [...extra, ...legacyAdminRoutePermissions].find(
    (route) => route.method === method && pathMatches(route.path, pathname),
  )?.permission
}

function pathMatches(pattern: string, pathname: string) {
  const expected = pattern.split('/')
  const actual = pathname.split('/')
  return (
    expected.length === actual.length &&
    expected.every((part, index) =>
      part.startsWith(':') ? Boolean(actual[index]) : part === actual[index],
    )
  )
}
