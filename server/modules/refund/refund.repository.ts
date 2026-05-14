import type { Order, Payment, PrismaClient, Refund, RefundStatus } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export type RefundRecord = Refund & {
  order: Order
  payment: Payment
}

export interface IRefundRepository {
  listRefunds(): Promise<RefundRecord[]>
  findRefundById(refundId: string): Promise<RefundRecord | null>
  updateRefundStatus(refundId: string, status: RefundStatus): Promise<RefundRecord>
}

const refundInclude = {
  order: true,
  payment: true,
} as const

export class PrismaRefundRepository implements IRefundRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  listRefunds(): Promise<RefundRecord[]> {
    this.logger.debug('PrismaRefundRepository.listRefunds')
    return this.prisma.refund.findMany({
      include: refundInclude,
      orderBy: { createdAt: 'desc' },
    })
  }

  findRefundById(refundId: string): Promise<RefundRecord | null> {
    this.logger.debug('PrismaRefundRepository.findRefundById', { refundId })
    return this.prisma.refund.findUnique({
      where: { id: refundId },
      include: refundInclude,
    })
  }

  updateRefundStatus(refundId: string, status: RefundStatus): Promise<RefundRecord> {
    this.logger.info('PrismaRefundRepository.updateRefundStatus', { refundId, status })
    return this.prisma.refund.update({
      where: { id: refundId },
      data: { status },
      include: refundInclude,
    })
  }
}
