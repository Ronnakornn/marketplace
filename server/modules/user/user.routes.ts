import { moneyHttpError, moneyResponse, toMoneyDto, MoneyAmountError } from '#server/lib/money.ts'
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
  'phone',
  'phoneVerified',
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
const UpdateCurrentUserProfileBody = t.Partial(t.Pick(UserPlainInputUpdate, ['name', 'image', 'phone']))
const EmailBody = t.Object({ email: t.String({ format: 'email' }) })
const OtpEmailBody = t.Object({
  email: t.String({ format: 'email' }),
  otp: t.String({ minLength: 4 }),
})
const ResetPasswordBody = t.Object({
  email: t.String({ format: 'email' }),
  otp: t.String({ minLength: 4 }),
  newPassword: t.String({ minLength: 8 }),
})
const ChangePasswordBody = t.Object({
  currentPassword: t.String({ minLength: 1 }),
  newPassword: t.String({ minLength: 8 }),
})
const SuccessResponse = t.Object({ success: t.Boolean() })
const AddressParams = t.Object({
  addressId: t.String({ format: 'uuid' }),
})
const ProductFavoriteParams = t.Object({
  productId: t.String({ format: 'uuid' }),
})
const MAX_FAVORITE_STATUS_IDS = 100
const FavoriteStatusesBody = t.Object({
  productIds: t.Array(ProductFavoriteParams.properties.productId, { minItems: 1, maxItems: MAX_FAVORITE_STATUS_IDS }),
}, { additionalProperties: false })
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
      if (error instanceof MoneyAmountError) return httpStatus(409, { error: { code: 'INVALID_MONEY_AMOUNT', message: error.message } })
      if (error instanceof UserServiceError) {
        return moneyHttpError(error.status, toMoneyDto({ message: error.message }))
      }
    })
    .get('/api/me', ({ authContext }: any) => moneyResponse(container.userService.getCurrentUser(authContext!.user.id)), {
      withAuth: true,
      response: CurrentUserResponse,
    })
    .patch('/api/me', ({ authContext, body }: any) => moneyResponse(container.userService.updateCurrentUser(authContext!.user.id, body)), {
      withAuth: true,
      body: UpdateCurrentUserProfileBody,
      response: CurrentUserResponse,
    })
    .post('/api/auth/resend-email-verification', ({ authContext }: any) =>
      moneyResponse(container.userService.resendEmailVerification(authContext!.user.id)), {
      withAuth: true,
      response: SuccessResponse,
    })
    .post('/api/auth/verify-email-otp', ({ body }) => moneyResponse(container.userService.verifyEmailOtp(body.email, body.otp)), {
      body: OtpEmailBody,
      response: SuccessResponse,
    })
    .post('/api/auth/request-password-reset-otp', ({ body }) => moneyResponse(container.userService.requestPasswordResetOtp(body.email)), {
      body: EmailBody,
      response: SuccessResponse,
    })
    .post('/api/auth/complete-password-reset', ({ body }) =>
      moneyResponse(container.userService.completePasswordReset(body.email, body.otp, body.newPassword)), {
      body: ResetPasswordBody,
      response: SuccessResponse,
    })
    .post('/api/auth/change-password', ({ authContext, body }: any) =>
      moneyResponse(container.userService.changePassword(authContext!.user.id, body.currentPassword, body.newPassword)), {
      withVerifiedAuth: true,
      body: ChangePasswordBody,
      response: SuccessResponse,
    })
    .get('/api/addresses', ({ authContext }: any) => moneyResponse(container.userService.listAddresses(authContext!.user.id)), {
      withAuth: true,
    })
    .post('/api/addresses', ({ authContext, body }: any) => moneyResponse(container.userService.createAddress(authContext!.user.id, body)), {
      withAuth: true,
      body: AddressBody,
    })
    .patch('/api/addresses/:addressId', ({ authContext, params, body }: any) =>
      moneyResponse(container.userService.updateAddress(authContext!.user.id, params.addressId, body)), {
      withAuth: true,
      params: AddressParams,
      body: UpdateAddressBody,
    })
    .delete('/api/addresses/:addressId', async ({ authContext, params }: any) => {
      await container.userService.deleteAddress(authContext!.user.id, params.addressId)
      return moneyResponse({ success: true })
    }, {
      withAuth: true,
      params: AddressParams,
      response: t.Object({ success: t.Boolean() }),
    })
    .patch('/api/addresses/:addressId/default', ({ authContext, params }: any) =>
      moneyResponse(container.userService.setDefaultAddress(authContext!.user.id, params.addressId)), {
      withAuth: true,
      params: AddressParams,
    })
    .get('/api/me/favorites', ({ authContext }: any) =>
      moneyResponse(container.userService.listFavoriteProducts(authContext!.user.id)), {
      withAuth: true,
    })
    .get('/api/me/favorites/:productId', ({ authContext, params }: any) =>
      moneyResponse(container.userService.getFavoriteStatus(authContext!.user.id, params.productId)), {
      withAuth: true,
      params: ProductFavoriteParams,
    })
    .post('/api/me/favorites/statuses', ({ authContext, body }: any) =>
      moneyResponse(container.userService.getFavoriteStatuses(authContext!.user.id, body.productIds)), {
      withAuth: true,
      body: FavoriteStatusesBody,
      response: t.Record(t.String(), t.Boolean()),
    })
    .put('/api/me/favorites/:productId', ({ authContext, params }: any) =>
      moneyResponse(container.userService.addFavoriteProduct(authContext!.user.id, params.productId)), {
      withAuth: true,
      params: ProductFavoriteParams,
    })
    .delete('/api/me/favorites/:productId', ({ authContext, params }: any) =>
      moneyResponse(container.userService.removeFavoriteProduct(authContext!.user.id, params.productId)), {
      withAuth: true,
      params: ProductFavoriteParams,
    })
    .get('/api/me/followed-shops', ({ authContext }: any) =>
      moneyResponse(container.userService.listFollowedShops(authContext!.user.id)), {
      withAuth: true,
    })
    .get('/api/shops/:shopId/follow', ({ authContext, params }: any) =>
      moneyResponse(container.userService.getShopFollowStatus(authContext!.user.id, params.shopId)), {
      withAuth: true,
      params: ShopFollowParams,
    })
    .put('/api/shops/:shopId/follow', ({ authContext, params }: any) =>
      moneyResponse(container.userService.followShop(authContext!.user.id, params.shopId)), {
      withAuth: true,
      params: ShopFollowParams,
    })
    .delete('/api/shops/:shopId/follow', ({ authContext, params }: any) =>
      moneyResponse(container.userService.unfollowShop(authContext!.user.id, params.shopId)), {
      withAuth: true,
      params: ShopFollowParams,
    })
    .get('/api/users', () => moneyResponse(container.userService.listForAdmin()), {
      withRole: 'ADMIN',
      response: t.Array(AdminUserResponse),
    })
    .post('/api/users', ({ body }) => moneyResponse(container.userService.createForAdmin(body)), {
      withRole: 'ADMIN',
      body: CreateUserBody,
      response: AdminUserResponse,
    })
    .patch('/api/users/:id', ({ authContext, params: { id }, body }: any) => moneyResponse(container.userService.updateForAdmin(authContext!.user.id, id, body)), {
      withRole: 'ADMIN',
      params: t.Object({ id: t.String() }),
      body: UpdateUserBody,
      response: AdminUserResponse,
    })
    .patch('/api/users/:id/role', ({ authContext, params: { id }, body }: any) => moneyResponse(container.userService.updateRole(authContext!.user.id, id, body.role)), {
      withRole: 'ADMIN',
      params: t.Object({ id: t.String() }),
      body: UpdateUserRoleBody,
      response: AdminUserResponse,
    })
    .delete('/api/users/:id', async ({ authContext, params: { id } }: any) => {
      await container.userService.deleteForAdmin(authContext!.user.id, id)
      return moneyResponse({ success: true })
    }, {
      withRole: 'ADMIN',
      params: t.Object({ id: t.String() }),
      response: t.Object({ success: t.Boolean() }),
    })
}
