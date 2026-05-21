import type {
  Cart,
  Checkout,
  InventoryReservation,
  Order,
  Payment,
  Prisma,
  PrismaClient,
} from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { CreateNotificationInput } from '#server/modules/notification/notification.repository.ts'

type JobTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

export type ExpiredPaymentRecord = Payment & {
  order: Order & {
    checkout: Checkout & {
      inventoryReservations: InventoryReservation[]
    }
  }
}

export interface ReleaseReservationInput {
  reservationId: string
  inventoryId: string
  quantity: number
}

export interface IJobRepository {
  transaction<T>(callback: (repo: IJobRepository) => Promise<T>): Promise<T>
  createNotification(input: CreateNotificationInput): Promise<void>
  findExpiredPendingPayments(cutoff: Date): Promise<ExpiredPaymentRecord[]>
  findPaymentForExpiry(paymentId: string): Promise<ExpiredPaymentRecord | null>
  markPaymentExpired(paymentId: string): Promise<void>
  markOrderCanceled(orderId: string): Promise<void>
  markCheckoutExpired(checkoutId: string): Promise<void>
  releaseReservations(reservations: ReleaseReservationInput[]): Promise<void>
  cleanupAbandonedCarts(cutoff: Date): Promise<number>
}

const expiredPaymentInclude = {
  order: {
    include: {
      checkout: {
        include: {
          inventoryReservations: true,
        },
      },
    },
  },
} as const

export class PrismaJobRepository implements IJobRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient | JobTx,
  ) {
    this.logger = appContext.logger
  }

  transaction<T>(callback: (repo: IJobRepository) => Promise<T>): Promise<T> {
    const client = this.prisma as PrismaClient
    if (typeof client.$transaction !== 'function') {
      return callback(this)
    }

    return client.$transaction((tx) =>
      callback(new PrismaJobRepository({ logger: this.logger, config: { environment: 'transaction' } }, tx)),
    )
  }

  async createNotification(input: CreateNotificationInput): Promise<void> {
    this.logger.info('PrismaJobRepository.createNotification', { userId: input.userId, type: input.type })
    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data as Prisma.InputJsonValue | undefined,
      },
    })
  }

  findExpiredPendingPayments(cutoff: Date): Promise<ExpiredPaymentRecord[]> {
    this.logger.debug('PrismaJobRepository.findExpiredPendingPayments', { cutoff })
    return this.prisma.payment.findMany({
      where: {
        status: { in: ['PENDING', 'REQUIRES_ACTION'] },
        createdAt: { lt: cutoff },
      },
      include: expiredPaymentInclude,
      orderBy: { createdAt: 'asc' },
      take: 100,
    })
  }

  findPaymentForExpiry(paymentId: string): Promise<ExpiredPaymentRecord | null> {
    this.logger.debug('PrismaJobRepository.findPaymentForExpiry', { paymentId })
    return this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: expiredPaymentInclude,
    })
  }

  async markPaymentExpired(paymentId: string): Promise<void> {
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'CANCELED' },
    })
  }

  async markOrderCanceled(orderId: string): Promise<void> {
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELED',
        paymentStatus: 'CANCELED',
      },
    })
  }

  async markCheckoutExpired(checkoutId: string): Promise<void> {
    await this.prisma.checkout.update({
      where: { id: checkoutId },
      data: { status: 'EXPIRED' },
    })
  }

  async releaseReservations(reservations: ReleaseReservationInput[]): Promise<void> {
    for (const reservation of reservations) {
      const result = await this.prisma.inventoryReservation.updateMany({
        where: {
          id: reservation.reservationId,
          status: 'ACTIVE',
        },
        data: { status: 'RELEASED' },
      })

      if (result.count !== 1) continue

      await this.prisma.inventory.update({
        where: { id: reservation.inventoryId },
        data: {
          quantityReserved: {
            decrement: reservation.quantity,
          },
        },
      })
    }
  }

  async cleanupAbandonedCarts(cutoff: Date): Promise<number> {
    this.logger.info('PrismaJobRepository.cleanupAbandonedCarts', { cutoff })
    const result = await this.prisma.cart.updateMany({
      where: {
        status: 'ACTIVE',
        updatedAt: { lt: cutoff },
        checkouts: {
          none: {},
        },
      },
      data: { status: 'ABANDONED' },
    })
    return result.count
  }
}

export type CartRecord = Cart
