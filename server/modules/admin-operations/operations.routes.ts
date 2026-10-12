import { Elysia, t, status } from 'elysia'
import { Prisma } from '#generated/client/client.ts'
import { moneyResponse, MoneyAmountError } from '#server/lib/money.ts'
import { authPlugin } from '#server/modules/auth'
import type {
  AdminActor,
  AdminPermission,
} from '#server/modules/admin-access/admin-access.contract.ts'
import type { AdminOperationsService } from './operations.service.ts'
import { AdminOperationsError } from './operations.errors.ts'
import { AdminAccessError } from '#server/modules/admin-access/admin-access.errors.ts'
import {
  BannerBody,
  ContentBody,
  EvidenceBody,
  MatchBody,
  PageQuery,
  PolicyBody,
  PreviewTemplateBody,
  ProviderBody,
  PublishBody,
  QuoteBody,
  RateBody,
  StatementBody,
  StatementFileBody,
  TemplateBody,
} from './operations.schemas.ts'

function actor(context: unknown): AdminActor {
  if (!context || typeof context !== 'object' || !('authContext' in context))
    throw new AdminOperationsError('Authenticated actor is missing', 403)
  const auth = context.authContext
  if (!auth || typeof auth !== 'object' || !('user' in auth))
    throw new AdminOperationsError('Authenticated actor is missing', 403)
  const user = auth.user
  if (
    !user ||
    typeof user !== 'object' ||
    !('id' in user) ||
    typeof user.id !== 'string' ||
    !('role' in user) ||
    user.role !== 'ADMIN'
  )
    throw new AdminOperationsError('Authenticated actor is missing', 403)
  return { id: user.id, role: user.role }
}
const VersionDelete = t.Object({
  expectedVersion: t.Integer({ minimum: 1 }),
  reason: t.String({ minLength: 3, maxLength: 500 }),
})
const UpdatedDelete = t.Object({
  expectedUpdatedAt: t.String({ format: 'date-time' }),
  reason: t.String({ minLength: 3, maxLength: 500 }),
})
const PaidBody = t.Object({
  evidenceId: t.String({ format: 'uuid' }),
  externalReference: t.String({ minLength: 1, maxLength: 200 }),
})

export const adminOperationsPermissions: Array<{
  method: string
  path: string
  permission: AdminPermission
}> = [
  {
    method: 'GET',
    path: '/api/admin/operations/shop-policies',
    permission: 'shops.read',
  },
  {
    method: 'PATCH',
    path: '/api/admin/operations/shop-policies/:id',
    permission: 'shops.write',
  },
  ...['shipping/providers', 'shipping/rates'].flatMap((path) => [
    {
      method: 'GET',
      path: `/api/admin/operations/${path}`,
      permission: 'settings.read' as const,
    },
    {
      method: 'POST',
      path: `/api/admin/operations/${path}`,
      permission: 'settings.write' as const,
    },
    {
      method: 'PATCH',
      path: `/api/admin/operations/${path}/:id`,
      permission: 'settings.write' as const,
    },
    {
      method: 'DELETE',
      path: `/api/admin/operations/${path}/:id`,
      permission: 'settings.write' as const,
    },
  ]),
  {
    method: 'POST',
    path: '/api/admin/operations/shipping/quote',
    permission: 'settings.read',
  },
  ...['marketing/banners', 'content/pages', 'templates'].flatMap((path) => {
    const read: AdminPermission = path.startsWith('marketing')
      ? 'marketing.read'
      : path === 'templates' ? 'settings.read' : 'content.read'
    const write: AdminPermission = path.startsWith('marketing')
      ? 'marketing.write'
      : path === 'templates' ? 'settings.write' : 'content.write'
    return [
      {
        method: 'GET',
        path: `/api/admin/operations/${path}`,
        permission: read,
      },
      {
        method: 'POST',
        path: `/api/admin/operations/${path}`,
        permission: write,
      },
      {
        method: 'PATCH',
        path: `/api/admin/operations/${path}/:id`,
        permission: write,
      },
      ...(path === 'content/pages'
        ? []
        : [
            {
              method: 'DELETE',
              path: `/api/admin/operations/${path}/:id`,
              permission: write,
            },
          ]),
    ]
  }),
  {
    method: 'POST',
    path: '/api/admin/operations/content/pages/:id/publish',
    permission: 'content.write',
  },
  {
    method: 'POST',
    path: '/api/admin/operations/content/pages/:id/unpublish',
    permission: 'content.write',
  },
  {
    method: 'POST',
    path: '/api/admin/operations/templates/preview',
    permission: 'settings.read',
  },
  {
    method: 'GET',
    path: '/api/admin/operations/finance/channels',
    permission: 'finance.read',
  },
  {
    method: 'GET',
    path: '/api/admin/operations/finance/reconciliation',
    permission: 'finance.read',
  },
  {
    method: 'POST',
    path: '/api/admin/operations/finance/reconciliation',
    permission: 'finance.reconcile',
  },
  {
    method: 'POST',
    path: '/api/admin/operations/finance/reconciliation/:id/match',
    permission: 'finance.reconcile',
  },
  {
    method: 'GET',
    path: '/api/admin/operations/finance/reconciliation/:id/download',
    permission: 'finance.read',
  },
  {
    method: 'POST',
    path: '/api/admin/operations/finance/statements/preview',
    permission: 'finance.reconcile',
  },
  {
    method: 'POST',
    path: '/api/admin/operations/finance/statements/import',
    permission: 'finance.reconcile',
  },
  {
    method: 'POST',
    path: '/api/admin/operations/finance/statements/file-preview',
    permission: 'finance.reconcile',
  },
  {
    method: 'POST',
    path: '/api/admin/operations/finance/statements/file-import',
    permission: 'finance.reconcile',
  },
  {
    method: 'GET',
    path: '/api/admin/operations/finance/cycles',
    permission: 'finance.read',
  },
  {
    method: 'POST',
    path: '/api/admin/operations/finance/cycles/prepare',
    permission: 'payouts.approve',
  },
  {
    method: 'POST',
    path: '/api/admin/operations/finance/payouts/:id/record',
    permission: 'payouts.complete',
  },
]

