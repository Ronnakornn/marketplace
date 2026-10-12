import type { AdminRoutePermission } from './admin-route-permissions.ts'

export const fullAdminRoutePermissions: AdminRoutePermission[] = [
  {
    method: 'GET',
    path: '/api/admin/directory/users/:userId',
    permission: 'users.read',
  },
  {
    method: 'GET',
    path: '/api/admin/directory/shops/:shopId',
    permission: 'shops.read',
  },
  {
    method: 'POST',
    path: '/api/admin/directory/shops/:shopId/notices',
    permission: 'shops.write',
  },
  {
    method: 'GET',
    path: '/api/admin/coupon-targets',
    permission: 'marketing.read',
  },
  {
    method: 'GET',
    path: '/api/admin/coupon-targets/:couponId',
    permission: 'marketing.read',
  },
  {
    method: 'PUT',
    path: '/api/admin/coupon-targets/:couponId',
    permission: 'marketing.write',
  },
  { method: 'GET', path: '/api/admin/analytics', permission: 'reports.read' },
  {
    method: 'GET',
    path: '/api/admin/report-exports',
    permission: 'reports.export',
  },
  {
    method: 'POST',
    path: '/api/admin/report-exports',
    permission: 'reports.export',
  },
  {
    method: 'GET',
    path: '/api/admin/report-exports/:id/download',
    permission: 'reports.export',
  },
  {
    method: 'GET',
    path: '/api/admin/report-schedules',
    permission: 'reports.export',
  },
  {
    method: 'POST',
    path: '/api/admin/report-schedules',
    permission: 'reports.export',
  },
  {
    method: 'PUT',
    path: '/api/admin/report-schedules/:id',
    permission: 'reports.export',
  },
  {
    method: 'GET',
    path: '/api/admin/orders/:orderId/documents/:kind',
    permission: 'orders.read',
  },
  {
    method: 'GET',
    path: '/api/admin/catalog/imports',
    permission: 'catalog.read',
  },
  {
    method: 'GET',
    path: '/api/admin/catalog/imports/:id',
    permission: 'catalog.read',
  },
  {
    method: 'POST',
    path: '/api/admin/catalog/imports/preview',
    permission: 'catalog.write',
  },
  {
    method: 'POST',
    path: '/api/admin/catalog/imports/:id/commit',
    permission: 'catalog.write',
  },
  {
    method: 'GET',
    path: '/api/admin/catalog/import-template',
    permission: 'catalog.read',
  },
  {
    method: 'GET',
    path: '/api/admin/catalog/export',
    permission: 'catalog.read',
  },
  {
    method: 'POST',
    path: '/api/admin/catalog/products/:productId/approval',
    permission: 'catalog.write',
  },
  {
    method: 'GET',
    path: '/api/admin/support/tickets/:ticketId/compensation-refunds',
    permission: 'support.read',
  },
  {
    method: 'POST',
    path: '/api/admin/support/tickets/:ticketId/compensation',
    permission: 'support.write',
  },
]
