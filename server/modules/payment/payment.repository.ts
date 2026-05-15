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
  CreateAffiliateClickInput,
  CreateAffiliateCommissionInput,
  CreateAffiliateLinkInput,
  IAffiliateRepository,
} from '#server/modules/affiliate'
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

export interface IPaymentRepository extends IShipmentCreationRepository, IAffiliateRepository {
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

  findOrCreateAffiliate(userId: string) {
    return this.prisma.affiliate.upsert({ where: { userId }, update: {}, create: { userId } })
  }

  findAffiliateByUserId(userId: string) {
    return this.prisma.affiliate.findUnique({ where: { userId } })
  }

  findAffiliateById(affiliateId: string) {
    return this.prisma.affiliate.findUnique({
      where: { id: affiliateId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        links: { orderBy: { createdAt: 'desc' } },
      },
    })
  }

  listAffiliates() {
    return this.prisma.affiliate.findMany({
      include: {
        user: { select: { id: true, email: true, name: true } },
        links: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  updateAffiliateStatus(affiliateId: string, status: 'ACTIVE' | 'DISABLED') {
    return this.prisma.affiliate.update({ where: { id: affiliateId }, data: { status } })
  }

  findLinkByCode(code: string) {
    return this.prisma.affiliateLink.findUnique({ where: { code }, include: { affiliate: true } })
  }

  findLinkById(linkId: string) {
    return this.prisma.affiliateLink.findUnique({ where: { id: linkId }, include: { affiliate: true } })
  }

  async listLinksByUserId(userId: string) {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { userId },
      include: { links: { orderBy: { createdAt: 'desc' } } },
    })
    return affiliate?.links ?? []
  }

  createLink(input: CreateAffiliateLinkInput) {
    return this.prisma.affiliateLink.create({
      data: {
        affiliateId: input.userId,
        code: input.code,
        targetType: input.targetType,
        targetId: input.targetId,
      },
    })
  }

  updateLinkStatus(linkId: string, status: 'ACTIVE' | 'DISABLED') {
    return this.prisma.affiliateLink.update({ where: { id: linkId }, data: { status } })
  }

  productExists(productId: string) {
    return this.prisma.product.findFirst({ where: { id: productId, status: 'ACTIVE' }, select: { id: true } })
  }

  shopExists(shopId: string) {
    return this.prisma.shop.findFirst({ where: { id: shopId, status: 'ACTIVE' }, select: { id: true } })
  }

  campaignExists(campaignId: string) {
    return this.prisma.coupon.findFirst({
      where: { OR: [{ id: campaignId }, { code: campaignId }], isActive: true },
      select: { id: true },
    })
  }

  async searchTargets(input: { targetType: 'product' | 'shop' | 'campaign'; q?: string; limit: number }) {
    const q = input.q?.trim()
    if (input.targetType === 'product') {
      const rows = await this.prisma.product.findMany({
        where: {
          status: 'ACTIVE',
          ...(q
            ? {
                OR: [
                  { title: { contains: q, mode: 'insensitive' } },
                  { slug: { contains: q, mode: 'insensitive' } },
                  { shop: { name: { contains: q, mode: 'insensitive' } } },
                ],
              }
            : {}),
        },
        select: { id: true, title: true, slug: true, shop: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      })
      return rows.map((row) => ({ id: row.id, label: row.title, description: `${row.shop.name} / ${row.slug}`, type: 'product' as const }))
    }
    if (input.targetType === 'shop') {
      const rows = await this.prisma.shop.findMany({
        where: {
          status: 'ACTIVE',
          ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }] } : {}),
        },
        select: { id: true, name: true, slug: true },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      })
      return rows.map((row) => ({ id: row.id, label: row.name, description: row.slug, type: 'shop' as const }))
    }
    const rows = await this.prisma.coupon.findMany({
      where: {
        isActive: true,
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: 'insensitive' } },
                { titleEn: { contains: q, mode: 'insensitive' } },
                { titleTh: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { id: true, code: true, titleEn: true, titleTh: true },
      orderBy: { createdAt: 'desc' },
      take: input.limit,
    })
    return rows.map((row) => ({ id: row.id, label: row.titleEn ?? row.titleTh ?? row.code, description: row.code, type: 'campaign' as const }))
  }

  createClick(input: CreateAffiliateClickInput) {
    return this.prisma.affiliateClick.create({ data: input })
  }

  findLatestAttributableClick(input: { buyerUserId?: string; sessionId?: string; now: Date }) {
    if (!input.buyerUserId && !input.sessionId) return Promise.resolve(null)

    return this.prisma.affiliateClick.findFirst({
      where: {
        expiresAt: { gt: input.now },
        OR: [
          ...(input.buyerUserId ? [{ buyerUserId: input.buyerUserId }] : []),
          ...(input.sessionId ? [{ sessionId: input.sessionId }] : []),
        ],
        affiliate: { status: 'ACTIVE' },
        link: { status: 'ACTIVE' },
      },
      orderBy: { clickedAt: 'desc' },
    })
  }

  findOrderForCommission(orderId: string) {
    return this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } })
  }

  findCommissionByOrderId(orderId: string) {
    return this.prisma.affiliateCommission.findUnique({ where: { orderId } })
  }

  createCommission(input: CreateAffiliateCommissionInput) {
    return this.prisma.affiliateCommission.create({ data: input })
  }

  async getStats(userId: string) {
    const affiliate = await this.prisma.affiliate.findUnique({ where: { userId }, select: { id: true } })
    if (!affiliate) return { clicks: 0, conversions: 0, commissionCents: 0 }
    const [clicks, conversions, commission] = await Promise.all([
      this.prisma.affiliateClick.count({ where: { affiliateId: affiliate.id } }),
      this.prisma.affiliateCommission.count({ where: { affiliateId: affiliate.id, status: { not: 'VOID' } } }),
      this.prisma.affiliateCommission.aggregate({
        where: { affiliateId: affiliate.id, status: { not: 'VOID' } },
        _sum: { commissionCents: true },
      }),
    ])
    return { clicks, conversions, commissionCents: commission._sum.commissionCents ?? 0 }
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
