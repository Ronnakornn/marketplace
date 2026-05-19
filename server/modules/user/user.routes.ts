import { Elysia, status as httpStatus, t } from 'elysia'
import { authPlugin } from '#server/modules/auth'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { UserPlain, UserPlainInputUpdate } from '#generated/prismabox/User.ts'
import { UserServiceError } from './user.errors.ts'

const CurrentUserResponse = t.Pick(UserPlain, [
  'id',
  'name',
  'email',
  'role',
  'status',
  'emailVerified',
  'image',
  'createdAt',
  'updatedAt',
])
const AdminUserResponse = t.Pick(UserPlain, ['id', 'name', 'email', 'role', 'status', 'createdAt', 'updatedAt'])
const CreateUserBody = t.Object({
  name: t.String({ minLength: 1 }),
  email: t.String({ format: 'email' }),
  password: t.String({ minLength: 8 }),
  role: t.Union([t.Literal('USER'), t.Literal('ADMIN')]),
})
const UpdateUserBody = t.Object({
  name: t.String({ minLength: 1 }),
  email: t.String({ format: 'email' }),
  role: t.Union([t.Literal('USER'), t.Literal('ADMIN')]),
})
const UpdateUserRoleBody = t.Required(t.Pick(UserPlainInputUpdate, ['role']))
const UpdateCurrentUserBody = t.Partial(t.Pick(UserPlainInputUpdate, ['name', 'image']))
const AddressParams = t.Object({
  addressId: t.String({ format: 'uuid' }),
})
const ProductFavoriteParams = t.Object({
  productId: t.String({ format: 'uuid' }),
})
const ShopFollowParams = t.Object({
  shopId: t.String({ format: 'uuid' }),
})
const AddressBody = t.Object({
  recipientName: t.String({ minLength: 1 }),
  phone: t.Optional(t.Nullable(t.String())),
  line1: t.String({ minLength: 1 }),
  line2: t.Optional(t.Nullable(t.String())),
  city: t.String({ minLength: 1 }),
  region: t.Optional(t.Nullable(t.String())),
  postalCode: t.String({ minLength: 1 }),
  country: t.String({ minLength: 1 }),
  isDefault: t.Optional(t.Boolean()),
})
const UpdateAddressBody = t.Partial(AddressBody)

export function createUserRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof UserServiceError) {
        return httpStatus(error.status, { message: error.message })
      }
    })
    .get('/api/me', ({ authContext }: any) => container.userService.getCurrentUser(authContext!.user.id), {
      withAuth: true,
      response: CurrentUserResponse,
    })
    .patch('/api/me', ({ authContext, body }: any) => container.userService.updateCurrentUser(authContext!.user.id, body), {
      withAuth: true,
      body: UpdateCurrentUserBody,
      response: CurrentUserResponse,
    })
    .get('/api/addresses', ({ authContext }: any) => container.userService.listAddresses(authContext!.user.id), {
      withAuth: true,
    })
    .post('/api/addresses', ({ authContext, body }: any) => container.userService.createAddress(authContext!.user.id, body), {
      withAuth: true,
      body: AddressBody,
    })
    .patch('/api/addresses/:addressId', ({ authContext, params, body }: any) =>
      container.userService.updateAddress(authContext!.user.id, params.addressId, body), {
      withAuth: true,
      params: AddressParams,
      body: UpdateAddressBody,
    })
    .delete('/api/addresses/:addressId', async ({ authContext, params }: any) => {
      await container.userService.deleteAddress(authContext!.user.id, params.addressId)
      return { success: true }
    }, {
      withAuth: true,
      params: AddressParams,
      response: t.Object({ success: t.Boolean() }),
    })
    .patch('/api/addresses/:addressId/default', ({ authContext, params }: any) =>
      container.userService.setDefaultAddress(authContext!.user.id, params.addressId), {
      withAuth: true,
      params: AddressParams,
    })
    .get('/api/me/favorites', ({ authContext }: any) =>
      container.userService.listFavoriteProducts(authContext!.user.id), {
      withAuth: true,
    })
    .get('/api/me/favorites/:productId', ({ authContext, params }: any) =>
      container.userService.getFavoriteStatus(authContext!.user.id, params.productId), {
      withAuth: true,
      params: ProductFavoriteParams,
    })
    .put('/api/me/favorites/:productId', ({ authContext, params }: any) =>
      container.userService.addFavoriteProduct(authContext!.user.id, params.productId), {
      withAuth: true,
      params: ProductFavoriteParams,
    })
    .delete('/api/me/favorites/:productId', ({ authContext, params }: any) =>
      container.userService.removeFavoriteProduct(authContext!.user.id, params.productId), {
      withAuth: true,
      params: ProductFavoriteParams,
    })
    .get('/api/me/followed-shops', ({ authContext }: any) =>
      container.userService.listFollowedShops(authContext!.user.id), {
      withAuth: true,
    })
    .get('/api/shops/:shopId/follow', ({ authContext, params }: any) =>
      container.userService.getShopFollowStatus(authContext!.user.id, params.shopId), {
      withAuth: true,
      params: ShopFollowParams,
    })
    .put('/api/shops/:shopId/follow', ({ authContext, params }: any) =>
      container.userService.followShop(authContext!.user.id, params.shopId), {
      withAuth: true,
      params: ShopFollowParams,
    })
    .delete('/api/shops/:shopId/follow', ({ authContext, params }: any) =>
      container.userService.unfollowShop(authContext!.user.id, params.shopId), {
      withAuth: true,
      params: ShopFollowParams,
    })
    .get('/api/users', () => container.userService.listForAdmin(), {
      withRole: 'ADMIN',
      response: t.Array(AdminUserResponse),
    })
    .post('/api/users', ({ body }) => container.userService.createForAdmin(body), {
      withRole: 'ADMIN',
      body: CreateUserBody,
      response: AdminUserResponse,
    })
    .patch('/api/users/:id', ({ authContext, params: { id }, body }: any) => container.userService.updateForAdmin(authContext!.user.id, id, body), {
      withRole: 'ADMIN',
      params: t.Object({ id: t.String() }),
      body: UpdateUserBody,
      response: AdminUserResponse,
    })
    .patch('/api/users/:id/role', ({ authContext, params: { id }, body }: any) => container.userService.updateRole(authContext!.user.id, id, body.role), {
      withRole: 'ADMIN',
      params: t.Object({ id: t.String() }),
      body: UpdateUserRoleBody,
      response: AdminUserResponse,
    })
    .delete('/api/users/:id', async ({ authContext, params: { id } }: any) => {
      await container.userService.deleteForAdmin(authContext!.user.id, id)
      return { success: true }
    }, {
      withRole: 'ADMIN',
      params: t.Object({ id: t.String() }),
      response: t.Object({ success: t.Boolean() }),
    })
}
