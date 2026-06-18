import { Elysia, status as httpStatus, t } from 'elysia'
import { CartItemPlainInputCreate, CartItemPlainInputUpdate } from '#generated/prismabox/CartItem.ts'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { CartServiceError } from './cart.errors.ts'

const CartItemParamsSchema = t.Object({
  itemId: t.String({ format: 'uuid' }),
})

const AddCartItemBodySchema = t.Composite([
  t.Pick(CartItemPlainInputCreate, ['quantity']),
  t.Object({
    variantId: t.String({ format: 'uuid' }),
    sessionId: t.Optional(t.String({ maxLength: 128 })),
    source: t.Optional(t.String({ maxLength: 64 })),
  }),
])

const UpdateCartItemBodySchema = t.Required(t.Pick(CartItemPlainInputUpdate, ['quantity']))
const LocaleQuerySchema = t.Object({
  locale: t.Optional(t.Union([t.Literal('th'), t.Literal('en')])),
})

export function createCartRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof CartServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .get('/api/cart', ({ authContext, query }: any) =>
      query.locale
        ? container.cartService.getCart(authContext!.user, query.locale)
        : container.cartService.getCart(authContext!.user), {
      withAuth: true,
      query: LocaleQuerySchema,
    })
    .post('/api/cart/items', ({ authContext, body }: any) => container.cartService.addItem(authContext!.user, body), {
      withAuth: true,
      body: AddCartItemBodySchema,
    })
    .patch('/api/cart/items/:itemId', ({ authContext, params, body }: any) =>
      container.cartService.updateItem(authContext!.user, params.itemId, body), {
      withAuth: true,
      params: CartItemParamsSchema,
      body: UpdateCartItemBodySchema,
    })
    .delete('/api/cart/items/:itemId', ({ authContext, params }: any) =>
      container.cartService.deleteItem(authContext!.user, params.itemId), {
      withAuth: true,
      params: CartItemParamsSchema,
    })
    .delete('/api/cart', ({ authContext }: any) => container.cartService.clearCart(authContext!.user), {
      withAuth: true,
    })
}
