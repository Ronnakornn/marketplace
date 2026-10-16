import { ListPageQuery } from '#server/lib/list-page.ts'
import { moneyHttpError, moneyResponse, toMoneyDto, MoneyAmountError } from '#server/lib/money.ts'
import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin, type AuthContext } from '#server/modules/auth'
import { AffiliateServiceError } from './affiliate.errors.ts'

const AffiliateListQuerySchema = t.Object({ ...ListPageQuery, q: t.Optional(t.String({ maxLength: 200 })), status: t.Optional(t.Union([t.Literal('ACTIVE'), t.Literal('DISABLED')])) })
const TargetTypeSchema = t.Union([t.Literal('product'), t.Literal('shop'), t.Literal('campaign')])
const TargetSearchQuerySchema = t.Object({
  targetType: TargetTypeSchema,
  q: t.Optional(t.String()),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 20 })),
})
const LinkParamsSchema = t.Object({ linkId: t.String({ format: 'uuid' }) })
const AffiliateParamsSchema = t.Object({ affiliateId: t.String({ format: 'uuid' }) })
const CreateLinkBodySchema = t.Object({
  code: t.Optional(t.String({ minLength: 4, maxLength: 40 })),
  targetType: TargetTypeSchema,
  targetId: t.String({ minLength: 1 }),
})
const ClickBodySchema = t.Object({
  code: t.Optional(t.String({ minLength: 1 })),
  linkId: t.Optional(t.String({ format: 'uuid' })),
  sessionId: t.Optional(t.String({ minLength: 1 })),
  refParam: t.Optional(t.String({ minLength: 1 })),
  buyerUserId: t.Optional(t.String({ format: 'uuid' })),
})
const AdminStatusBodySchema = t.Object({
  status: t.Union([t.Literal('ACTIVE'), t.Literal('DISABLED')]),
})

export function createAffiliateRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof MoneyAmountError) return httpStatus(409, { error: { code: 'INVALID_MONEY_AMOUNT', message: error.message } })
      if (error instanceof AffiliateServiceError) {
        return moneyHttpError(error.status, toMoneyDto({
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        }))
      }
    })
    .post('/api/affiliate/links', ({ authContext, body }: any) =>
      moneyResponse(container.affiliateService.createLink(authContext.user, body)), {
      withAuth: true,
      body: CreateLinkBodySchema,
    })
    .get('/api/affiliate/links', ({ authContext, query }: { authContext?: AuthContext; query: typeof AffiliateListQuerySchema.static }) =>
      moneyResponse(container.affiliateService.listLinks(authContext!.user, query)), {
      withAuth: true, query: AffiliateListQuerySchema,
    })
    .get('/api/affiliate/links/:linkId', ({ authContext, params }: any) =>
      moneyResponse(container.affiliateService.getLink(authContext.user, params.linkId)), {
      withAuth: true,
      params: LinkParamsSchema,
    })
    .get('/api/affiliate/stats', ({ authContext }: any) =>
      moneyResponse(container.affiliateService.getStats(authContext.user)), {
      withAuth: true,
    })
    .get('/api/affiliate/targets', ({ query }: any) =>
      moneyResponse(container.affiliateService.searchTargets(query)), {
      withAuth: true,
      query: TargetSearchQuerySchema,
    })
    .get('/api/a/:code', async ({ params, query, request, set }: any) => {
      const result = await container.affiliateService.trackClick({
        code: params.code,
        sessionId: query.sessionId,
        refParam: query.ref,
        ipAddress: request.headers.get('x-forwarded-for') ?? null,
        userAgent: request.headers.get('user-agent') ?? null,
      })
      set.status = 302
      set.headers.Location = result.targetUrl
      set.headers['Set-Cookie'] = `affiliate_click=${result.clickId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
      return moneyResponse(null)
    }, {
      params: t.Object({ code: t.String({ minLength: 1 }) }),
      query: t.Object({
        sessionId: t.Optional(t.String({ minLength: 1 })),
        ref: t.Optional(t.String({ minLength: 1 })),
      }),
    })
    .post('/api/affiliate/clicks', ({ body, request }: any) =>
      moneyResponse(container.affiliateService.trackClick({
        ...body,
        ipAddress: request.headers.get('x-forwarded-for') ?? null,
        userAgent: request.headers.get('user-agent') ?? null,
      })), {
      body: ClickBodySchema,
    })
    .get('/api/admin/affiliates', ({ query }) => moneyResponse(container.affiliateService.listAdminAffiliates(query)), {
      withRole: 'ADMIN', query: AffiliateListQuerySchema,
    })
    .patch('/api/admin/affiliates/:affiliateId/status', ({ params, body }: any) =>
      moneyResponse(container.affiliateService.updateAffiliateStatus(params.affiliateId, body.status)), {
      withRole: 'ADMIN',
      params: AffiliateParamsSchema,
      body: AdminStatusBodySchema,
    })
}
