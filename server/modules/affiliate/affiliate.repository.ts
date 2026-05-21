import type {
  Affiliate,
  AffiliateClick,
  AffiliateCommission,
  AffiliateLink,
  Order,
  OrderItem,
  PrismaClient,
  Product,
  Shop,
} from '#generated/client/client.ts'
import type { AffiliateLinkStatus, AffiliateStatus, AffiliateTargetType } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export type AffiliateRecord = Affiliate & {
  user: { id: string; email: string; name: string }
  links: AffiliateLink[]
}

export type AffiliateLinkRecord = AffiliateLink & {
  affiliate: Affiliate
}

export type AffiliateOrderRecord = Order & {
  items: OrderItem[]
}

export interface CreateAffiliateLinkInput {
  userId: string
  code: string
  targetType: AffiliateTargetType
  targetId: string
}

export interface CreateAffiliateClickInput {
  affiliateId: string
  linkId: string
  buyerUserId?: string | null
  sessionId?: string | null
  refParam?: string | null
  ipHash?: string | null
  userAgentHash?: string | null
  expiresAt: Date
}

export interface CreateAffiliateCommissionInput {
  affiliateId: string
  linkId: string
  clickId?: string | null
  orderId: string
  eligiblesubtotal: number
  commissionBps: number
  commissionCents: number
  currency: string
}

export interface AffiliateTargetOption {
  id: string
  label: string
  description: string | null
  type: AffiliateTargetType
}

export interface IAffiliateRepository {
  transaction<T>(callback: (repo: IAffiliateRepository) => Promise<T>): Promise<T>
  findOrCreateAffiliate(userId: string): Promise<Affiliate>
  findAffiliateByUserId(userId: string): Promise<Affiliate | null>
  findAffiliateById(affiliateId: string): Promise<AffiliateRecord | null>
  listAffiliates(): Promise<AffiliateRecord[]>
  updateAffiliateStatus(affiliateId: string, status: AffiliateStatus): Promise<Affiliate>
  findLinkByCode(code: string): Promise<AffiliateLinkRecord | null>
  findLinkById(linkId: string): Promise<AffiliateLinkRecord | null>
  listLinksByUserId(userId: string): Promise<AffiliateLink[]>
  createLink(input: CreateAffiliateLinkInput): Promise<AffiliateLink>
  updateLinkStatus(linkId: string, status: AffiliateLinkStatus): Promise<AffiliateLink>
  productExists(productId: string): Promise<Pick<Product, 'id'> | null>
  shopExists(shopId: string): Promise<Pick<Shop, 'id'> | null>
  campaignExists(campaignId: string): Promise<{ id: string } | null>
  searchTargets(input: { targetType: AffiliateTargetType; q?: string; limit: number }): Promise<AffiliateTargetOption[]>
  createClick(input: CreateAffiliateClickInput): Promise<AffiliateClick>
  findLatestAttributableClick(input: { buyerUserId?: string; sessionId?: string; now: Date }): Promise<AffiliateClick | null>
  findOrderForCommission(orderId: string): Promise<AffiliateOrderRecord | null>
  findCommissionByOrderId(orderId: string): Promise<AffiliateCommission | null>
  createCommission(input: CreateAffiliateCommissionInput): Promise<AffiliateCommission>
  getStats(userId: string): Promise<{ clicks: number; conversions: number; commissionCents: number }>
}

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

const affiliateInclude = {
  user: { select: { id: true, email: true, name: true } },
  links: { orderBy: { createdAt: 'desc' } },
} as const

