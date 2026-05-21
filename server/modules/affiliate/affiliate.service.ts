import { createHash, randomBytes } from 'node:crypto'
import type { Affiliate, AffiliateCommission, AffiliateLink } from '#generated/client/client.ts'
import type { AffiliateStatus, AffiliateTargetType } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import { AffiliateServiceError } from './affiliate.errors.ts'
import type { IAffiliateRepository } from './affiliate.repository.ts'

const DEFAULT_ATTRIBUTION_WINDOW_DAYS = 30
const DEFAULT_COMMISSION_BPS = 500

export interface AffiliateConfig {
  enabled: boolean
  attributionWindowDays: number
  commissionBps: number
  blockSelfReferral: boolean
}

export interface CreateAffiliateLinkBody {
  code?: string
  targetType: AffiliateTargetType
  targetId: string
}

export interface AffiliateTargetSearchInput {
  targetType: AffiliateTargetType
  q?: string
  limit?: number
}

export interface TrackAffiliateClickInput {
  code?: string
  linkId?: string
  buyerUserId?: string | null
  sessionId?: string | null
  refParam?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

export interface CreateCommissionInput {
  orderId: string
  buyerUserId?: string
  sessionId?: string
  now?: Date
}

export type AffiliateClickResponse = {
  clickId: string
  code: string
  targetUrl: string
  expiresAt: Date
}

export class AffiliateService {
  constructor(
    appContext: AppContext,
    private repo: IAffiliateRepository,
    private config: AffiliateConfig = getAffiliateConfigFromEnv(),
  ) {
    appContext.logger.debug('AffiliateService initialized', {
      enabled: this.config.enabled,
      attributionWindowDays: this.config.attributionWindowDays,
      commissionBps: this.config.commissionBps,
    })
  }

  async createLink(user: { id: string }, input: CreateAffiliateLinkBody): Promise<AffiliateLink> {
    this.assertEnabled()
    this.validateCode(input.code)
    await this.assertValidTarget(input.targetType, input.targetId)

    return this.repo.transaction(async (txRepo) => {
      const affiliate = await txRepo.findOrCreateAffiliate(user.id)
      if (affiliate.status !== 'ACTIVE') {
        throw new AffiliateServiceError('Affiliate account is disabled', 403, 'AFFILIATE_DISABLED')
      }

      const code = input.code?.trim() || this.generateCode()
      const existing = await txRepo.findLinkByCode(code)
      if (existing) throw new AffiliateServiceError('Affiliate code already exists', 409, 'AFFILIATE_CODE_EXISTS')

      return txRepo.createLink({
        userId: affiliate.id,
        code,
        targetType: input.targetType,
        targetId: input.targetId,
      })
    })
  }

  listLinks(user: { id: string }): Promise<AffiliateLink[]> {
    this.assertEnabled()
    return this.repo.listLinksByUserId(user.id)
  }

  async getLink(user: { id: string }, linkId: string): Promise<AffiliateLink> {
    this.assertEnabled()
    const link = await this.repo.findLinkById(linkId)
    if (!link) throw new AffiliateServiceError('Affiliate link not found', 404, 'AFFILIATE_LINK_NOT_FOUND')
    if (link.affiliate.userId !== user.id) {
      throw new AffiliateServiceError('Affiliate link forbidden', 403, 'AFFILIATE_FORBIDDEN')
    }
    return link
  }

  async searchTargets(input: AffiliateTargetSearchInput) {
    this.assertEnabled()
    const targetType = input.targetType
    if (!['product', 'shop', 'campaign'].includes(targetType)) {
      throw new AffiliateServiceError('Invalid affiliate target', 400, 'INVALID_AFFILIATE_TARGET')
    }
    const limit = Number.isInteger(input.limit) && input.limit! > 0 ? Math.min(input.limit!, 20) : 10
    return {
      items: await this.repo.searchTargets({
        targetType,
        q: input.q,
        limit,
      }),
    }
  }

  async trackClick(input: TrackAffiliateClickInput): Promise<AffiliateClickResponse> {
    this.assertEnabled()
    const link = input.linkId ? await this.repo.findLinkById(input.linkId) : await this.repo.findLinkByCode(input.code ?? '')
    if (!link) throw new AffiliateServiceError('Affiliate link not found', 404, 'AFFILIATE_LINK_NOT_FOUND')
    if (link.status !== 'ACTIVE' || link.affiliate.status !== 'ACTIVE') {
      throw new AffiliateServiceError('Affiliate account or link is disabled', 403, 'AFFILIATE_DISABLED')
    }

    const expiresAt = this.addDays(new Date(), this.config.attributionWindowDays)
    const click = await this.repo.createClick({
      affiliateId: link.affiliateId,
      linkId: link.id,
      buyerUserId: input.buyerUserId ?? null,
      sessionId: input.sessionId?.trim() || null,
      refParam: input.refParam?.trim() || null,
      ipHash: this.hashNullable(input.ipAddress),
      userAgentHash: this.hashNullable(input.userAgent),
      expiresAt,
    })

    return {
      clickId: click.id,
      code: link.code,
      targetUrl: this.buildTargetUrl(link.targetType, link.targetId),
      expiresAt: click.expiresAt,
    }
  }

  async getStats(user: { id: string }) {
    this.assertEnabled()
    return this.repo.getStats(user.id)
  }

  listAdminAffiliates(): Promise<Awaited<ReturnType<IAffiliateRepository['listAffiliates']>>> {
    this.assertEnabled()
    return this.repo.listAffiliates()
  }