export function createAdminOperationsRoutes(container: {
  adminOperationsService: AdminOperationsService
}) {
  const service = container.adminOperationsService
  return new Elysia({
    name: 'admin-operations',
    prefix: '/api/admin/operations',
  })
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof AdminAccessError)
        return status(error.status, {
          error: { code: error.code, message: error.message },
        })
      if (error instanceof AdminOperationsError)
        return status(error.status, {
          error: { code: error.code, message: error.message },
        })
      if (error instanceof MoneyAmountError)
        return status(400, {
          error: { code: 'INVALID_MONEY_AMOUNT', message: error.message },
        })
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        return status(409, {
          error: {
            code: 'ADMIN_OPERATIONS_DUPLICATE',
            message: 'A resource with this identity already exists',
          },
        })
    })
    .get(
      '/shop-policies',
      (context) =>
        moneyResponse(service.listPolicies(actor(context), context.query)),
      { withRole: 'ADMIN', query: PageQuery },
    )
    .patch(
      '/shop-policies/:id',
      (context) =>
        moneyResponse(
          service.savePolicy(actor(context), context.params.id, context.body),
        ),
      { withRole: 'ADMIN', body: PolicyBody },
    )
    .get(
      '/shipping/providers',
      (context) => service.listProviders(actor(context), context.query),
      { withRole: 'ADMIN', query: PageQuery },
    )
    .post(
      '/shipping/providers',
      (context) => service.saveProvider(actor(context), null, context.body),
      { withRole: 'ADMIN', body: ProviderBody },
    )
    .patch(
      '/shipping/providers/:id',
      (context) =>
        service.saveProvider(actor(context), context.params.id, context.body),
      { withRole: 'ADMIN', body: ProviderBody },
    )
    .delete(
      '/shipping/providers/:id',
      (context) =>
        service.deleteProvider(actor(context), context.params.id, context.body),
      { withRole: 'ADMIN', body: UpdatedDelete },
    )
    .get(
      '/shipping/rates',
      (context) =>
        moneyResponse(service.listRates(actor(context), context.query)),
      { withRole: 'ADMIN', query: PageQuery },
    )
    .post(
      '/shipping/rates',
      (context) =>
        moneyResponse(service.saveRate(actor(context), null, context.body)),
      { withRole: 'ADMIN', body: RateBody },
    )
    .patch(
      '/shipping/rates/:id',
      (context) =>
        moneyResponse(
          service.saveRate(actor(context), context.params.id, context.body),
        ),
      { withRole: 'ADMIN', body: RateBody },
    )
    .delete(
      '/shipping/rates/:id',
      (context) =>
        service.deleteRate(actor(context), context.params.id, context.body),
      { withRole: 'ADMIN', body: VersionDelete },
    )
    .post(
      '/shipping/quote',
      (context) =>
        moneyResponse(service.previewShipping(actor(context), context.body)),
      { withRole: 'ADMIN', body: QuoteBody },
    )
    .get(
      '/marketing/banners',
      (context) => service.listBanners(actor(context), context.query),
      { withRole: 'ADMIN', query: PageQuery },
    )
    .post(
      '/marketing/banners',
      (context) => service.saveBanner(actor(context), null, context.body),
      { withRole: 'ADMIN', body: BannerBody },
    )
    .patch(
      '/marketing/banners/:id',
      (context) =>
        service.saveBanner(actor(context), context.params.id, context.body),
      { withRole: 'ADMIN', body: BannerBody },
    )
    .delete(
      '/marketing/banners/:id',
      (context) =>
        service.deleteBanner(actor(context), context.params.id, context.body),
      { withRole: 'ADMIN', body: UpdatedDelete },
    )
    .get(
      '/content/pages',
      (context) => service.listContent(actor(context), context.query),
      { withRole: 'ADMIN', query: PageQuery },
    )
    .post(
      '/content/pages',
      (context) => service.saveContent(actor(context), null, context.body),
      { withRole: 'ADMIN', body: ContentBody },
    )
    .patch(
      '/content/pages/:id',
      (context) =>
        service.saveContent(actor(context), context.params.id, context.body),
      { withRole: 'ADMIN', body: ContentBody },
    )
    .post(
      '/content/pages/:id/publish',
      (context) =>
        service.publishContent(actor(context), context.params.id, context.body),
      { withRole: 'ADMIN', body: PublishBody },
    )
    .post(
      '/content/pages/:id/unpublish',
      (context) =>
        service.publishContent(actor(context), context.params.id, {
          ...context.body,
          unpublish: true,
        }),
      { withRole: 'ADMIN', body: PublishBody },
    )
    .get(
      '/templates',
      (context) => service.listTemplates(actor(context), context.query),
      { withRole: 'ADMIN', query: PageQuery },
    )
    .post(
      '/templates',
      (context) => service.saveTemplate(actor(context), null, context.body),
      { withRole: 'ADMIN', body: TemplateBody },
    )
    .patch(
      '/templates/:id',
      (context) =>
        service.saveTemplate(actor(context), context.params.id, context.body),
      { withRole: 'ADMIN', body: TemplateBody },
    )
    .delete(
      '/templates/:id',
      (context) =>
        service.deleteTemplate(actor(context), context.params.id, context.body),
      { withRole: 'ADMIN', body: UpdatedDelete },
    )
    .post(
      '/templates/preview',
      (context) => service.previewTemplate(actor(context), context.body),
      { withRole: 'ADMIN', body: PreviewTemplateBody },
    )
    .get(
      '/finance/channels',
      (context) => service.paymentChannels(actor(context)),
      { withRole: 'ADMIN' },
    )
    .get(
      '/finance/reconciliation',
      (context) =>
        moneyResponse(
          service.listReconciliation(actor(context), context.query),
        ),
      { withRole: 'ADMIN', query: PageQuery },
    )
    .post(
      '/finance/reconciliation',
      (context) =>
        moneyResponse(service.createEvidence(actor(context), context.body)),
      { withRole: 'ADMIN', body: EvidenceBody },
    )
    .post(
      '/finance/reconciliation/:id/match',
      (context) =>
        moneyResponse(
          service.matchEvidence(
            actor(context),
            context.params.id,
            context.body,
          ),
        ),
      { withRole: 'ADMIN', body: MatchBody },
    )
    .get(
      '/finance/reconciliation/:id/download',
      (context) => service.evidenceDownload(actor(context), context.params.id),
      { withRole: 'ADMIN' },
    )
    .post(
      '/finance/statements/preview',
      (context) => service.previewStatement(actor(context), context.body.rows),
      { withRole: 'ADMIN', body: StatementBody },
    )
    .post(
      '/finance/statements/import',
      (context) => service.importStatement(actor(context), context.body.rows),
      { withRole: 'ADMIN', body: StatementBody },
    )
    .post(
      '/finance/statements/file-preview',
      (context) => service.previewStatementFile(actor(context), context.body),
      { withRole: 'ADMIN', body: StatementFileBody },
    )
    .post(
      '/finance/statements/file-import',
      (context) => service.importStatementFile(actor(context), context.body),
      {
        withRole: 'ADMIN',
        body: t.Composite([
          StatementFileBody,
          t.Object({
            expectedFingerprint: t.String({ pattern: '^[a-f0-9]{64}$' }),
          }),
        ]),
      },
    )
    .get(
      '/finance/cycles',
      (context) =>
        moneyResponse(service.listCycles(actor(context), context.query)),
      { withRole: 'ADMIN', query: PageQuery },
    )
    .post(
      '/finance/cycles/prepare',
      (context) => moneyResponse(service.prepareCycles(actor(context))),
      { withRole: 'ADMIN' },
    )
    .post(
      '/finance/payouts/:id/record',
      (context) =>
        moneyResponse(
          service.recordPayout(actor(context), context.params.id, context.body),
        ),
      { withRole: 'ADMIN', body: PaidBody },
    )
}

export function createPublishedContentRoutes(container: {
  adminOperationsService: AdminOperationsService
}) {
  return new Elysia().get('/api/content/pages/:locale/:slug', ({ params }) =>
    container.adminOperationsService.publishedContent(
      params.slug,
      params.locale,
    ),
  )
}
