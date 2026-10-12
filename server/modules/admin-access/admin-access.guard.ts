import { Elysia } from 'elysia'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { AdminAccessError } from './admin-access.errors.ts'
import {
  resolveAdminRoutePermission,
  type AdminRoutePermission,
} from './admin-route-permissions.ts'
import type { AdminAccessService } from './admin-access.service.ts'
import type { AccessAction } from './admin-access.schemas.ts'
import {
  normalizeCidr,
  signedDeviceIdentity,
  trustedRequestIp,
} from './request-identity.ts'

export function requestAccessAction(path: string): AccessAction {
  if (path.startsWith('/api/admin') || /^\/api\/users(?:\/|$)/.test(path))
    return 'ADMIN'
  if (path.startsWith('/api/checkout')) return 'CHECKOUT'
  if (/^\/api\/(?:chats?|realtime)(?:\/|$)/.test(path)) return 'CHAT'
  if (
    path.includes('/reviews') ||
    path.includes('/shop-reviews') ||
    path === '/api/review-reports'
  )
    return 'REVIEW'
  if (path.includes('/coupons') || path.includes('/flash-sales'))
    return 'PROMOTION'
  return 'ALL'
}

export function createAdminAccessGuard(
  service: AdminAccessService,
  options: {
    routes?: AdminRoutePermission[]
    trustedProxyCidrs?: string[]
    deviceSecret?: string
  } = {},
) {
  const trustedProxyCidrs = (
    options.trustedProxyCidrs ??
    process.env.ADMIN_TRUSTED_PROXY_CIDRS?.split(',').filter(Boolean) ??
    []
  ).map(normalizeCidr)
  return new Elysia({ name: 'admin-access-guard' })
    .onBeforeHandle(async ({ request, server, set }) => {
      const path = new URL(request.url).pathname
      if (
        !path.startsWith('/api/') ||
        path.startsWith('/api/auth/') ||
        path.startsWith('/api/webhooks/') ||
        /^\/api\/payments?\/webhook$/.test(path) ||
        /^\/api\/(?:health|ready|live|metrics)(?:\/|$)/.test(path)
      )
        return
      const action = requestAccessAction(path)
      const auth = await getAuthContext(request.headers)
      const device = signedDeviceIdentity(
        request,
        options.deviceSecret ?? process.env.BETTER_AUTH_SECRET,
      )
      if (device.setCookie) set.headers['set-cookie'] = device.setCookie
      await service.evaluate({
        action,
        userId: auth?.user.id,
        ip: trustedRequestIp(
          request,
          server?.requestIP(request)?.address,
          trustedProxyCidrs,
        ),
        deviceHash: device.deviceHash,
      })
      if (action !== 'ADMIN') return
      if (!auth)
        throw new AdminAccessError(
          'Authentication is required',
          401,
          'AUTH_REQUIRED',
        )
      if (path === '/api/admin/me/access' && request.method === 'GET') {
        await service.access(auth.user)
        return
      }
      const permission = resolveAdminRoutePermission(
        request.method,
        path,
        options.routes,
      )
      if (!permission)
        throw new AdminAccessError(
          'Admin route has no permission policy',
          403,
          'UNMAPPED_ADMIN_ROUTE',
        )
      await service.require(auth.user, permission)
    })
    .onError(({ error, status }) => {
      if (error instanceof AdminAccessError)
        return status(error.status, {
          error: { code: error.code, message: error.message },
        })
    })
    .as('global')
}
