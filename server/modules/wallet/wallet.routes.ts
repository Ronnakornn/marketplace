import { moneyHttpError, moneyResponse, toMoneyDto, MoneyAmountError } from '#server/lib/money.ts'
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

export function createWalletRoutes(container: Pick<ServiceContainer, 'walletService'>) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof MoneyAmountError) return httpStatus(409, { error: { code: 'INVALID_MONEY_AMOUNT', message: error.message } })
      if (error instanceof WalletServiceError) {
        return moneyHttpError(error.status, toMoneyDto({
          error: { code: error.code, message: error.message, details: error.details ?? {} },
        }))
      }
    })
    .get('/api/seller/wallet', ({ authContext }: any) =>
      moneyResponse(container.walletService.getSellerWallet(actor(authContext))), {
      withAuth: true,
      withSellerOperational: true,
    })
    .get('/api/seller/wallet/transactions', ({ authContext, query }: any) =>
      moneyResponse(container.walletService.listSellerTransactions(actor(authContext), query)), {
      withAuth: true,
      withSellerOperational: true,
      query: PaginationQuery,
    })
}
