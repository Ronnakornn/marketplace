import type { Prisma, PrismaClient } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { AdminActor } from '#server/modules/admin-access/admin-access.contract.ts'
import type { ListInput } from './operations.schemas.ts'

function pagination(input: ListInput) {
  const page = input.page ?? 1
  const limit = input.limit ?? 20
  return { skip: (page - 1) * limit, take: limit }
}
export class PrismaAdminOperationsRepository {
  constructor(
    private appContext: AppContext,
    private db: PrismaClient | Prisma.TransactionClient,
  ) {}
  transaction<T>(
    callback: (repo: PrismaAdminOperationsRepository) => Promise<T>,
  ): Promise<T> {
    if ('$transaction' in this.db)
      return this.db.$transaction(
        (tx) =>
          callback(new PrismaAdminOperationsRepository(this.appContext, tx)),
        { timeout: 30_000, maxWait: 10_000 },
      )
    return callback(this)
  }
  async lockAdminGrants() {
    await this.db
      .$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(719362804)`
  }
  async audit(
    actor: AdminActor,
    entityType: string,
    entityId: string,
    reason: string,
    after: Prisma.InputJsonValue,
    before?: Prisma.InputJsonValue,
  ) {
    await this.db.auditLog.create({
      data: {
        actorUserId: actor.id,
        actorRole: actor.role,
        action: 'ADMIN_CONFIG_CHANGED',
        entityType,
        entityId,
        before,
        after,
        metadata: { reason },
      },
    })
    this.appContext.logger.info('Admin operation committed', {
      actorId: actor.id,
      entityType,
      entityId,
    })
  }
  shop(id: string) {
    return this.db.shop.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        name: true,
        status: true,
        settings: true,
      },
    })
  }
  policy(shopId: string) {
    return this.db.shopOperationPolicy.findUnique({ where: { shopId } })
  }
  async policies(input: ListInput) {
    const where: Prisma.ShopWhereInput = {
      deletedAt: null,
      ...(input.shopId ? { id: input.shopId } : {}),
      ...(input.q ? { name: { contains: input.q, mode: 'insensitive' } } : {}),
    }
    const [items, total] = await Promise.all([
      this.db.shop.findMany({
        where,
        select: { id: true, name: true, status: true, operationPolicy: true },
        ...pagination(input),
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.db.shop.count({ where }),
    ])
    return { items, total }
  }
  createPolicy(data: Prisma.ShopOperationPolicyUncheckedCreateInput) {
    return this.db.shopOperationPolicy.create({ data })
  }
  updatePolicy(
    shopId: string,
    version: number,
    data: Prisma.ShopOperationPolicyUncheckedUpdateManyInput,
  ) {
    return this.db.shopOperationPolicy.updateMany({
      where: { shopId, version },
      data,
    })
  }
  provider(id: string) {
    return this.db.shippingProvider.findUnique({ where: { id } })
  }
  async providers(input: ListInput) {
    const where: Prisma.ShippingProviderWhereInput = {
      ...(input.shopId ? { shopId: input.shopId } : {}),
      ...(input.q ? { name: { contains: input.q, mode: 'insensitive' } } : {}),
    }
    const [items, total] = await Promise.all([
      this.db.shippingProvider.findMany({
        where,
        select: {
          id: true,
          shopId: true,
          code: true,
          name: true,
          displayNameTh: true,
          displayNameEn: true,
          isActive: true,
          supportsCod: true,
          supportsPickup: true,
          createdAt: true,
          updatedAt: true,
        },
        ...pagination(input),
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.db.shippingProvider.count({ where }),
    ])
    return { items, total }
  }
  createProvider(data: Prisma.ShippingProviderUncheckedCreateInput) {
    return this.db.shippingProvider.create({ data, select: { id: true } })
  }
  updateProvider(
    id: string,
    updatedAt: Date,
    data: Prisma.ShippingProviderUncheckedUpdateManyInput,
  ) {
    return this.db.shippingProvider.updateMany({
      where: { id, updatedAt },
      data,
    })
  }
  deleteProvider(id: string, updatedAt: Date) {
    return this.db.shippingProvider.deleteMany({
      where: {
        id,
        updatedAt,
        shipments: { none: {} },
        rateRules: { none: {} },
      },
    })
  }
  rate(id: string) {
    return this.db.shippingRateRule.findUnique({ where: { id } })
  }
  async rates(input: ListInput) {
    const where: Prisma.ShippingRateRuleWhereInput = {
      ...(input.shopId ? { shopId: input.shopId } : {}),
      ...(input.q ? { name: { contains: input.q, mode: 'insensitive' } } : {}),
    }
    const [items, total] = await Promise.all([
      this.db.shippingRateRule.findMany({
        where,
        include: {
          provider: {
            select: { id: true, name: true, shopId: true, isActive: true },
          },
        },
        ...pagination(input),
        orderBy: [{ priority: 'desc' }, { id: 'asc' }],
      }),
      this.db.shippingRateRule.count({ where }),
    ])
    return { items, total }
  }
  quoteRules(shopId: string) {
    return this.db.shippingRateRule.findMany({
      where: {
        isActive: true,
        OR: [{ shopId }, { shopId: null }],
        provider: { isActive: true, OR: [{ shopId }, { shopId: null }] },
      },
      include: {
        provider: {
          select: { id: true, name: true, shopId: true, isActive: true },
        },
      },
      take: 1000,
      orderBy: [{ priority: 'desc' }, { id: 'asc' }],
    })
  }
  createRate(data: Prisma.ShippingRateRuleUncheckedCreateInput) {
    return this.db.shippingRateRule.create({ data })
  }
  updateRate(
    id: string,
    version: number,
    data: Prisma.ShippingRateRuleUncheckedUpdateManyInput,
  ) {
    return this.db.shippingRateRule.updateMany({
      where: { id, version },
      data,
    })
  }
  deleteRate(id: string, version: number) {
    return this.db.shippingRateRule.deleteMany({ where: { id, version } })
  }
  bannerCollision(
    placement: Prisma.MarketingBannerWhereInput['placement'],
    sortOrder: number,
    startsAt: Date | null,
    endsAt: Date | null,
    excludeId: string | null,
  ) {
    return this.db.marketingBanner.findFirst({
      where: {
        placement,
        sortOrder,
        status: { in: ['PUBLISHED', 'SCHEDULED'] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        AND: [
          {
            OR: [
              { endsAt: null },
              { endsAt: { gt: startsAt ?? new Date('0001-01-01T00:00:00Z') } },
            ],
          },
          ...(endsAt
            ? [{ OR: [{ startsAt: null }, { startsAt: { lt: endsAt } }] }]
            : []),
        ],
      },
      select: { id: true },
    })
  }
  banner(id: string) {
    return this.db.marketingBanner.findUnique({ where: { id } })
  }
  async banners(input: ListInput) {
    const where: Prisma.MarketingBannerWhereInput = input.q
      ? { title: { contains: input.q, mode: 'insensitive' } }
      : {}
    const [items, total] = await Promise.all([
      this.db.marketingBanner.findMany({
        where,
        ...pagination(input),
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      }),
      this.db.marketingBanner.count({ where }),
    ])
    return { items, total }
  }
  createBanner(data: Prisma.MarketingBannerUncheckedCreateInput) {
    return this.db.marketingBanner.create({ data })
  }
  updateBanner(
    id: string,
    updatedAt: Date,
    data: Prisma.MarketingBannerUncheckedUpdateManyInput,
  ) {
    return this.db.marketingBanner.updateMany({
      where: { id, updatedAt },
      data,
    })
  }
  deleteBanner(id: string, updatedAt: Date) {
    return this.db.marketingBanner.deleteMany({ where: { id, updatedAt } })
  }
  content(id: string) {
    return this.db.contentPage.findUnique({ where: { id } })
  }
  async contents(input: ListInput) {
    const where: Prisma.ContentPageWhereInput = input.q
      ? {
          OR: [
            { title: { contains: input.q, mode: 'insensitive' } },
            { slug: { contains: input.q, mode: 'insensitive' } },
          ],
        }
      : {}
    const [items, total] = await Promise.all([
      this.db.contentPage.findMany({
        where,
        ...pagination(input),
        orderBy: [{ slug: 'asc' }, { locale: 'asc' }],
      }),
      this.db.contentPage.count({ where }),
    ])
    return { items, total }
  }
  createContent(data: Prisma.ContentPageUncheckedCreateInput) {
    return this.db.contentPage.create({ data })
  }
  updateContent(
    id: string,
    version: number,
    data: Prisma.ContentPageUncheckedUpdateManyInput,
  ) {
    return this.db.contentPage.updateMany({ where: { id, version }, data })
  }
  publishedContent(slug: string, locale: string) {
    return this.db.contentPage.findFirst({
      where: { slug, locale, publishedAt: { not: null } },
      select: {
        slug: true,
        locale: true,
        publishedTitle: true,
        publishedBody: true,
        publishedAt: true,
        version: true,
      },
    })
  }
  template(id: string) {
    return this.db.notificationTemplate.findUnique({ where: { id } })
  }
  async templates(input: ListInput) {
    const where: Prisma.NotificationTemplateWhereInput = input.q
      ? { key: { contains: input.q, mode: 'insensitive' } }
      : {}
    const [items, total] = await Promise.all([
      this.db.notificationTemplate.findMany({
        where,
        ...pagination(input),
        orderBy: [{ key: 'asc' }, { locale: 'asc' }],
      }),
      this.db.notificationTemplate.count({ where }),
    ])
    return { items, total }
  }
  createTemplate(data: Prisma.NotificationTemplateUncheckedCreateInput) {
    return this.db.notificationTemplate.create({ data })
  }
  updateTemplate(
    id: string,
    updatedAt: Date,
    data: Prisma.NotificationTemplateUncheckedUpdateManyInput,
  ) {
    return this.db.notificationTemplate.updateMany({
      where: { id, updatedAt },
      data,
    })
  }
  deleteTemplate(id: string, updatedAt: Date) {
    return this.db.notificationTemplate.deleteMany({
      where: { id, updatedAt },
    })
  }
  upload(id: string) {
    return this.db.upload.findUnique({ where: { id } })
  }
  payment(id: string) {
    return this.db.payment.findUnique({
      where: { id },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        provider: true,
        providerIntentId: true,
      },
    })
  }
  payout(id: string) {
    return this.db.sellerPayout.findUnique({
      where: { id },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        externalReference: true,
        evidenceUploadId: true,
        cycleKey: true,
        shopId: true,
      },
    })
  }
  async refund(id: string) {
    const result = await this.db.refund.findUnique({
      where: { id },
      select: {
        id: true,
        amount: true,
        status: true,
        externalReference: true,
        payment: { select: { currency: true } },
      },
    })
    return result
      ? {
          id: result.id,
          amount: result.amount,
          status: result.status,
          externalReference: result.externalReference,
          currency: result.payment.currency,
        }
      : null
  }
  evidence(id: string) {
    return this.db.financeReconciliation.findUnique({ where: { id } })
  }
  evidenceBySource(sourceKey: string) {
    return this.db.financeReconciliation.findUnique({ where: { sourceKey } })
  }
  async reconciliation(input: ListInput) {
    const where: Prisma.FinanceReconciliationWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.q
        ? {
            OR: [
              { sourceKey: { contains: input.q, mode: 'insensitive' } },
              { externalReference: { contains: input.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    }
    const [items, total] = await Promise.all([
      this.db.financeReconciliation.findMany({
        where,
        ...pagination(input),
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
      this.db.financeReconciliation.count({ where }),
    ])
    return { items, total }
  }
  createEvidence(data: Prisma.FinanceReconciliationUncheckedCreateInput) {
    return this.db.financeReconciliation.create({ data })
  }
  updateEvidence(
    id: string,
    version: number,
    data: Prisma.FinanceReconciliationUncheckedUpdateManyInput,
  ) {
    return this.db.financeReconciliation.updateMany({
      where: { id, version },
      data,
    })
  }
  async cycles(input: ListInput) {
    const where: Prisma.SellerPayoutWhereInput = {
      cycleKey: { not: null },
      ...(input.shopId ? { shopId: input.shopId } : {}),
    }
    const [items, total] = await Promise.all([
      this.db.sellerPayout.findMany({
        where,
        ...pagination(input),
        include: { shop: { select: { id: true, name: true } } },
        orderBy: [{ requestedAt: 'desc' }, { id: 'asc' }],
      }),
      this.db.sellerPayout.count({ where }),
    ])
    return { items, total }
  }
}
