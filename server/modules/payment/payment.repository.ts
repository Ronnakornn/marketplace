import { moneyNumber, moneyInteger } from '#server/lib/money.ts'
import type {
  Checkout,
  FlashSaleReservation,
  InventoryReservation,
  Order,
  OrderItem,
  Payment,
  PaymentEvent,
  PrismaClient,
} from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { PrismaAffiliateRepository, type IAffiliateCommissionRepository } from '#server/modules/affiliate'
import type {
  IShipmentCreationRepository,
} from '#server/modules/shipment/shipment.repository.ts'
import { PrismaShipmentRepository } from '#server/modules/shipment/shipment.repository.ts'
import type { PaymentWebhookBody } from './payment.types.ts'
import { releasePendingBuyerCoins } from '#server/modules/promotion/buyer-coin.transitions.ts'

type PaymentTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

export type PaymentWithOrder = Payment & {
  order: Order & {
    checkout: Checkout & {
      inventoryReservations: InventoryReservation[]
      flashSaleReservations: FlashSaleReservation[]
    }
    items: OrderItem[]
    buyerCoinLedgerEntries: Array<{ id: string; walletId: string; amount: bigint | number; status: string; type: string }>
  }
}

export interface ReleaseReservationInput {
  reservationId: string
  inventoryId: string
  quantity: number
}

export interface PaymentStateTransitionInput {
  paymentId: string
  orderId: string
  checkoutId: string
  eventType: 'payment.paid' | 'payment.failed' | 'payment.expired' | 'buyer.cancelled'
  reservations: ReleaseReservationInput[]
  occurredAt: Date
}

export interface IPaymentTransactionRepository {
  lockWebhookEvent(providerRef: string): Promise<void>
  lockPayment(paymentId: string): Promise<void>
  findPayment(paymentId: string): Promise<PaymentWithOrder | null>
  findPaymentForOrder(orderId: string): Promise<PaymentWithOrder | null>
  findOrder(orderId: string): Promise<Order | null>
  findWebhookEvent(providerRef: string): Promise<PaymentEvent | null>
  createWebhookEvent(input: PaymentWebhookBody): Promise<PaymentEvent>
  /** Keeps Payment.status and the denormalized Order.paymentStatus in sync. */
  applyPaymentStateTransition(input: PaymentStateTransitionInput): Promise<void>
}

export interface PaymentTransactionContext {
  payment: IPaymentTransactionRepository
  affiliate: IAffiliateCommissionRepository
  shipment: IShipmentCreationRepository
}

export interface PaymentSettlementContext {
  payment: Pick<IPaymentTransactionRepository, 'applyPaymentStateTransition'>
  affiliate: IAffiliateCommissionRepository
  shipment: IShipmentCreationRepository
}

export interface IPaymentRepository extends IPaymentTransactionRepository {
  transaction<T>(callback: (context: PaymentTransactionContext) => Promise<T>): Promise<T>
}

const paymentInclude = {
  order: {
    include: {
      items: true,
      checkout: {
        include: {
          inventoryReservations: true,
          flashSaleReservations: true,
        },
      },
      buyerCoinLedgerEntries: true,
    },
  },
} as const

