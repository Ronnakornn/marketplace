import type { Prisma, PrismaClient } from '#generated/client/client.ts'

export const historicalOrderInclude = {
  items: { include: { saleSnapshot: true } },
  shopOrders: { include: { saleSnapshot: true } },
} satisfies Prisma.OrderInclude
export type HistoricalOrder = Prisma.OrderGetPayload<{ include: typeof historicalOrderInclude }>

export class HistoricalReconciliationRepository {
  constructor(private readonly client: PrismaClient | Prisma.TransactionClient, private readonly bound = false) {}

  transaction<T>(work: (repository: HistoricalReconciliationRepository) => Promise<T>): Promise<T> {
    if (this.bound) return work(this)
    if (!('$transaction' in this.client)) throw new Error('A root Prisma client is required')
    return this.client.$transaction((tx) => work(new HistoricalReconciliationRepository(tx, true)))
  }

  async lockOrder(orderId: string): Promise<void> {
    await this.client.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId}::uuid FOR UPDATE`
  }

  findOrder(orderId: string): Promise<HistoricalOrder | null> {
    return this.client.order.findUnique({ where: { id: orderId }, include: historicalOrderInclude })
  }

  findActor(actorId: string) {
    return this.client.user.findUnique({ where: { id: actorId }, select: { role: true, status: true, emailVerified: true } })
  }

  createMissing(data: Prisma.ShopOrderUncheckedCreateInput) {
    return this.client.shopOrder.create({ data })
  }

  recordAudit(data: Prisma.AuditLogUncheckedCreateInput) {
    return this.client.auditLog.create({ data })
  }
}
