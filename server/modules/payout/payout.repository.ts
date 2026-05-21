import type { PrismaClient, SellerPayout, Shop, ShopWallet, WalletLedgerEntry } from '#generated/client/client.ts'
import type { PayoutStatus } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

type PayoutTx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

export type PayoutRecord = SellerPayout & {
  wallet: ShopWallet
  shop: Pick<Shop, 'id' | 'name' | 'ownerId'>
}

export interface IPayoutRepository {
  transaction<T>(callback: (repo: IPayoutRepository) => Promise<T>): Promise<T>
  findSellerShops(ownerId: string): Promise<Array<Pick<Shop, 'id' | 'name' | 'ownerId'>>>
  ensureWallet(shopId: string, currency: string): Promise<ShopWallet>
  findWalletByShopId(shopId: string): Promise<(ShopWallet & { shop: Pick<Shop, 'id' | 'name' | 'ownerId'> }) | null>
  sumLedger(walletId: string): Promise<number>
  createPayout(input: { walletId: string; shopId: string; amount: number; currency: string; requestedById: string }): Promise<PayoutRecord>
  createLedgerEntry(input: {
    walletId: string
    shopId: string
    payoutId: string
    type: 'payout_reserved' | 'payout_paid' | 'payout_rejected'
    amount: number
    currency: string
    description?: string | null
  }): Promise<WalletLedgerEntry>
  listSellerPayouts(shopIds: string[]): Promise<PayoutRecord[]>
  listAdminPayouts(status?: PayoutStatus): Promise<PayoutRecord[]>
  findPayoutById(payoutId: string): Promise<PayoutRecord | null>
  updatePayout(payoutId: string, data: Partial<Pick<SellerPayout, 'status' | 'approvedById' | 'rejectedById' | 'paidById' | 'rejectionReason' | 'approvedAt' | 'rejectedAt' | 'paidAt'>>): Promise<PayoutRecord>
}

const payoutInclude = {
  wallet: true,
  shop: {
    select: {
      id: true,
      name: true,
      ownerId: true,
    },
  },
} as const

export class PrismaPayoutRepository implements IPayoutRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient | PayoutTx,
  ) {
    this.logger = appContext.logger
  }

  transaction<T>(callback: (repo: IPayoutRepository) => Promise<T>): Promise<T> {
    const client = this.prisma as PrismaClient
    if (typeof client.$transaction !== 'function') return callback(this)
    return client.$transaction((tx) =>
      callback(new PrismaPayoutRepository({ logger: this.logger, config: { environment: 'transaction' } }, tx)),
    )
  }

  findSellerShops(ownerId: string): Promise<Array<Pick<Shop, 'id' | 'name' | 'ownerId'>>> {
    return this.prisma.shop.findMany({
      where: { ownerId, status: 'ACTIVE' },
      select: { id: true, name: true, ownerId: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  ensureWallet(shopId: string, currency: string): Promise<ShopWallet> {
    return this.prisma.shopWallet.upsert({
      where: { shopId },
      create: { shopId, currency },
      update: {},
    })
  }

  findWalletByShopId(shopId: string): Promise<(ShopWallet & { shop: Pick<Shop, 'id' | 'name' | 'ownerId'> }) | null> {
    return this.prisma.shopWallet.findUnique({
      where: { shopId },
      include: { shop: { select: { id: true, name: true, ownerId: true } } },
    })
  }

  async sumLedger(walletId: string): Promise<number> {
    const result = await this.prisma.walletLedgerEntry.aggregate({
      where: { walletId },
      _sum: { amount: true },
    })
    return Number(result._sum.amount ?? 0)
  }

  createPayout(input: { walletId: string; shopId: string; amount: number; currency: string; requestedById: string }): Promise<PayoutRecord> {
    this.logger.info('PrismaPayoutRepository.createPayout', { shopId: input.shopId, amount: input.amount })
    return this.prisma.sellerPayout.create({
      data: {
        walletId: input.walletId,
        shopId: input.shopId,
        amount: input.amount,
        currency: input.currency,
        requestedById: input.requestedById,
      },
      include: payoutInclude,
    })
  }

  createLedgerEntry(input: {
    walletId: string
    shopId: string
    payoutId: string
    type: 'payout_reserved' | 'payout_paid' | 'payout_rejected'
    amount: number
    currency: string
    description?: string | null
  }): Promise<WalletLedgerEntry> {
    return this.prisma.walletLedgerEntry.create({
      data: {
        walletId: input.walletId,
        shopId: input.shopId,
        payoutId: input.payoutId,
        type: input.type,
        amount: input.amount,
        currency: input.currency,
        description: input.description ?? null,
      },
    })
  }

  listSellerPayouts(shopIds: string[]): Promise<PayoutRecord[]> {
    if (shopIds.length === 0) return Promise.resolve([])
    return this.prisma.sellerPayout.findMany({
      where: { shopId: { in: shopIds } },
      include: payoutInclude,
      orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
    })
  }

  listAdminPayouts(status?: PayoutStatus): Promise<PayoutRecord[]> {
    return this.prisma.sellerPayout.findMany({
      where: status ? { status } : undefined,
      include: payoutInclude,
      orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
    })
  }

  findPayoutById(payoutId: string): Promise<PayoutRecord | null> {
    return this.prisma.sellerPayout.findUnique({
      where: { id: payoutId },
      include: payoutInclude,
    })
  }

  updatePayout(payoutId: string, data: Partial<Pick<SellerPayout, 'status' | 'approvedById' | 'rejectedById' | 'paidById' | 'rejectionReason' | 'approvedAt' | 'rejectedAt' | 'paidAt'>>): Promise<PayoutRecord> {
    return this.prisma.sellerPayout.update({
      where: { id: payoutId },
      data,
      include: payoutInclude,
    })
  }
}
