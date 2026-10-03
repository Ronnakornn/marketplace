import type {
  Order,
  OrderItem,
  PrismaClient,
  ShopWallet,
  Shop,
  WalletLedgerEntry,
  WalletLedgerEntryType,
  Prisma,
} from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

type WalletTx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

export type WalletRecord = ShopWallet & { shop: Pick<Shop, 'id' | 'name' | 'ownerId'> }
export type WalletEntryRecord = WalletLedgerEntry
const completedOrderInclude = {
  items: { include: { saleSnapshot: { include: { refundAllocations: { include: { refund: { select: { status: true } } } } } } } },
  shopOrders: { include: { saleSnapshot: { include: { refundAllocations: { include: { refund: { select: { status: true } } } } } } } },
} as const
type SnapshottedOrder = Prisma.OrderGetPayload<{ include: typeof completedOrderInclude }>
export type CompletedOrderRecord = Order & {
  items: Array<OrderItem & { saleSnapshot?: SnapshottedOrder['items'][number]['saleSnapshot'] }>
  shopOrders?: SnapshottedOrder['shopOrders']
}

export interface CreateLedgerEntryInput {
  walletId: string
  shopId: string
  type: WalletLedgerEntryType
  amount: number
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
  ensureWallet(shopId: string, currency: string): Promise<ShopWallet>
  listEntries(walletId: string, limit: number, offset: number): Promise<WalletEntryRecord[]>
  sumLedger(walletId: string, currency: string): Promise<number>
  sumReservedPayouts(walletId: string, currency: string): Promise<number>
  createLedgerEntry(input: CreateLedgerEntryInput): Promise<WalletLedgerEntry>
  lockOrder(orderId: string): Promise<void>
  findCompletedOrder(orderId: string): Promise<CompletedOrderRecord | null>
  hasOrderEarnings(orderId: string, shopId: string): Promise<boolean>
  lockWallet(walletId: string): Promise<void>
  recognizeShopSale(shopOrderId: string, recognizedAt: Date): Promise<void>
}

export class PrismaWalletRepository implements IWalletRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient | WalletTx,
    private inTransaction = false,
  ) {
    this.logger = appContext.logger
  }

  transaction<T>(callback: (repo: IWalletRepository) => Promise<T>): Promise<T> {
    if (this.inTransaction) return callback(this)
    const client = this.prisma as PrismaClient
    return client.$transaction((tx) =>
      callback(new PrismaWalletRepository({ logger: this.logger, config: { environment: 'transaction' } }, tx, true)),
    )
  }

  findSellerShops(ownerId: string): Promise<Array<Pick<Shop, 'id' | 'name' | 'ownerId'>>> {
    this.logger.debug('PrismaWalletRepository.findSellerShops', { ownerId })
    return this.prisma.shop.findMany({
      where: { ownerId, status: 'ACTIVE' },
      select: { id: true, name: true, ownerId: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  findWalletByShopId(shopId: string): Promise<WalletRecord | null> {
    this.logger.debug('PrismaWalletRepository.findWalletByShopId', { shopId })
    return this.prisma.shopWallet.findUnique({
      where: { shopId },
      include: { shop: { select: { id: true, name: true, ownerId: true } } },
    })
  }

  ensureWallet(shopId: string, currency: string): Promise<ShopWallet> {
    this.logger.info('PrismaWalletRepository.ensureWallet', { shopId })
    return this.prisma.shopWallet.upsert({
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

  async sumLedger(walletId: string, currency: string): Promise<number> {
    const result = await this.prisma.walletLedgerEntry.aggregate({
      where: { walletId, currency },
      _sum: { amount: true },
    })
    return Number(result._sum.amount ?? 0)
  }

  async sumReservedPayouts(walletId: string, currency: string): Promise<number> {
    const result = await this.prisma.sellerPayout.aggregate({
      where: { walletId, currency, status: { in: ['requested', 'approved'] } }, _sum: { amount: true },
    })
    return Number(result._sum.amount ?? 0)
  }

  async lockWallet(walletId: string): Promise<void> {
    await this.prisma.$queryRaw`SELECT "id" FROM "ShopWallet" WHERE "id" = ${walletId}::uuid FOR UPDATE`
  }

  async recognizeShopSale(shopOrderId: string, recognizedAt: Date): Promise<void> {
    await this.prisma.shopSaleSnapshot.update({ where: { shopOrderId }, data: { recognizedAt } })
    await this.prisma.refundShopAllocation.updateMany({
      where: { shopOrderId, refund: { status: 'SUCCESS' }, walletPostedAt: null }, data: { walletPostedAt: recognizedAt },
    })
  }

  createLedgerEntry(input: CreateLedgerEntryInput): Promise<WalletLedgerEntry> {
    this.logger.info('PrismaWalletRepository.createLedgerEntry', {
      walletId: input.walletId,
      type: input.type,
      amount: input.amount,
    })
    return this.prisma.walletLedgerEntry.create({
      data: {
        walletId: input.walletId,
        shopId: input.shopId,
        type: input.type,
        amount: input.amount,
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
      include: completedOrderInclude,
    })
  }

  async lockOrder(orderId: string): Promise<void> {
    await this.prisma.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId}::uuid FOR UPDATE`
  }

  async hasOrderEarnings(orderId: string, shopId: string): Promise<boolean> {
    const count = await this.prisma.walletLedgerEntry.count({
      where: { orderId, shopId, type: 'order_earning' },
    })
    return count > 0
  }
}