  async updateAffiliateStatus(affiliateId: string, status: AffiliateStatus): Promise<Affiliate> {
    this.assertEnabled()
    const affiliate = await this.repo.findAffiliateById(affiliateId)
    if (!affiliate) throw new AffiliateServiceError('Affiliate not found', 404, 'AFFILIATE_NOT_FOUND')
    return this.repo.updateAffiliateStatus(affiliateId, status)
  }

  async createCommissionForPaidOrder(input: CreateCommissionInput): Promise<AffiliateCommission | null> {
    this.assertEnabled()
    return this.createCommissionForPaidOrderWithRepo(this.repo, input)
  }

  async createCommissionForPaidOrderWithRepo(
    repo: IAffiliateRepository,
    input: CreateCommissionInput,
  ): Promise<AffiliateCommission | null> {
    if (!this.config.enabled) return null
    const now = input.now ?? new Date()
    const order = await repo.findOrderForCommission(input.orderId)
    if (!order) throw new AffiliateServiceError('Order not found', 404, 'AFFILIATE_NOT_FOUND')
    if (order.status === 'CANCELED' || order.status === 'REFUNDED' || order.paymentStatus !== 'SUCCEEDED') return null

    const existing = await repo.findCommissionByOrderId(input.orderId)
    if (existing) return existing

    const click = await repo.findLatestAttributableClick({
      buyerUserId: input.buyerUserId ?? order.userId,
      sessionId: input.sessionId,
      now,
    })
    if (!click) return null

    const affiliate = await repo.findAffiliateById(click.affiliateId)
    if (!affiliate) throw new AffiliateServiceError('Affiliate not found', 404, 'AFFILIATE_NOT_FOUND')
    if (affiliate.status !== 'ACTIVE') return null
    if (this.config.blockSelfReferral && affiliate.userId === order.userId) {
      throw new AffiliateServiceError('Self-referral is not allowed', 403, 'AFFILIATE_FORBIDDEN')
    }

    const eligiblesubtotal = this.calculateEligiblesubtotal(order)
    if (eligiblesubtotal <= 0) return null
    const commissionCents = Math.floor((eligiblesubtotal * this.config.commissionBps) / 10000)
    if (commissionCents <= 0) return null

    return repo.createCommission({
      affiliateId: click.affiliateId,
      linkId: click.linkId,
      clickId: click.id,
      orderId: order.id,
      eligiblesubtotal,
      commissionBps: this.config.commissionBps,
      commissionCents,
      currency: order.currency,
    })
  }

  private calculateEligiblesubtotal(order: { subtotal: number | bigint; discountTotal: number | bigint; items: Array<{ lineTotal: number | bigint }> }): number {
    const itemsubtotal = order.items.reduce((sum, item) => sum + Number(item.lineTotal), 0)
    const subtotal = itemsubtotal || Number(order.subtotal)
    return Math.max(0, subtotal - Number(order.discountTotal))
  }

  private async assertValidTarget(targetType: AffiliateTargetType, targetId: string): Promise<void> {
    if (!targetId.trim()) throw new AffiliateServiceError('Invalid affiliate target', 400, 'INVALID_AFFILIATE_TARGET')
    const exists = targetType === 'product'
      ? await this.repo.productExists(targetId)
      : targetType === 'shop'
        ? await this.repo.shopExists(targetId)
        : await this.repo.campaignExists(targetId)

    if (!exists) throw new AffiliateServiceError('Invalid affiliate target', 400, 'INVALID_AFFILIATE_TARGET')
  }

  private assertEnabled(): void {
    if (!this.config.enabled) throw new AffiliateServiceError('Affiliate feature is disabled', 403, 'AFFILIATE_DISABLED')
  }

  private validateCode(code?: string): void {
    if (!code) return
    if (!/^[a-zA-Z0-9_-]{4,40}$/.test(code.trim())) {
      throw new AffiliateServiceError('Invalid affiliate code', 400, 'INVALID_AFFILIATE_TARGET')
    }
  }

  private generateCode(): string {
    return `aff_${randomBytes(5).toString('hex')}`
  }

  private hashNullable(value?: string | null): string | null {
    if (!value?.trim()) return null
    return createHash('sha256').update(value.trim()).digest('hex')
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
  }

  private buildTargetUrl(targetType: AffiliateTargetType, targetId: string): string {
    if (targetType === 'product') return `/products/${targetId}`
    if (targetType === 'shop') return `/shops/${targetId}`
    return `/deals?campaign=${encodeURIComponent(targetId)}`
  }
}

export function getAffiliateConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AffiliateConfig {
  const attributionWindowDays = Number(env['AFFILIATE_ATTRIBUTION_WINDOW_DAYS'] ?? DEFAULT_ATTRIBUTION_WINDOW_DAYS)
  const commissionBps = Number(env['AFFILIATE_COMMISSION_BPS'] ?? DEFAULT_COMMISSION_BPS)
  return {
    enabled: env['AFFILIATE_ENABLED'] !== 'false',
    attributionWindowDays: Number.isInteger(attributionWindowDays) && attributionWindowDays > 0 ? attributionWindowDays : DEFAULT_ATTRIBUTION_WINDOW_DAYS,
    commissionBps: Number.isInteger(commissionBps) && commissionBps >= 0 && commissionBps <= 10000 ? commissionBps : DEFAULT_COMMISSION_BPS,
    blockSelfReferral: env['AFFILIATE_BLOCK_SELF_REFERRAL'] !== 'false',
  }
}
