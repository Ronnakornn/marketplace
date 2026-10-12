import type { Prisma, PrismaClient } from '#generated/client/client.ts'

export class AdminConfigRepository {
  constructor(private readonly prisma: PrismaClient) {}
  toggles() {
    return this.prisma.featureToggle.findMany({
      orderBy: [{ key: 'asc' }, { scope: 'asc' }, { id: 'asc' }],
      take: 1001,
    })
  }
  settings() {
    return this.prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'catalog.approvalRequired',
            'payment.channels',
            'notifications.delivery',
            'platform.defaults',
          ],
        },
      },
    })
  }
  template(
    key: string,
    channel: 'EMAIL' | 'PUSH' | 'IN_APP' | 'SMS' | 'LINE',
    locale: string,
  ) {
    return this.prisma.notificationTemplate.findUnique({
      where: { key_channel_locale: { key, channel, locale } },
    })
  }
  async resourceShop(input: {
    productId?: string
    threadId?: string
    reviewId?: string
    orderItemId?: string
    shopOrderId?: string
    shopRatingId?: string
    shopId?: string
  }) {
    if (input.threadId)
      return (
        await this.prisma.chatThread.findUnique({
          where: { id: input.threadId },
          select: { shopId: true },
        })
      )?.shopId
    if (input.reviewId)
      return (
        await this.prisma.review.findUnique({
          where: { id: input.reviewId },
          select: { product: { select: { shopId: true } } },
        })
      )?.product.shopId
    if (input.shopRatingId)
      return (
        await this.prisma.shopRating.findUnique({
          where: { id: input.shopRatingId },
          select: { shopId: true },
        })
      )?.shopId
    if (input.shopOrderId)
      return (
        await this.prisma.shopOrder.findUnique({
          where: { id: input.shopOrderId },
          select: { shopId: true },
        })
      )?.shopId
    if (input.orderItemId)
      return (
        await this.prisma.orderItem.findUnique({
          where: { id: input.orderItemId },
          select: { shopId: true },
        })
      )?.shopId
    if (input.productId)
      return (
        await this.prisma.product.findUnique({
          where: { id: input.productId },
          select: { shopId: true },
        })
      )?.shopId
    if (input.shopId)
      return (
        await this.prisma.shop.findUnique({
          where: { id: input.shopId },
          select: { id: true },
        })
      )?.id
    return undefined
  }
  templates(page: number, limit: number) {
    return this.prisma
      .$transaction([
        this.prisma.notificationTemplate.findMany({
          orderBy: [{ key: 'asc' }, { locale: 'asc' }, { channel: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.notificationTemplate.count(),
      ])
      .then(([items, total]) => ({ items, total, page, limit }))
  }
  async transaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(719362804)`
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(719362805)`
      return operation(tx)
    })
  }
}
