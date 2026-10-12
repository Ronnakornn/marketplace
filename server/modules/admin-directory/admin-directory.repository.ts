import type { PrismaClient } from '#generated/client/client.ts'
import type { AdminActor } from '#server/modules/admin-access/admin-access.contract.ts'
import { auditAccess } from '#server/modules/admin-access/admin-access.repository.ts'
import { AdminAccessError } from '#server/modules/admin-access/admin-access.errors.ts'

export class AdminDirectoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  user(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        role: true,
        status: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }
  async buyerHistory(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit
    const [
      addresses,
      addressCount,
      orders,
      orderCount,
      wallet,
      ledger,
      ledgerCount,
    ] = await this.prisma.$transaction([
      this.prisma.address.findMany({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.address.count({ where: { userId } }),
      this.prisma.order.findMany({
        where: { userId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          grandTotal: true,
          currency: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where: { userId } }),
      this.prisma.buyerCoinWallet.findUnique({
        where: { userId },
        select: {
          balance: true,
          pendingBalance: true,
          debtBalance: true,
          lifetimeEarned: true,
          lifetimeSpent: true,
        },
      }),
      this.prisma.buyerCoinLedger.findMany({
        where: { userId },
        select: {
          id: true,
          type: true,
          status: true,
          amount: true,
          balanceAfter: true,
          reason: true,
          orderId: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.buyerCoinLedger.count({ where: { userId } }),
    ])
    return {
      addresses: { items: addresses, total: addressCount },
      orders: { items: orders, total: orderCount },
      coins: { wallet, items: ledger, total: ledgerCount },
      page,
      limit,
    }
  }
  shop(shopId: string) {
    return this.prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        ownerId: true,
        name: true,
        slug: true,
        status: true,
        contactEmail: true,
        contactPhone: true,
        ratingAverage: true,
        ratingCount: true,
        createdAt: true,
        suspendedReason: true,
        rejectedReason: true,
        owner: { select: { id: true, name: true, email: true, status: true } },
        sellerProfile: {
          select: {
            id: true,
            businessType: true,
            verificationStatus: true,
            verifiedAt: true,
          },
        },
      },
    })
  }
  async shopHistory(
    shopId: string,
    ownerId: string,
    page: number,
    limit: number,
  ) {
    const skip = (page - 1) * limit
    const [
      orders,
      orderCount,
      canceledCount,
      reviews,
      violations,
      restrictions,
      riskCases,
      notices,
      noticeCount,
      late,
    ] = await this.prisma.$transaction([
      this.prisma.shopOrder.findMany({
        where: { shopId },
        select: {
          id: true,
          orderId: true,
          status: true,
          fulfillmentStatus: true,
          grandTotal: true,
          currency: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.shopOrder.count({ where: { shopId } }),
      this.prisma.shopOrder.count({ where: { shopId, status: 'CANCELED' } }),
      this.prisma.shopRating.aggregate({
        where: { shopId, status: 'PUBLISHED' },
        _avg: { rating: true },
        _count: { id: true },
      }),
      this.prisma.sellerViolation.findMany({
        where: { shopId },
        select: {
          id: true,
          type: true,
          severity: true,
          status: true,
          reason: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip,
      }),
      this.prisma.shopRestriction.findMany({
        where: {
          shopId,
          revokedAt: null,
          startsAt: { lte: new Date() },
          OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
        },
        select: {
          id: true,
          type: true,
          reason: true,
          startsAt: true,
          endsAt: true,
        },
        take: limit,
        skip,
        orderBy: { id: 'asc' },
      }),
      this.prisma.fraudCase.count({
        where: { userId: ownerId, status: { in: ['OPEN', 'REVIEWED'] } },
      }),
      this.prisma.supportTicket.findMany({
        where: { shopId, category: 'ADMIN_NOTICE' },
        select: { id: true, subject: true, status: true, createdAt: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.supportTicket.count({
        where: { shopId, category: 'ADMIN_NOTICE' },
      }),
      this.prisma.$queryRaw<
        Array<{ delivered: bigint; overSevenDays: bigint }>
      >`SELECT COUNT(*) FILTER (WHERE "deliveredAt" IS NOT NULL)::bigint AS delivered, COUNT(*) FILTER (WHERE "deliveredAt" > "shippedAt" + interval '7 days')::bigint AS "overSevenDays" FROM "Shipment" WHERE "shopId" = ${shopId}::uuid AND "status" = 'DELIVERED'`,
    ])
    return {
      orders: { items: orders, total: orderCount },
      quality: {
        canceledOrders: canceledCount,
        totalOrders: orderCount,
        approvedReviewCount: reviews._count.id,
        averageRating: reviews._avg.rating,
        deliveredShipments: late[0]?.delivered ?? 0n,
        transitOverSevenDays: late[0]?.overSevenDays ?? 0n,
        transitThresholdDays: 7,
        riskCases,
      },
      violations,
      restrictions,
      notices: { items: notices, total: noticeCount },
      page,
      limit,
    }
  }
  notice(actor: AdminActor, shopId: string, subject: string, body: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Shop" WHERE id = ${shopId}::uuid FOR UPDATE`
      const shop = await tx.shop.findUnique({
        where: { id: shopId },
        select: { id: true, ownerId: true },
      })
      if (!shop)
        throw new AdminAccessError('Shop not found', 404, 'SHOP_NOT_FOUND')
      const ticket = await tx.supportTicket.create({
        data: {
          userId: shop.ownerId,
          shopId,
          orderId: null,
          category: 'ADMIN_NOTICE',
          subject,
          messages: {
            create: {
              senderId: actor.id,
              senderType: 'ADMIN',
              body,
              isInternal: false,
            },
          },
        },
        select: {
          id: true,
          subject: true,
          shopId: true,
          userId: true,
          createdAt: true,
        },
      })
      await auditAccess(
        tx,
        actor,
        'ShopNotice',
        ticket.id,
        {},
        { shopId, subject, ticketId: ticket.id },
      )
      return ticket
    })
  }
}
