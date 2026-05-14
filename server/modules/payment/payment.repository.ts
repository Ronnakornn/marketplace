import type {
  Checkout,
  InventoryReservation,
  Order,
  OrderItem,
  Payment,
  PaymentEvent,
  PrismaClient,
} from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type {
  IShipmentCreationRepository,
  ShipmentCreateInput,
  ShipmentOrderForCreation,
  ShipmentWithItems,
} from '#server/modules/shipment/shipment.repository.ts'
import type { PaymentWebhookBody } from './payment.types.ts'

type PaymentTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

export type PaymentWithOrder = Payment & {
  order: Order & {
    checkout: Checkout & {
      inventoryReservations: InventoryReservation[]
    }
    items: OrderItem[]
  }
}

export interface ReleaseReservationInput {
  reservationId: string
  variantId: string
  quantity: number
}

export interface IPaymentRepository extends IShipmentCreationRepository {
  transaction<T>(callback: (repo: IPaymentRepository) => Promise<T>): Promise<T>
  findPayment(paymentId: string): Promise<PaymentWithOrder | null>
  findOrder(orderId: string): Promise<Order | null>
  findWebhookEvent(providerRef: string): Promise<PaymentEvent | null>
  createWebhookEvent(input: PaymentWebhookBody): Promise<PaymentEvent>
  markPaymentSucceeded(paymentId: string, paidAt: Date): Promise<Payment>
  markPaymentFailed(paymentId: string): Promise<Payment>
  markPaymentExpired(paymentId: string): Promise<Payment>
  markOrderPaid(orderId: string): Promise<Order>
  markOrderCanceled(orderId: string): Promise<Order>
  releaseReservations(reservations: ReleaseReservationInput[]): Promise<void>
}

const paymentInclude = {
  order: {
    include: {
      items: true,
      checkout: {
        include: {
          inventoryReservations: true,
        },
      },
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

  transaction<T>(callback: (repo: IPaymentRepository) => Promise<T>): Promise<T> {
    const client = this.prisma as PrismaClient
    if (typeof client.$transaction !== 'function') {
      return callback(this)
    }

    return client.$transaction((tx) =>
      callback(new PrismaPaymentRepository({ logger: this.logger, config: { environment: 'transaction' } }, tx)),
    )
  }

  findPayment(paymentId: string): Promise<PaymentWithOrder | null> {
    this.logger.debug('PrismaPaymentRepository.findPayment', { paymentId })
    return this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: paymentInclude,
    })
  }

  findOrder(orderId: string): Promise<Order | null> {
    this.logger.debug('PrismaPaymentRepository.findOrder', { orderId })
    return this.prisma.order.findUnique({
      where: { id: orderId },
    })
  }

  findOrderForShipmentCreation(orderId: string): Promise<ShipmentOrderForCreation | null> {
    this.logger.debug('PrismaPaymentRepository.findOrderForShipmentCreation', { orderId })
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        shipments: {
          include: {
            items: true,
          },
        },
      },
    })
  }

  createShipment(input: ShipmentCreateInput): Promise<ShipmentWithItems> {
    this.logger.info('PrismaPaymentRepository.createShipment', {
      orderId: input.orderId,
      shopId: input.shopId,
    })
    return this.prisma.shipment.create({
      data: {
        orderId: input.orderId,
        shopId: input.shopId,
        status: 'PENDING_PACK',
        items: {
          create: input.items.map((item) => ({
            orderItemId: item.orderItemId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        items: true,
      },
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

  markPaymentSucceeded(paymentId: string, paidAt: Date): Promise<Payment> {
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'SUCCEEDED', paidAt },
    })
  }

  markPaymentFailed(paymentId: string): Promise<Payment> {
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'FAILED' },
    })
  }

  markPaymentExpired(paymentId: string): Promise<Payment> {
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'CANCELED' },
    })
  }

  markOrderPaid(orderId: string): Promise<Order> {
    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'PAID', paymentStatus: 'SUCCEEDED' },
    })
  }

  markOrderCanceled(orderId: string): Promise<Order> {
    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELED', paymentStatus: 'FAILED' },
    })
  }

  async releaseReservations(reservations: ReleaseReservationInput[]): Promise<void> {
    for (const reservation of reservations) {
      const updateResult = await this.prisma.inventoryReservation.updateMany({
        where: {
          id: reservation.reservationId,
          status: 'ACTIVE',
        },
        data: { status: 'RELEASED' },
      })

      if (updateResult.count !== 1) continue

      await this.prisma.inventory.update({
        where: { variantId: reservation.variantId },
        data: {
          quantityReserved: {
            decrement: reservation.quantity,
          },
        },
      })
    }
  }
}
