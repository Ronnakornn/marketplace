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
  role: t.Union([t.Literal('USER'), t.Literal('SELLER'), t.Literal('ADMIN')]),
})
const UpdateUserBody = t.Object({
  name: t.String({ minLength: 1 }),
  email: t.String({ format: 'email' }),
  role: t.Union([t.Literal('USER'), t.Literal('SELLER'), t.Literal('ADMIN')]),
})
const UpdateUserRoleBody = t.Required(t.Pick(UserPlainInputUpdate, ['role']))
const UpdateCurrentUserBody = t.Partial(t.Pick(UserPlainInputUpdate, ['name', 'image']))
const UpdateUserStatusBody = t.Object({
  status: t.Union([t.Literal('ACTIVE'), t.Literal('SUSPENDED')]),
})

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
    .get('/api/admin/users', () => container.userService.listForAdmin(), {
      withRole: 'ADMIN',
      response: t.Array(AdminUserResponse),
    })
    .post('/api/admin/users', ({ body }) => container.userService.createForAdmin(body), {
      withRole: 'ADMIN',
      body: CreateUserBody,
      response: AdminUserResponse,
    })
    .patch('/api/admin/users/:userId', ({ authContext, params: { userId }, body }: any) => container.userService.updateForAdmin(authContext!.user.id, userId, body), {
      withRole: 'ADMIN',
      params: t.Object({ userId: t.String() }),
      body: UpdateUserBody,
      response: AdminUserResponse,
    })
    .patch('/api/admin/users/:userId/role', ({ authContext, params: { userId }, body }: any) => container.userService.updateRole(authContext!.user.id, userId, body.role), {
      withRole: 'ADMIN',
      params: t.Object({ userId: t.String() }),
      body: UpdateUserRoleBody,
      response: AdminUserResponse,
    })
    .patch('/api/admin/users/:userId/status', ({ authContext, params: { userId }, body }: any) => container.userService.updateStatus(authContext!.user.id, userId, body.status), {
      withRole: 'ADMIN',
      params: t.Object({ userId: t.String() }),
      body: UpdateUserStatusBody,
      response: AdminUserResponse,
    })
    .delete('/api/admin/users/:userId', async ({ authContext, params: { userId } }: any) => {
      await container.userService.deleteForAdmin(authContext!.user.id, userId)
      return { success: true }
    }, {
      withRole: 'ADMIN',
      params: t.Object({ userId: t.String() }),
      response: t.Object({ success: t.Boolean() }),
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
