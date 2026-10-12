import type { PayoutCyclePolicy } from '#server/modules/admin-operations/payout-cycle.ts'
import type { PrismaClient, SellerPayout, Shop, ShopWallet, WalletLedgerEntry, User } from '#generated/client/client.ts'
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
  lockAdminGrants?(): Promise<void>
  findCycleRequester?(userId: string): Promise<Pick<User, 'id' | 'role' | 'status' | 'emailVerified'> | null>
  findCyclePolicies?(afterShopId?: string): Promise<PayoutCyclePolicy[]>
  findCyclePolicy?(shopId: string): Promise<PayoutCyclePolicy | null>
  findCyclePayout?(shopId: string, cycleKey: string): Promise<PayoutRecord | null>
  validatePaidEvidence?(input: { evidenceId: string; payoutId: string; amount: bigint; currency: string; externalReference: string; actorId: string }): Promise<string>
  auditOperation?(actorId: string, payoutId: string, action: string, details: { [key: string]: string }): Promise<void>
  findSellerShops(ownerId: string): Promise<Array<Pick<Shop, 'id' | 'name' | 'ownerId'>>>
  ensureWallet(shopId: string, currency: string): Promise<ShopWallet>
  findWalletByShopId(shopId: string): Promise<(ShopWallet & { shop: Pick<Shop, 'id' | 'name' | 'ownerId'> }) | null>
  lockWallet(walletId: string): Promise<void>
  sumLedger(walletId: string, currency: string): Promise<bigint>
  createPayout(input: { walletId: string; shopId: string; amount: bigint | number; currency: string; requestedById: string; cycleKey?: string }): Promise<PayoutRecord>
  createLedgerEntry(input: {
    walletId: string
    shopId: string
    payoutId: string
    type: 'payout_reserved' | 'payout_paid' | 'payout_rejected'
    amount: bigint | number
    currency: string
    description?: string | null
  }): Promise<WalletLedgerEntry>
  listSellerPayouts(shopIds: string[]): Promise<PayoutRecord[]>
  listAdminPayouts(status?: PayoutStatus): Promise<PayoutRecord[]>
  lockPayout(payoutId: string): Promise<void>
  findPayoutById(payoutId: string): Promise<PayoutRecord | null>
  updatePayout(payoutId: string, data: Partial<Pick<SellerPayout, 'status' | 'approvedById' | 'rejectedById' | 'paidById' | 'externalReference' | 'rejectionReason' | 'approvedAt' | 'rejectedAt' | 'paidAt' | 'evidenceUploadId'>>): Promise<PayoutRecord>
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

  async lockAdminGrants(): Promise<void> {
    await this.prisma
      .$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(719362804)`
  }

  findCycleRequester(
    userId: string,
  ): Promise<Pick<User, 'id' | 'role' | 'status' | 'emailVerified'> | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true, emailVerified: true },
    })
  }

  findCyclePolicies(afterShopId?: string): Promise<PayoutCyclePolicy[]> {
    return this.prisma.shopOperationPolicy.findMany({
      where: {
        ...(afterShopId ? { shopId: { gt: afterShopId } } : {}),
        payoutCadence: { in: ['DAILY', 'WEEKLY', 'MONTHLY'] },
        shop: { status: 'ACTIVE', deletedAt: null },
      },
      include: { shop: { select: { id: true, ownerId: true, status: true } } },
      orderBy: { shopId: 'asc' },
      take: 100,
    })
  }

  findCyclePolicy(shopId: string): Promise<PayoutCyclePolicy | null> {
    return this.prisma.shopOperationPolicy.findUnique({
      where: { shopId },
      include: { shop: { select: { id: true, ownerId: true, status: true } } },
    })
  }

  findCyclePayout(
    shopId: string,
    cycleKey: string,
  ): Promise<PayoutRecord | null> {
    return this.prisma.sellerPayout.findUnique({
      where: { shopId_cycleKey: { shopId, cycleKey } },
      include: payoutInclude,
    })
  }

  async validatePaidEvidence(input: {
    evidenceId: string
    payoutId: string
    amount: bigint
    currency: string
    externalReference: string
    actorId: string
  }): Promise<string> {
    await this.prisma
      .$queryRaw`SELECT "id" FROM "FinanceReconciliation" WHERE "id" = ${input.evidenceId}::uuid FOR UPDATE`
    const evidence = await this.prisma.financeReconciliation.findUnique({
      where: { id: input.evidenceId },
    })
    if (
      !evidence ||
      evidence.kind !== 'PAYOUT_EVIDENCE' ||
      evidence.payoutId !== input.payoutId ||
      evidence.status === 'REJECTED' ||
      evidence.amount !== input.amount ||
      evidence.currency !== input.currency ||
      evidence.externalReference !== input.externalReference ||
      !evidence.uploadId
    )
      throw new Error(
        'Payout evidence must match its amount, currency and external reference',
      )
    const upload = await this.prisma.upload.findUnique({
      where: { id: evidence.uploadId },
    })
    if (
      !upload ||
      upload.usage !== 'FINANCE_EVIDENCE' ||
      upload.status !== 'COMPLETED' ||
      upload.publicUrl ||
      !upload.key.startsWith('private/')
    )
      throw new Error(
        'Payout evidence requires a completed private finance upload',
      )
    await this.prisma.financeReconciliation.update({
      where: { id: evidence.id },
      data: {
        status: 'MATCHED',
        reviewedById: input.actorId,
        reviewedAt: new Date(),
        version: { increment: 1 },
      },
    })
    return upload.id
  }

  async auditOperation(
    actorId: string,
    payoutId: string,
    action: string,
    details: { [key: string]: string },
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actorId,
        actorRole: 'ADMIN',
        action: 'PAYOUT_STATUS_CHANGED',
        entityType: 'payout',
        entityId: payoutId,
        after: { action, ...details },
      },
    })
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

  async lockWallet(walletId: string): Promise<void> {
    await this.prisma.$queryRaw`SELECT "id" FROM "ShopWallet" WHERE "id" = ${walletId}::uuid FOR UPDATE`
  }

  async sumLedger(walletId: string, currency: string): Promise<bigint> {
    const result = await this.prisma.walletLedgerEntry.aggregate({
      where: { walletId, currency },
      _sum: { amount: true },
    })
    return result._sum.amount ?? 0n
  }

  createPayout(input: { walletId: string; shopId: string; amount: bigint | number; currency: string; requestedById: string; cycleKey?: string }): Promise<PayoutRecord> {
    this.logger.info('PrismaPayoutRepository.createPayout', { shopId: input.shopId, amount: input.amount })
    return this.prisma.sellerPayout.create({
      data: {
        walletId: input.walletId,
        shopId: input.shopId,
        amount: input.amount,
        currency: input.currency,
        requestedById: input.requestedById,
        cycleKey: input.cycleKey,
      },
      include: payoutInclude,
    })
  }

  createLedgerEntry(input: {
    walletId: string
    shopId: string
    payoutId: string
    type: 'payout_reserved' | 'payout_paid' | 'payout_rejected'
    amount: bigint | number
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

  async lockPayout(payoutId: string): Promise<void> {
    await this.prisma.$queryRaw`SELECT "id" FROM "SellerPayout" WHERE "id" = ${payoutId}::uuid FOR UPDATE`
  }

  updatePayout(payoutId: string, data: Partial<Pick<SellerPayout, 'status' | 'approvedById' | 'rejectedById' | 'paidById' | 'externalReference' | 'rejectionReason' | 'approvedAt' | 'rejectedAt' | 'paidAt' | 'evidenceUploadId'>>): Promise<PayoutRecord> {
    return this.prisma.sellerPayout.update({
      where: { id: payoutId },
      data,
      include: payoutInclude,
    })
  }
}
