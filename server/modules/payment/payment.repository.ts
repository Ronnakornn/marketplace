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

export type PaymentTransactionRepository = IPaymentRepository & IShipmentCreationRepository & IAffiliateRepository

export interface IPaymentRepository {
  transaction<T>(callback: (repo: PaymentTransactionRepository) => Promise<T>): Promise<T>
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

export class PrismaPaymentRepository implements PaymentTransactionRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient | PaymentTx,
  ) {
    this.logger = appContext.logger
  }

  transaction<T>(callback: (repo: PaymentTransactionRepository) => Promise<T>): Promise<T> {
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
    await this.prisma.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${providerRef}, 0))`
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
    return this.prisma.affiliateCommission.create({
      data: {
        affiliateId: input.affiliateId,
        linkId: input.linkId,
        clickId: input.clickId,
        orderId: input.orderId,
        eligiblesubtotal: input.eligiblesubtotal,
        commissionBps: input.commissionBps,
        commission: input.commissionCents,
        currency: input.currency,
      },
    })
  }

  async getStats(userId: string) {
    const affiliate = await this.prisma.affiliate.findUnique({ where: { userId }, select: { id: true } })
    if (!affiliate) return { clicks: 0, conversions: 0, commissionCents: 0 }
    const [clicks, conversions, commission] = await Promise.all([
      this.prisma.affiliateClick.count({ where: { affiliateId: affiliate.id } }),
      this.prisma.affiliateCommission.count({ where: { affiliateId: affiliate.id, status: { not: 'VOID' } } }),
      this.prisma.affiliateCommission.aggregate({
        where: { affiliateId: affiliate.id, status: { not: 'VOID' } },
        _sum: { commission: true },
      }),
    ])
    return { clicks, conversions, commissionCents: Number(commission._sum.commission ?? 0) }
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
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { userId: true, subtotal: true, discountTotal: true } })
    if (!order) return
    const cashbackCoins = Math.floor(Math.max(0, Number(order.subtotal) - Number(order.discountTotal)) / 10_000)
    if (!cashbackCoins) return
    const wallet = await this.prisma.buyerCoinWallet.upsert({ where: { userId: order.userId }, update: { balance: { increment: cashbackCoins }, lifetimeEarned: { increment: cashbackCoins } }, create: { userId: order.userId, balance: cashbackCoins, lifetimeEarned: cashbackCoins } })
    const debtPayment = Math.min(cashbackCoins, Number(wallet.debtBalance))
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