export class PrismaPaymentRepository implements IPaymentRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient | PaymentTx,
  ) {
    this.logger = appContext.logger
  }

  transaction<T>(callback: (context: PaymentTransactionContext) => Promise<T>): Promise<T> {
    const client = this.prisma as PrismaClient
    if (typeof client.$transaction !== 'function') {
      return callback({ payment: this, affiliate: this.createAffiliateAdapter(), shipment: this.createShipmentAdapter() })
    }

    return client.$transaction((tx) =>
      callback({
        payment: new PrismaPaymentRepository(this.transactionContext(), tx),
        affiliate: new PrismaAffiliateRepository(this.transactionContext(), tx),
        shipment: new PrismaShipmentRepository(this.transactionContext(), tx),
      }),
    )
  }

  private transactionContext(): AppContext {
    return { logger: this.logger, config: { environment: 'transaction' } }
  }

  private createAffiliateAdapter(): IAffiliateCommissionRepository {
    return new PrismaAffiliateRepository(this.transactionContext(), this.prisma)
  }

  private createShipmentAdapter(): IShipmentCreationRepository {
    return new PrismaShipmentRepository(this.transactionContext(), this.prisma)
  }

  findPayment(paymentId: string): Promise<PaymentWithOrder | null> {
    this.logger.debug('PrismaPaymentRepository.findPayment', { paymentId })
    return this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: paymentInclude,
    })
  }

  findPaymentForOrder(orderId: string): Promise<PaymentWithOrder | null> {
    this.logger.debug('PrismaPaymentRepository.findPaymentForOrder', { orderId })
    return this.prisma.payment.findFirst({
      where: { orderId },
      include: paymentInclude,
      orderBy: { createdAt: 'desc' },
    })
  }

  async lockPayment(paymentId: string): Promise<void> {
    await this.prisma.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${paymentId}::uuid FOR UPDATE`
  }

  async lockWebhookEvent(providerRef: string): Promise<void> {
    await this.prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${providerRef}, 0))`
  }

  findOrder(orderId: string): Promise<Order | null> {
    this.logger.debug('PrismaPaymentRepository.findOrder', { orderId })
    return this.prisma.order.findUnique({
      where: { id: orderId },
    })
  }

  findWebhookEvent(providerRef: string): Promise<PaymentEvent | null> {
    this.logger.debug('PrismaPaymentRepository.findWebhookEvent', { providerRef })
    return this.prisma.paymentEvent.findUnique({
      where: { providerEventId: providerRef },
    })
  }

  createWebhookEvent(input: PaymentWebhookBody): Promise<PaymentEvent> {
    this.logger.info('PrismaPaymentRepository.createWebhookEvent', {
      providerRef: input.providerRef,
      paymentId: input.paymentId,
      eventType: input.eventType,
    })
    return this.prisma.paymentEvent.create({
      data: {
        paymentId: input.paymentId,
        providerEventId: input.providerRef,
        eventType: input.eventType,
        payload: input,
      },
    })
  }

  async applyPaymentStateTransition(input: PaymentStateTransitionInput): Promise<void> {
    if (input.eventType === 'payment.paid') {
      for (const reservation of input.reservations) {
        const reservationResult = await this.prisma.inventoryReservation.updateMany({
          where: {
            id: reservation.reservationId,
            status: 'ACTIVE',
          },
          data: {
            status: 'COMMITTED',
            orderId: input.orderId,
          },
        })
        if (reservationResult.count !== 1) {
          throw new Error(`Inventory reservation ${reservation.reservationId} is no longer active`)
        }

        const inventoryResult = await this.prisma.inventory.updateMany({
          where: {
            id: reservation.inventoryId,
            quantityOnHand: { gte: reservation.quantity },
            quantityReserved: { gte: reservation.quantity },
          },
          data: {
            quantityOnHand: { decrement: reservation.quantity },
            quantityReserved: { decrement: reservation.quantity },
            version: { increment: 1 },
          },
        })
        if (inventoryResult.count !== 1) {
          throw new Error(`Inventory ${reservation.inventoryId} cannot commit reserved stock`)
        }
      }

      await this.prisma.payment.update({
        where: { id: input.paymentId },
        data: { status: 'SUCCEEDED', paidAt: input.occurredAt },
      })
      await this.prisma.order.update({
        where: { id: input.orderId },
        data: { status: 'PAID', paymentStatus: 'SUCCEEDED' },
      })
      await this.prisma.shopOrder.updateMany({
        where: { orderId: input.orderId },
        data: { status: 'PAID', version: { increment: 1 } },
      })
      await this.prisma.checkout.update({
        where: { id: input.checkoutId },
        data: { status: 'COMPLETED' },
      })
      await this.prisma.couponRedemption.updateMany({
        where: { orderId: input.orderId, status: 'RESERVED' },
        data: { status: 'REDEEMED', redeemedAt: input.occurredAt },
      })
      const flashReservations = await this.prisma.flashSaleReservation.findMany({
        where: { checkoutId: input.checkoutId, status: 'ACTIVE' },
        select: { id: true, flashSaleItemId: true, quantity: true },
      })
      for (const reservation of flashReservations) {
        const result = await this.prisma.flashSaleReservation.updateMany({ where: { id: reservation.id, status: 'ACTIVE' }, data: { status: 'COMMITTED' } })
        if (result.count !== 1) throw new Error(`Flash sale reservation ${reservation.id} is no longer active`)
        await this.prisma.flashSaleItem.update({ where: { id: reservation.flashSaleItemId }, data: { soldCount: { increment: reservation.quantity } } })
      }
      await this.finalizeBuyerCoins(input.orderId, input.occurredAt)
      return
    }

    for (const reservation of input.reservations) {
      const updateResult = await this.prisma.inventoryReservation.updateMany({
        where: {
          id: reservation.reservationId,
          status: 'ACTIVE',
        },
        data: { status: 'RELEASED' },
      })

      if (updateResult.count !== 1) continue

      const inventoryResult = await this.prisma.inventory.updateMany({
        where: {
          id: reservation.inventoryId,
          quantityReserved: { gte: reservation.quantity },
        },
        data: {
          quantityReserved: {
            decrement: reservation.quantity,
          },
          version: { increment: 1 },
        },
      })
      if (inventoryResult.count !== 1) {
        throw new Error(`Inventory ${reservation.inventoryId} cannot release reserved stock`)
      }
    }

    const paymentStatus = input.eventType === 'payment.failed' ? 'FAILED' : 'CANCELED'
    await this.prisma.payment.update({
      where: { id: input.paymentId },
      data: { status: paymentStatus },
    })
    await this.prisma.order.update({
      where: { id: input.orderId },
      data: { status: 'CANCELED', paymentStatus },
    })
    await this.prisma.shopOrder.updateMany({
      where: { orderId: input.orderId },
      data: { status: 'CANCELED', version: { increment: 1 } },
    })
    await this.prisma.checkout.update({
      where: { id: input.checkoutId },
      data: { status: input.eventType === 'payment.expired' ? 'EXPIRED' : 'CANCELED' },
    })
    await this.prisma.couponRedemption.updateMany({
      where: { orderId: input.orderId, status: 'RESERVED' },
      data: { status: 'RELEASED' },
    })
    await this.prisma.flashSaleReservation.updateMany({ where: { checkoutId: input.checkoutId, status: 'ACTIVE' }, data: { status: 'RELEASED' } })
    await this.releaseBuyerCoins(input.orderId)
  }

  private async finalizeBuyerCoins(orderId: string, occurredAt: Date): Promise<void> {
    const spent = await this.prisma.buyerCoinLedger.findMany({ where: { orderId, type: 'SPENT', status: 'PENDING' }, select: { id: true, walletId: true, amount: true } })
    for (const entry of spent) {
      await this.prisma.buyerCoinLedger.update({ where: { id: entry.id }, data: { status: 'USED' } })
      await this.prisma.buyerCoinWallet.update({ where: { id: entry.walletId }, data: { pendingBalance: { decrement: entry.amount }, lifetimeSpent: { increment: entry.amount } } })
    }
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { userId: true, subtotal: true, discountTotal: true,
      items: { select: { saleSnapshot: { select: { originalCashbackEligibleNet: true, shopSale: { select: { policyVersion: true } } } } } } } })
    if (!order) return
    const versionTwo = order.items?.some((item) => item.saleSnapshot?.shopSale.policyVersion === 2)
    const eligibleCashback = versionTwo
      ? order.items.reduce((sum, item) => {
        if (!item.saleSnapshot || item.saleSnapshot.shopSale.policyVersion !== 2 || item.saleSnapshot.originalCashbackEligibleNet === null
          || item.saleSnapshot.originalCashbackEligibleNet < 0n) throw new Error('Original cashback net basis is missing')
        return sum + item.saleSnapshot.originalCashbackEligibleNet
      }, 0n)
      : moneyInteger(order.subtotal) - moneyInteger(order.discountTotal)
    const cashbackCoins = moneyNumber((eligibleCashback > 0n ? eligibleCashback : 0n) / 10_000n)
    if (!cashbackCoins) return
    const wallet = await this.prisma.buyerCoinWallet.upsert({ where: { userId: order.userId }, update: { balance: { increment: cashbackCoins }, lifetimeEarned: { increment: cashbackCoins } }, create: { userId: order.userId, balance: cashbackCoins, lifetimeEarned: cashbackCoins } })
    const debtPayment = moneyInteger(wallet.debtBalance) < BigInt(cashbackCoins) ? moneyNumber(wallet.debtBalance) : cashbackCoins
    const settledWallet = debtPayment > 0
      ? await this.prisma.buyerCoinWallet.update({ where: { id: wallet.id }, data: { balance: { decrement: debtPayment }, debtBalance: { decrement: debtPayment }, version: { increment: 1 } } })
      : wallet
    const availableCashback = cashbackCoins - debtPayment
    if (availableCashback > 0) {
      await this.prisma.buyerCoinLedger.create({ data: { walletId: wallet.id, userId: order.userId, orderId, type: 'EARNED', status: 'AVAILABLE', amount: availableCashback, balanceAfter: settledWallet.balance, reason: '1% order cashback', referenceType: 'ORDER_CASHBACK', referenceId: orderId, createdAt: occurredAt } })
    }
    if (debtPayment > 0) {
      await this.prisma.buyerCoinLedger.create({ data: { walletId: wallet.id, userId: order.userId, orderId, type: 'ADJUSTMENT', status: 'USED', amount: -debtPayment, balanceAfter: settledWallet.balance, reason: 'Cashback applied to outstanding coin debt', referenceType: 'COIN_DEBT_SETTLEMENT', referenceId: orderId, createdAt: occurredAt } })
    }
  }

  private async releaseBuyerCoins(orderId: string): Promise<void> {
    await releasePendingBuyerCoins(this.prisma, orderId)
  }
}
