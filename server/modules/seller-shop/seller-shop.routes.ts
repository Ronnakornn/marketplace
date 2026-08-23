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
}
