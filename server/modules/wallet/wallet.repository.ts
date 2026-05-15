import type {
  Order,
  OrderItem,
  PrismaClient,
  SellerWallet,
  Shop,
  WalletLedgerEntry,
  WalletLedgerEntryType,
} from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

type WalletTx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

export type WalletRecord = SellerWallet & { shop: Pick<Shop, 'id' | 'name' | 'ownerId'> }
export type WalletEntryRecord = WalletLedgerEntry
export type CompletedOrderRecord = Order & { items: OrderItem[] }

export interface CreateLedgerEntryInput {
  walletId: string
  shopId: string
  type: WalletLedgerEntryType
  amountCents: number
  currency: string
  orderId?: string | null
  payoutId?: string | null
  refundId?: string | null
  description?: string | null
  metadata?: unknown
}

export interface IWalletRepository {
  transaction<T>(callback: (repo: IWalletRepository) => Promise<T>): Promise<T>
  findSellerShops(ownerId: string): Promise<Array<Pick<Shop, 'id' | 'name' | 'ownerId'>>>
  findWalletByShopId(shopId: string): Promise<WalletRecord | null>
  ensureWallet(shopId: string, currency: string): Promise<SellerWallet>
  listEntries(walletId: string, limit: number, offset: number): Promise<WalletEntryRecord[]>
  sumLedger(walletId: string): Promise<number>
  createLedgerEntry(input: CreateLedgerEntryInput): Promise<WalletLedgerEntry>
  findCompletedOrder(orderId: string): Promise<CompletedOrderRecord | null>
  hasOrderEarnings(orderId: string, shopId: string): Promise<boolean>
}

export class PrismaWalletRepository implements IWalletRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient | WalletTx,
  ) {
    this.logger = appContext.logger
  }

  transaction<T>(callback: (repo: IWalletRepository) => Promise<T>): Promise<T> {
    const client = this.prisma as PrismaClient
    if (typeof client.$transaction !== 'function') return callback(this)
    return client.$transaction((tx) =>
      callback(new PrismaWalletRepository({ logger: this.logger, config: { environment: 'transaction' } }, tx)),
    )
  }

  findSellerShops(ownerId: string): Promise<Array<Pick<Shop, 'id' | 'name' | 'ownerId'>>> {
    this.logger.debug('PrismaWalletRepository.findSellerShops', { ownerId })
    return this.prisma.shop.findMany({
      where: { ownerId },
      select: { id: true, name: true, ownerId: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  findWalletByShopId(shopId: string): Promise<WalletRecord | null> {
    this.logger.debug('PrismaWalletRepository.findWalletByShopId', { shopId })
    return this.prisma.sellerWallet.findUnique({
      where: { shopId },
      include: { shop: { select: { id: true, name: true, ownerId: true } } },
    })
  }

  ensureWallet(shopId: string, currency: string): Promise<SellerWallet> {
    this.logger.info('PrismaWalletRepository.ensureWallet', { shopId })
    return this.prisma.sellerWallet.upsert({
      where: { shopId },
      create: { shopId, currency },
      update: {},
    })
  }

  listEntries(walletId: string, limit: number, offset: number): Promise<WalletEntryRecord[]> {
    this.logger.debug('PrismaWalletRepository.listEntries', { walletId, limit, offset })
    return this.prisma.walletLedgerEntry.findMany({
      where: { walletId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      skip: offset,
    })
  }

  async sumLedger(walletId: string): Promise<number> {
    const result = await this.prisma.walletLedgerEntry.aggregate({
      where: { walletId },
      _sum: { amountCents: true },
    })
    return result._sum.amountCents ?? 0
  }

  createLedgerEntry(input: CreateLedgerEntryInput): Promise<WalletLedgerEntry> {
    this.logger.info('PrismaWalletRepository.createLedgerEntry', {
      walletId: input.walletId,
      type: input.type,
      amountCents: input.amountCents,
    })
    return this.prisma.walletLedgerEntry.create({
      data: {
        walletId: input.walletId,
        shopId: input.shopId,
        type: input.type,
        amountCents: input.amountCents,
        currency: input.currency,
        orderId: input.orderId ?? null,
        payoutId: input.payoutId ?? null,
        refundId: input.refundId ?? null,
        description: input.description ?? null,
        metadata: input.metadata === undefined ? undefined : input.metadata as never,
      },
    })
  }

  findCompletedOrder(orderId: string): Promise<CompletedOrderRecord | null> {
    this.logger.debug('PrismaWalletRepository.findCompletedOrder', { orderId })
    return this.prisma.order.findFirst({
      where: {
        id: orderId,
        status: { in: ['DELIVERED', 'FULFILLED'] },
        paymentStatus: 'SUCCEEDED',
      },
      include: { items: true },
    })
  }

  async hasOrderEarnings(orderId: string, shopId: string): Promise<boolean> {
    const count = await this.prisma.walletLedgerEntry.count({
      where: { orderId, shopId, type: 'order_earning' },
    })
    return count > 0
  }
}
