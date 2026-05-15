import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { WalletServiceError } from './wallet.errors.ts'

const PaginationQuery = t.Object({
  page: t.Optional(t.Number({ minimum: 1 })),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
})

function actor(authContext: any) {
  return { id: authContext!.user.id, role: authContext!.user.role }
}

export function createWalletRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof WalletServiceError) {
        return httpStatus(error.status, {
          error: { code: error.code, message: error.message, details: error.details ?? {} },
        })
      }
    })
    .get('/api/seller/wallet', ({ authContext }: any) =>
      container.walletService.getSellerWallet(actor(authContext)), {
      withRole: 'SELLER',
    })
    .get('/api/seller/wallet/transactions', ({ authContext, query }: any) =>
      container.walletService.listSellerTransactions(actor(authContext), query), {
      withRole: 'SELLER',
      query: PaginationQuery,
    })
}
