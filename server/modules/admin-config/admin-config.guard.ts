import { Elysia } from 'elysia'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { AdminAccessError } from '#server/modules/admin-access/admin-access.errors.ts'
import type { AdminConfigService } from './admin-config.service.ts'

export function isConfigExempt(path: string, method: string) {
  if (
    /^\/(?:health|ready|live|metrics)(?:\/|$)/.test(path) ||
    /^\/api\/(?:health|ready|live|metrics)(?:\/|$)/.test(path)
  )
    return true
  if (/^\/api\/(?:auth|admin)(?:\/|$)/.test(path)) return true
  if (/^\/api\/users(?:$|\/[a-fA-F0-9-]{36}(?:\/role)?$)/.test(path))
    return true
  if (method === 'POST' && /^\/api\/payments?\/webhook$/.test(path)) return true
  return /^\/api\/(?:orders|returns|refunds|seller\/shipments|seller\/payouts|seller\/wallet)(?:\/|$)/.test(
    path,
  )
}

export function createAdminConfigGuard(service: AdminConfigService) {
  return new Elysia({ name: 'admin-config-guard' })
    .onBeforeHandle(async ({ request, body }) => {
      const path = new URL(request.url).pathname
      if (!path.startsWith('/api/') || isConfigExempt(path, request.method))
        return
      const auth = await getAuthContext(request.headers)
      const context = {
        userId: auth?.user.id,
        shopIds: await service.requestShopIds(path, body),
      }
      if (path.startsWith('/api/checkout'))
        await service.requireFeature('checkout', context)
      else if (/^\/api\/(?:chats?|realtime)(?:\/|$)/.test(path))
        await service.requireFeature('chat', context)
      else if (
        path.includes('/reviews') ||
        path.includes('/shop-reviews') ||
        path === '/api/review-reports'
      )
        await service.requireFeature('reviews', context)
      else if (path.includes('/coupons') || path.includes('/flash-sales'))
        await service.requireFeature('promotions', context)
      else await service.requireAdmission(context)
    })
    .onError(({ error, status }) => {
      if (error instanceof AdminAccessError)
        return status(error.status, {
          error: { code: error.code, message: error.message },
        })
    })
    .as('global')
}
