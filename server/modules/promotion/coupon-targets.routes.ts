import { Elysia, t } from 'elysia'
import { authPlugin } from '#server/modules/auth'
import { directoryActor } from '#server/modules/admin-directory/admin-directory.routes.ts'
import { AdminAccessError } from '#server/modules/admin-access/admin-access.errors.ts'
import type { CouponTargetsService } from './coupon-targets.service.ts'
import { CouponTargetsWriteSchema } from './coupon-targets.schemas.ts'

export const couponTargetsPermissions = {
  choices: 'marketing.read',
  read: 'marketing.read',
  save: 'marketing.write',
} as const
export function createCouponTargetsRoutes(container: {
  couponTargetsService: CouponTargetsService
}) {
  const service = container.couponTargetsService
  return new Elysia({ name: 'coupon-targets-routes' })
    .use(authPlugin)
    .onError(({ error, status }) => {
      if (error instanceof AdminAccessError)
        return status(error.status, {
          error: { code: error.code, message: error.message },
        })
    })
    .get(
      '/api/admin/coupon-targets',
      async ({ request, query }) =>
        service.choices(await directoryActor(request), query.page, query.limit),
      {
        withRole: 'ADMIN',
        query: t.Object({
          page: t.Optional(t.Numeric({ minimum: 1, maximum: 10000 })),
          limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
        }),
      },
    )
    .get(
      '/api/admin/coupon-targets/:couponId',
      async ({ request, params }) =>
        service.read(await directoryActor(request), params.couponId),
      {
        withRole: 'ADMIN',
        params: t.Object({ couponId: t.String({ format: 'uuid' }) }),
      },
    )
    .put(
      '/api/admin/coupon-targets/:couponId',
      async ({ request, params, body }) =>
        service.save(await directoryActor(request), params.couponId, body),
      {
        withRole: 'ADMIN',
        params: t.Object({ couponId: t.String({ format: 'uuid' }) }),
        body: CouponTargetsWriteSchema,
      },
    )
}
