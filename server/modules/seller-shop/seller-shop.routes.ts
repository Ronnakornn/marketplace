import { Elysia, status as httpStatus, t } from 'elysia'
import { ShopPlainInputUpdate } from '#generated/prismabox/Shop.ts'
import { ShopSettingPlainInputUpdate } from '#generated/prismabox/ShopSetting.ts'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { SellerShopServiceError } from './seller-shop.errors.ts'

const ShopParamsSchema = t.Object({
  shopId: t.String({ format: 'uuid' }),
})

export const StorefrontParamsSchema = t.Object({ shopId: t.String({ minLength: 2, maxLength: 120, pattern: '^[a-zA-Z0-9-]+$' }) }, { additionalProperties: false })
export const StorefrontQuerySchema = t.Object({ locale: t.Union([t.Literal('th'), t.Literal('en')]) }, { additionalProperties: false })
export const StorefrontResponseSchema = t.Object({
  id: t.String(), name: t.String(), slug: t.String(), description: t.Nullable(t.String()),
  logoUrl: t.Nullable(t.String()), coverUrl: t.Nullable(t.String()), ratingAverage: t.Number(),
  ratingCount: t.Integer(), followerCount: t.Integer(), productCount: t.Integer(), chatEnabled: t.Boolean(),
  shippingPolicy: t.Nullable(t.String()), returnPolicy: t.Nullable(t.String()),
  updatedAt: t.Date(),
  viewer: t.Object({ isOwner: t.Boolean() }, { additionalProperties: false }),
}, { additionalProperties: false })

const OptionalLocalizedTextSchema = t.Optional(t.Union([t.String({ maxLength: 5000 }), t.Null()]))
const ShippingFeeBahtSchema = t.Optional(t.Number({ minimum: 0, maximum: 100000 }))
const StaffParamsSchema = t.Intersect([ShopParamsSchema, t.Object({ staffId: t.String({ format: 'uuid' }) })])
const StaffInviteBodySchema = t.Object({ email: t.String({ format: 'email', maxLength: 320 }), role: t.Union([t.Literal('MANAGER'), t.Literal('WAREHOUSE'), t.Literal('SUPPORT')]) })
const StaffUpdateBodySchema = t.Object({ role: t.Optional(t.Union([t.Literal('MANAGER'), t.Literal('WAREHOUSE'), t.Literal('SUPPORT')])), status: t.Optional(t.Union([t.Literal('INVITED'), t.Literal('ACTIVE'), t.Literal('SUSPENDED')])) })
const StaffInviteParamsSchema = t.Object({ staffId: t.String({ format: 'uuid' }) })

const UpdateShopProfileBodySchema = t.Intersect([t.Partial(t.Pick(ShopPlainInputUpdate, [
  'name',
  'slug',
  'contactEmail',
  'contactPhone',
  'description',
  'logoUrl',
  'coverUrl',
  'metaTitle',
  'metaDescription',
])), t.Object({
  descriptionTh: OptionalLocalizedTextSchema,
  descriptionEn: OptionalLocalizedTextSchema,
})])

const UpdateShopSettingsBodySchema = t.Intersect([t.Partial(t.Pick(ShopSettingPlainInputUpdate, [
  'autoAcceptOrder',
  'allowCod',
  'chatEnabled',
  'vacationMode',
  'defaultShippingProvider',
  'returnPolicy',
  'shippingPolicy',
])), t.Object({
  returnPolicyTh: OptionalLocalizedTextSchema,
  returnPolicyEn: OptionalLocalizedTextSchema,
  shippingPolicyTh: OptionalLocalizedTextSchema,
  shippingPolicyEn: OptionalLocalizedTextSchema,
  shippingFeeBaht: ShippingFeeBahtSchema,
})])

function actor(authContext: any) {
  return { id: authContext!.user.id, role: authContext!.user.role }
}

export function createSellerShopRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof SellerShopServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .get('/api/shops/:shopId/storefront', async ({ params, query, request }: any) => {
      const authContext = await getAuthContext(request.headers)
      const { metaTitle: _metaTitle, metaDescription: _metaDescription, ...profile } = await container.sellerShopService.getPublicStorefront(params.shopId, query.locale, authContext?.user.id)
      return profile
    }, {
      params: StorefrontParamsSchema,
      query: StorefrontQuerySchema,
      response: StorefrontResponseSchema,
    })
    .get('/api/seller/shops', ({ authContext }: any) =>
      container.sellerShopService.listOwnedShops(actor(authContext)), {
      withAuth: true,
      withSellerOperational: true,
    })
    .get('/api/seller/shops/:shopId/profile', ({ authContext, params }: any) =>
      container.sellerShopService.getShopProfile(actor(authContext), params.shopId), {
      withAuth: true,
      withSellerOperational: true,
      params: ShopParamsSchema,
    })
    .patch('/api/seller/shops/:shopId/profile', ({ authContext, params, body }: any) =>
      container.sellerShopService.updateShopProfile(actor(authContext), params.shopId, body), {
      withAuth: true,
      withSellerOperational: true,
      params: ShopParamsSchema,
      body: UpdateShopProfileBodySchema,
    })
    .get('/api/seller/shops/:shopId/settings', ({ authContext, params }: any) =>
      container.sellerShopService.getShopSettings(actor(authContext), params.shopId), {
      withAuth: true,
      withSellerOperational: true,
      params: ShopParamsSchema,
    })
    .patch('/api/seller/shops/:shopId/settings', ({ authContext, params, body }: any) =>
      container.sellerShopService.updateShopSettings(actor(authContext), params.shopId, body), {
      withAuth: true,
      withSellerOperational: true,
      params: ShopParamsSchema,
      body: UpdateShopSettingsBodySchema,
    })
    .get('/api/seller/shops/:shopId/staff', ({ authContext, params }: any) =>
      container.shopStaffService.list(actor(authContext), params.shopId), {
      withAuth: true,
      params: ShopParamsSchema,
    })
    .post('/api/seller/shops/:shopId/staff', ({ authContext, params, body }: any) =>
      container.shopStaffService.invite(actor(authContext), params.shopId, body.email, body.role), {
      withAuth: true,
      params: ShopParamsSchema,
      body: StaffInviteBodySchema,
    })
    .patch('/api/seller/shops/:shopId/staff/:staffId', ({ authContext, params, body }: any) =>
      container.shopStaffService.update(actor(authContext), params.shopId, params.staffId, body), {
      withAuth: true,
      params: StaffParamsSchema,
      body: StaffUpdateBodySchema,
    })
    .delete('/api/seller/shops/:shopId/staff/:staffId', async ({ authContext, params }: any) =>
      container.shopStaffService.remove(actor(authContext), params.shopId, params.staffId), {
      withAuth: true,
      params: StaffParamsSchema,
    })
    .post('/api/seller/staff/invitations/:staffId/accept', ({ authContext, params }: any) =>
      container.shopStaffService.accept(actor(authContext), params.staffId), {
      withAuth: true,
      params: StaffInviteParamsSchema,
    })
    .get('/api/seller/staff/invitations', ({ authContext }: any) => container.shopStaffService.listInvitations(actor(authContext)), { withAuth: true })
}