export class PrismaAffiliateRepository implements IAffiliateRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient | TxClient,
  ) {
    this.logger = appContext.logger
  }

  transaction<T>(callback: (repo: IAffiliateRepository) => Promise<T>): Promise<T> {
    const client = this.prisma as PrismaClient
    if (typeof client.$transaction !== 'function') return callback(this)

    return client.$transaction((tx) =>
      callback(new PrismaAffiliateRepository({ logger: this.logger, config: { environment: 'transaction' } }, tx)),
    )
  }

  findOrCreateAffiliate(userId: string): Promise<Affiliate> {
    this.logger.info('PrismaAffiliateRepository.findOrCreateAffiliate', { userId })
    return this.prisma.affiliate.upsert({
      where: { userId },
      update: {},
      create: { userId },
    })
  }

  findAffiliateByUserId(userId: string): Promise<Affiliate | null> {
    return this.prisma.affiliate.findUnique({ where: { userId } })
  }

  findAffiliateById(affiliateId: string): Promise<AffiliateRecord | null> {
    return this.prisma.affiliate.findUnique({ where: { id: affiliateId }, include: affiliateInclude })
  }

  listAffiliates(): Promise<AffiliateRecord[]> {
    return this.prisma.affiliate.findMany({
      include: affiliateInclude,
      orderBy: { createdAt: 'desc' },
    })
  }

  updateAffiliateStatus(affiliateId: string, status: AffiliateStatus): Promise<Affiliate> {
    return this.prisma.affiliate.update({ where: { id: affiliateId }, data: { status } })
  }

  findLinkByCode(code: string): Promise<AffiliateLinkRecord | null> {
    return this.prisma.affiliateLink.findUnique({ where: { code }, include: { affiliate: true } })
  }

  findLinkById(linkId: string): Promise<AffiliateLinkRecord | null> {
    return this.prisma.affiliateLink.findUnique({ where: { id: linkId }, include: { affiliate: true } })
  }

  async listLinksByUserId(userId: string): Promise<AffiliateLink[]> {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { userId },
      include: { links: { orderBy: { createdAt: 'desc' } } },
    })
    return affiliate?.links ?? []
  }

  createLink(input: CreateAffiliateLinkInput): Promise<AffiliateLink> {
    return this.prisma.affiliateLink.create({
      data: {
        affiliateId: input.userId,
        code: input.code,
        targetType: input.targetType,
        targetId: input.targetId,
      },
    })
  }

  updateLinkStatus(linkId: string, status: AffiliateLinkStatus): Promise<AffiliateLink> {
    return this.prisma.affiliateLink.update({ where: { id: linkId }, data: { status } })
  }

  productExists(productId: string): Promise<Pick<Product, 'id'> | null> {
    return this.prisma.product.findFirst({ where: { id: productId, status: 'ACTIVE' }, select: { id: true } })
  }

  shopExists(shopId: string): Promise<Pick<Shop, 'id'> | null> {
    return this.prisma.shop.findFirst({ where: { id: shopId, status: 'ACTIVE' }, select: { id: true } })
  }

  campaignExists(campaignId: string): Promise<{ id: string } | null> {
    return this.prisma.coupon.findFirst({
      where: { OR: [{ id: campaignId }, { code: campaignId }], isActive: true },
      select: { id: true },
    })
  }

  async searchTargets(input: { targetType: AffiliateTargetType; q?: string; limit: number }): Promise<AffiliateTargetOption[]> {
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
      return rows.map((row) => ({
        id: row.id,
        label: row.title,
        description: `${row.shop.name} / ${row.slug}`,
        type: 'product',
      }))
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
      return rows.map((row) => ({
        id: row.id,
        label: row.name,
        description: row.slug,
        type: 'shop',
      }))
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
    return rows.map((row) => ({
      id: row.id,
      label: row.titleEn ?? row.titleTh ?? row.code,
      description: row.code,
      type: 'campaign',
    }))
  }

  createClick(input: CreateAffiliateClickInput): Promise<AffiliateClick> {
    return this.prisma.affiliateClick.create({ data: input })
  }

  findLatestAttributableClick(input: { buyerUserId?: string; sessionId?: string; now: Date }): Promise<AffiliateClick | null> {
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

  findOrderForCommission(orderId: string): Promise<AffiliateOrderRecord | null> {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    })
  }

  findCommissionByOrderId(orderId: string): Promise<AffiliateCommission | null> {
    return this.prisma.affiliateCommission.findUnique({ where: { orderId } })
  }

  createCommission(input: CreateAffiliateCommissionInput): Promise<AffiliateCommission> {
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

  async getStats(userId: string): Promise<{ clicks: number; conversions: number; commissionCents: number }> {
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

    return {
      clicks,
      conversions,
      commissionCents: Number(commission._sum.commission ?? 0),
    }
  }
}
