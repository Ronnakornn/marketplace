import { parseStatementFile } from './statement-file.ts'
import type { Prisma } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import { moneyInteger, toMoneyDto } from '#server/lib/money.ts'
import type {
  AdminActor,
  AdminAuthorizer,
  AdminPermission,
} from '#server/modules/admin-access/admin-access.contract.ts'
import type { PayoutService } from '#server/modules/payout/payout.service.ts'
import type { UploadService } from '#server/modules/upload/upload.service.ts'
import { getPaymentProviderConfigFromEnv } from '#server/modules/payment/payment.config.ts'
import { PrismaAdminOperationsRepository } from './operations.repository.ts'
import type {
  BannerInput,
  ContentInput,
  EvidenceInput,
  ListInput,
  MatchInput,
  PolicyInput,
  ProviderInput,
  RateInput,
  TemplateInput,
} from './operations.schemas.ts'
import { AdminOperationsError } from './operations.errors.ts'
import {
  assertSafeLink,
  assertTimeWindow,
  isBannerActive,
  previewTemplate,
  templateVariables,
  validateTemplate,
} from './content-safety.ts'
import { quoteShipping, type ShippingPackage } from './shipping-quote.ts'

function auditJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(toMoneyDto(value)))
}
function requireText(value: string, max = 200) {
  if (!value.trim() || value.length > max)
    throw new AdminOperationsError('Text is empty or too long')
}
function assertVersion(changed: { count: number }) {
  if (changed.count !== 1)
    throw new AdminOperationsError(
      'Resource changed. Reload before saving',
      409,
      'ADMIN_OPERATIONS_STALE',
    )
}
function positiveMoney(value: string) {
  const amount = moneyInteger(value)
  if (amount < 0n) throw new AdminOperationsError('Amount cannot be negative')
  return amount
}
function assertLocale(locale: string) {
  if (!['th', 'en'].includes(locale))
    throw new AdminOperationsError('Locale must be th or en')
}

export class AdminOperationsService {
  constructor(
    private context: AppContext,
    private repo: PrismaAdminOperationsRepository,
    private access: AdminAuthorizer,
    private payouts?: PayoutService,
    private uploads?: UploadService,
  ) {}
  private async permit(actor: AdminActor, permission: AdminPermission) {
    await this.access.require(actor, permission)
  }
  private transaction<T>(
    actor: AdminActor,
    permission: AdminPermission,
    callback: (repo: PrismaAdminOperationsRepository) => Promise<T>,
  ) {
    return this.repo.transaction(async (repo) => {
      await repo.lockAdminGrants()
      await this.permit(actor, permission)
      return callback(repo)
    })
  }
  private page(input: ListInput) {
    if (
      !Number.isInteger(input.page ?? 1) ||
      !Number.isInteger(input.limit ?? 20) ||
      (input.page ?? 1) < 1 ||
      (input.limit ?? 20) < 1 ||
      (input.limit ?? 20) > 100
    )
      throw new AdminOperationsError('Invalid pagination')
    return input
  }
  async listPolicies(actor: AdminActor, input: ListInput) {
    await this.permit(actor, 'shops.read')
    return this.repo.policies(this.page(input))
  }
  async savePolicy(actor: AdminActor, shopId: string, input: PolicyInput) {
    await this.permit(actor, 'shops.write')
    if (
      input.commissionBps !== null &&
      (!Number.isInteger(input.commissionBps) ||
        input.commissionBps < 0 ||
        input.commissionBps > 10000)
    )
      throw new AdminOperationsError(
        'Commission must be 0 to 10000 basis points',
      )
    if (
      ![input.dispatchSlaHours, input.deliverySlaHours].every(
        (value) => Number.isInteger(value) && value > 0 && value <= 8760,
      )
    )
      throw new AdminOperationsError('SLA must be 1 to 8760 hours')
    const payoutMinimum = positiveMoney(input.payoutMinimum)
    return this.transaction(actor, 'shops.write', async (repo) => {
      if (!(await repo.shop(shopId)))
        throw new AdminOperationsError('Shop not found', 404)
      const before = await repo.policy(shopId)
      const data = {
        commissionBps: input.commissionBps,
        dispatchSlaHours: input.dispatchSlaHours,
        deliverySlaHours: input.deliverySlaHours,
        shippingRatesEnabled: input.shippingRatesEnabled,
        payoutCadence: input.payoutCadence,
        payoutMinimum,
        updatedById: actor.id,
      }
      if (!before) {
        if (input.expectedVersion !== 0)
          throw new AdminOperationsError(
            'Policy changed. Reload before saving',
            409,
            'ADMIN_OPERATIONS_STALE',
          )
        await repo.createPolicy({ shopId, ...data })
      } else
        assertVersion(
          await repo.updatePolicy(shopId, input.expectedVersion, {
            ...data,
            version: { increment: 1 },
          }),
        )
      const result = await repo.policy(shopId)
      await repo.audit(
        actor,
        'shop-operation-policy',
        shopId,
        input.reason,
        auditJson(result),
        auditJson(before),
      )
      return result
    })
  }
  async listProviders(actor: AdminActor, input: ListInput) {
    await this.permit(actor, 'settings.read')
    return this.repo.providers(this.page(input))
  }
  async saveProvider(
    actor: AdminActor,
    id: string | null,
    input: ProviderInput,
  ) {
    await this.permit(actor, 'settings.write')
    requireText(input.name)
    requireText(input.code, 80)
    return this.transaction(actor, 'settings.write', async (repo) => {
      if (input.shopId && !(await repo.shop(input.shopId)))
        throw new AdminOperationsError('Shop not found', 404)
      const { reason, expectedUpdatedAt, ...data } = input
      if (id) {
        const before = await repo.provider(id)
        if (!before) throw new AdminOperationsError('Provider not found', 404)
        if (!expectedUpdatedAt)
          throw new AdminOperationsError('Provider revision is required')
        if (before.shopId !== data.shopId)
          throw new AdminOperationsError(
            'Provider ownership cannot change',
            409,
          )
        assertVersion(
          await repo.updateProvider(id, new Date(expectedUpdatedAt), data),
        )
      } else id = (await repo.createProvider(data)).id
      await repo.audit(actor, 'shipping-provider', id, reason, auditJson(data))
      return { id }
    })
  }
  async deleteProvider(
    actor: AdminActor,
    id: string,
    input: { expectedUpdatedAt: string; reason: string },
  ) {
    await this.permit(actor, 'settings.write')
    return this.transaction(actor, 'settings.write', async (repo) => {
      assertVersion(
        await repo.deleteProvider(id, new Date(input.expectedUpdatedAt)),
      )
      await repo.audit(actor, 'shipping-provider', id, input.reason, {
        deleted: true,
      })
      return { id }
    })
  }
  async listRates(actor: AdminActor, input: ListInput) {
    await this.permit(actor, 'settings.read')
    return this.repo.rates(this.page(input))
  }
  async saveRate(actor: AdminActor, id: string | null, input: RateInput) {
    await this.permit(actor, 'settings.write')
    requireText(input.name)
    if (
      !/^[A-Z]{2}$/.test(input.country) ||
      input.postalPrefixes.length > 100 ||
      input.regions.length > 100 ||
      input.postalPrefixes.some(
        (prefix) => !/^[A-Za-z0-9 -]{1,20}$/.test(prefix),
      ) ||
      input.regions.some((region) => region.length > 100)
    )
      throw new AdminOperationsError('Invalid shipping area')
    if (
      !Number.isInteger(input.minWeightGrams) ||
      input.minWeightGrams < 0 ||
      input.minWeightGrams > 100_000_000 ||
      (input.maxWeightGrams !== null &&
        (!Number.isInteger(input.maxWeightGrams) ||
          input.maxWeightGrams < input.minWeightGrams ||
          input.maxWeightGrams > 100_000_000))
    )
      throw new AdminOperationsError('Invalid weight interval')
    if (
      [input.maxLengthMm, input.maxWidthMm, input.maxHeightMm].some(
        (value) =>
          value !== null &&
          (!Number.isInteger(value) || value <= 0 || value > 1_000_000),
      ) ||
      !Number.isInteger(input.volumetricDivisor) ||
      input.volumetricDivisor <= 0 ||
      input.volumetricDivisor > 1_000_000 ||
      !Number.isInteger(input.priority) ||
      Math.abs(input.priority) > 10000
    )
      throw new AdminOperationsError(
        'Invalid package dimensions, divisor or priority',
      )
    return this.transaction(actor, 'settings.write', async (repo) => {
      const provider = await repo.provider(input.providerId)
      if (!provider) throw new AdminOperationsError('Provider not found', 404)
      if (provider.shopId !== null && provider.shopId !== input.shopId)
        throw new AdminOperationsError(
          'Rate must belong to its provider shop',
          409,
        )
      if (input.shopId && !(await repo.shop(input.shopId)))
        throw new AdminOperationsError('Shop not found', 404)
      const { reason, expectedVersion, baseFee, perKgFee, ...fields } = input
      const data = {
        ...fields,
        baseFee: positiveMoney(baseFee),
        perKgFee: positiveMoney(perKgFee),
      }
      let result
      if (id) {
        if (!expectedVersion)
          throw new AdminOperationsError('Rate revision is required')
        assertVersion(
          await repo.updateRate(id, expectedVersion, {
            ...data,
            version: { increment: 1 },
          }),
        )
        result = await repo.rate(id)
      } else result = await repo.createRate(data)
      if (!result) throw new AdminOperationsError('Rate not found', 404)
      await repo.audit(
        actor,
        'shipping-rate',
        result.id,
        reason,
        auditJson(result),
      )
      return result
    })
  }
  async deleteRate(
    actor: AdminActor,
    id: string,
    input: { expectedVersion: number; reason: string },
  ) {
    await this.permit(actor, 'settings.write')
    return this.transaction(actor, 'settings.write', async (repo) => {
      assertVersion(await repo.deleteRate(id, input.expectedVersion))
      await repo.audit(actor, 'shipping-rate', id, input.reason, {
        deleted: true,
      })
      return { id }
    })
  }
  async previewShipping(
    actor: AdminActor,
    input: {
      shopId: string
      country: string
      postalCode: string
      region?: string
      packages: ShippingPackage[]
    },
  ) {
    await this.permit(actor, 'settings.read')
    const [shop, policy, rules] = await Promise.all([
      this.repo.shop(input.shopId),
      this.repo.policy(input.shopId),
      this.repo.quoteRules(input.shopId),
    ])
    if (!shop) throw new AdminOperationsError('Shop not found', 404)
    return quoteShipping(
      {
        ...input,
        enabled: policy?.shippingRatesEnabled ?? false,
        flatFee: shop.settings?.shippingFee ?? 0n,
      },
      rules,
    )
  }
  async listBanners(actor: AdminActor, input: ListInput, now = new Date()) {
    await this.permit(actor, 'marketing.read')
    const result = await this.repo.banners(this.page(input))
    return {
      ...result,
      items: result.items.map((banner) => ({
        ...banner,
        activeNow: isBannerActive(banner, now),
      })),
    }
  }
  async saveBanner(actor: AdminActor, id: string | null, input: BannerInput) {
    await this.permit(actor, 'marketing.write')
    requireText(input.title, 300)
    requireText(input.imageUrl, 2048)
    if (Math.abs(input.sortOrder) > 10000)
      throw new AdminOperationsError('Display order is out of bounds')
    assertSafeLink(input.imageUrl)
    assertSafeLink(input.mobileImageUrl)
    assertSafeLink(input.targetUrl)
    const startsAt = input.startsAt ? new Date(input.startsAt) : null
    const endsAt = input.endsAt ? new Date(input.endsAt) : null
    assertTimeWindow(startsAt, endsAt)
    if (input.status === 'SCHEDULED' && !startsAt)
      throw new AdminOperationsError(
        'Scheduled publication requires a start time',
      )
    const {
      reason,
      expectedUpdatedAt,
      popupFrequency,
      titleTh,
      titleEn,
      bodyTh,
      bodyEn,
      ...fields
    } = input
    const data = {
      ...fields,
      startsAt,
      endsAt,
      metadata: { popupFrequency, titleTh, titleEn, bodyTh, bodyEn },
    }
    return this.transaction(actor, 'marketing.write', async (repo) => {
      let result
      if (
        ['PUBLISHED', 'SCHEDULED'].includes(input.status) &&
        (await repo.bannerCollision(
          input.placement,
          input.sortOrder,
          startsAt,
          endsAt,
          id,
        ))
      )
        throw new AdminOperationsError(
          'Another banner uses this placement and display order during the publication window',
          409,
        )
      if (id) {
        if (!expectedUpdatedAt)
          throw new AdminOperationsError('Banner revision is required')
        assertVersion(
          await repo.updateBanner(id, new Date(expectedUpdatedAt), data),
        )
        result = await repo.banner(id)
      } else result = await repo.createBanner(data)
      if (!result) throw new AdminOperationsError('Banner not found', 404)
      await repo.audit(actor, 'marketing-banner', result.id, reason, {
        placement: result.placement,
        status: result.status,
        title: result.title,
        sortOrder: result.sortOrder,
        startsAt: result.startsAt?.toISOString() ?? null,
        endsAt: result.endsAt?.toISOString() ?? null,
      })
      return result
    })
  }
  async deleteBanner(
    actor: AdminActor,
    id: string,
    input: { expectedUpdatedAt: string; reason: string },
  ) {
    await this.permit(actor, 'marketing.write')
    return this.transaction(actor, 'marketing.write', async (repo) => {
      assertVersion(
        await repo.deleteBanner(id, new Date(input.expectedUpdatedAt)),
      )
      await repo.audit(actor, 'marketing-banner', id, input.reason, {
        deleted: true,
      })
      return { id }
    })
  }
  async listContent(actor: AdminActor, input: ListInput) {
    await this.permit(actor, 'content.read')
    return this.repo.contents(this.page(input))
  }
  async saveContent(actor: AdminActor, id: string | null, input: ContentInput) {
    await this.permit(actor, 'content.write')
    assertLocale(input.locale)
    requireText(input.title, 300)
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) ||
      input.slug.length > 120 ||
      input.draftBody.length > 100000
    )
      throw new AdminOperationsError('Invalid content slug or body')
    return this.transaction(actor, 'content.write', async (repo) => {
      const { reason, expectedVersion, ...fields } = input
      const data = { ...fields, updatedById: actor.id }
      let result
      if (id) {
        if (!expectedVersion)
          throw new AdminOperationsError('Content revision is required')
        const current = await repo.content(id)
        if (
          current?.publishedAt &&
          (current.slug !== input.slug || current.locale !== input.locale)
        )
          throw new AdminOperationsError(
            'Published identity cannot change',
            409,
          )
        assertVersion(
          await repo.updateContent(id, expectedVersion, {
            ...data,
            version: { increment: 1 },
          }),
        )
        result = await repo.content(id)
      } else result = await repo.createContent(data)
      if (!result) throw new AdminOperationsError('Content not found', 404)
      await repo.audit(actor, 'content-page', result.id, reason, {
        slug: result.slug,
        locale: result.locale,
        version: result.version,
      })
      return result
    })
  }
  async publishContent(
    actor: AdminActor,
    id: string,
    input: { expectedVersion: number; reason: string; unpublish?: boolean },
  ) {
    await this.permit(actor, 'content.write')
    return this.transaction(actor, 'content.write', async (repo) => {
      const current = await repo.content(id)
      if (!current) throw new AdminOperationsError('Content not found', 404)
      assertVersion(
        await repo.updateContent(id, input.expectedVersion, {
          publishedTitle: input.unpublish ? null : current.title,
          publishedBody: input.unpublish ? null : current.draftBody,
          publishedAt: input.unpublish ? null : new Date(),
          version: { increment: 1 },
          updatedById: actor.id,
        }),
      )
      const result = await repo.content(id)
      await repo.audit(actor, 'content-page-publication', id, input.reason, {
        published: !input.unpublish,
        version: result?.version ?? 0,
      })
      return result
    })
  }
  publishedContent(slug: string, locale: string) {
    assertLocale(locale)
    return this.repo.publishedContent(slug, locale)
  }
  async listTemplates(actor: AdminActor, input: ListInput) {
    await this.permit(actor, 'settings.read')
    return this.repo.templates(this.page(input))
  }
  async saveTemplate(
    actor: AdminActor,
    id: string | null,
    input: TemplateInput,
  ) {
    await this.permit(actor, 'settings.write')
    assertLocale(input.locale)
    requireText(input.key, 100)
    if (input.body.length > 10000 || (input.subject?.length ?? 0) > 500)
      throw new AdminOperationsError('Template is too long')
    const variables = [
      ...new Set([
        ...validateTemplate(input.body),
        ...validateTemplate(input.subject ?? ''),
      ]),
    ]
    return this.transaction(actor, 'settings.write', async (repo) => {
      const { reason, expectedUpdatedAt, ...fields } = input
      const data = { ...fields, variables }
      let result
      if (id) {
        if (!expectedUpdatedAt)
          throw new AdminOperationsError('Template revision is required')
        assertVersion(
          await repo.updateTemplate(id, new Date(expectedUpdatedAt), data),
        )
        result = await repo.template(id)
      } else result = await repo.createTemplate(data)
      if (!result) throw new AdminOperationsError('Template not found', 404)
      await repo.audit(actor, 'notification-template', result.id, reason, {
        key: result.key,
        channel: result.channel,
        locale: result.locale,
        variables,
      })
      return result
    })
  }
  async deleteTemplate(
    actor: AdminActor,
    id: string,
    input: { expectedUpdatedAt: string; reason: string },
  ) {
    await this.permit(actor, 'settings.write')
    return this.transaction(actor, 'settings.write', async (repo) => {
      assertVersion(
        await repo.deleteTemplate(id, new Date(input.expectedUpdatedAt)),
      )
      await repo.audit(actor, 'notification-template', id, input.reason, {
        deleted: true,
      })
      return { id }
    })
  }
  async previewTemplate(
    actor: AdminActor,
    input: {
      subject?: string
      body: string
      values: Parameters<typeof previewTemplate>[1]
    },
  ) {
    await this.permit(actor, 'settings.read')
    return {
      subject: previewTemplate(input.subject ?? '', input.values),
      body: previewTemplate(input.body, input.values),
      allowedVariables: templateVariables,
    }
  }
  async listReconciliation(actor: AdminActor, input: ListInput) {
    await this.permit(actor, 'finance.read')
    return this.repo.reconciliation(this.page(input))
  }
  private async validateEvidence(
    repo: PrismaAdminOperationsRepository,
    actor: AdminActor,
    input: EvidenceInput,
  ) {
    requireText(input.sourceKey)
    requireText(input.externalReference)
    if (!/^[A-Z]{3}$/.test(input.currency))
      throw new AdminOperationsError('Currency must be a three-letter code')
    const amount = positiveMoney(input.amount)
    if (amount <= 0n)
      throw new AdminOperationsError('Evidence amount must be positive')
    if (input.uploadId) {
      const upload = await repo.upload(input.uploadId)
      if (
        !upload ||
        upload.status !== 'COMPLETED' ||
        upload.usage !== 'FINANCE_EVIDENCE' ||
        upload.publicUrl ||
        !upload.key.startsWith('private/')
      )
        throw new AdminOperationsError(
          'Evidence requires a completed private finance upload',
          409,
        )
      if (upload.userId !== actor.id)
        await this.permit(actor, 'finance.reconcile')
    }
    if (
      input.kind === 'OPERATING_EXPENSE' &&
      (input.paymentId || input.payoutId || input.refundId || !input.occurredAt)
    )
      throw new AdminOperationsError(
        'Operating expense requires its date and cannot link to customer settlement',
      )
    if (
      ['PAYOUT_EVIDENCE', 'REFUND_EVIDENCE', 'PAYMENT_EVIDENCE'].includes(
        input.kind,
      ) &&
      !input.uploadId
    )
      throw new AdminOperationsError('Evidence upload is required')
    if (
      [input.paymentId, input.payoutId, input.refundId].filter(Boolean).length >
        1 ||
      (input.kind === 'PAYMENT_EVIDENCE' &&
        (!input.paymentId || input.payoutId || input.refundId)) ||
      (input.kind === 'PAYOUT_EVIDENCE' &&
        (!input.payoutId || input.paymentId || input.refundId)) ||
      (input.kind === 'REFUND_EVIDENCE' &&
        (!input.refundId || input.paymentId || input.payoutId))
    )
      throw new AdminOperationsError('Evidence target does not match its kind')
    const target = input.paymentId
      ? await repo.payment(input.paymentId)
      : input.payoutId
        ? await repo.payout(input.payoutId)
        : input.refundId
          ? await repo.refund(input.refundId)
          : null
    if ((input.paymentId || input.payoutId || input.refundId) && !target)
      throw new AdminOperationsError('Finance target not found', 404)
    if (
      target &&
      (target.amount !== amount || target.currency !== input.currency)
    )
      throw new AdminOperationsError(
        'Evidence amount or currency does not match',
        409,
        'FINANCE_EVIDENCE_MISMATCH',
      )
    const targetReference =
      target &&
      ('providerIntentId' in target
        ? (target.providerIntentId ?? target.id)
        : target.externalReference)
    if (targetReference && targetReference !== input.externalReference)
      throw new AdminOperationsError(
        'Evidence reference does not match',
        409,
        'FINANCE_EVIDENCE_MISMATCH',
      )
    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : null
    if (occurredAt && !Number.isFinite(occurredAt.getTime()))
      throw new AdminOperationsError('Invalid evidence time')
    return { amount, occurredAt }
  }
  async createEvidence(actor: AdminActor, input: EvidenceInput) {
    await this.permit(actor, 'finance.reconcile')
    return this.transaction(actor, 'finance.reconcile', async (repo) => {
      const normalized = await this.validateEvidence(repo, actor, input)
      const { reason, ...fields } = input
      const result = await repo.createEvidence({
        ...fields,
        ...normalized,
        note: reason,
        createdById: actor.id,
      })
      await repo.audit(actor, 'finance-evidence', result.id, reason, {
        kind: result.kind,
        amount: result.amount.toString(),
        currency: result.currency,
        sourceKey: result.sourceKey,
        status: result.status,
      })
      return result
    })
  }
  async matchEvidence(actor: AdminActor, id: string, input: MatchInput) {
    await this.permit(actor, 'finance.reconcile')
    return this.transaction(actor, 'finance.reconcile', async (repo) => {
      const row = await repo.evidence(id)
      if (!row) throw new AdminOperationsError('Evidence not found', 404)
      const targets = {
        paymentId: input.paymentId ?? row.paymentId ?? undefined,
        payoutId: input.payoutId ?? row.payoutId ?? undefined,
        refundId: input.refundId ?? row.refundId ?? undefined,
      }
      if (!input.reject && row.kind === 'OPERATING_EXPENSE') {
        if (Object.values(targets).some(Boolean))
          throw new AdminOperationsError(
            'Operating expense cannot link to customer settlement',
          )
        if (row.createdById === actor.id)
          throw new AdminOperationsError(
            'Operating expense requires a different reviewer',
            409,
          )
      } else if (!input.reject) {
        if (Object.values(targets).filter(Boolean).length !== 1)
          throw new AdminOperationsError('Select exactly one finance target')
        if (
          (row.kind === 'PAYMENT_EVIDENCE' && !targets.paymentId) ||
          (row.kind === 'PAYOUT_EVIDENCE' && !targets.payoutId) ||
          (row.kind === 'REFUND_EVIDENCE' && !targets.refundId)
        )
          throw new AdminOperationsError(
            'Evidence target does not match its kind',
          )
        const target = targets.paymentId
          ? await repo.payment(targets.paymentId)
          : targets.payoutId
            ? await repo.payout(targets.payoutId)
            : targets.refundId
              ? await repo.refund(targets.refundId)
              : null
        if (!target)
          throw new AdminOperationsError('Finance target not found', 404)
        const reference =
          'providerIntentId' in target
            ? (target.providerIntentId ?? target.id)
            : target.externalReference
        if (
          row.amount !== target.amount ||
          row.currency !== target.currency ||
          !reference ||
          reference !== row.externalReference
        )
          throw new AdminOperationsError(
            'Amount, currency and reference must match exactly',
            409,
            'FINANCE_EVIDENCE_MISMATCH',
          )
      }
      assertVersion(
        await repo.updateEvidence(id, input.expectedVersion, {
          ...targets,
          status: input.reject ? 'REJECTED' : 'MATCHED',
          reviewedById: actor.id,
          reviewedAt: new Date(),
          note: input.reason,
          version: { increment: 1 },
        }),
      )
      const result = await repo.evidence(id)
      await repo.audit(actor, 'finance-reconciliation', id, input.reason, {
        status: result?.status ?? '',
        ...targets,
      })
      return result
    })
  }
  async previewStatement(actor: AdminActor, rows: EvidenceInput[]) {
    await this.permit(actor, 'finance.reconcile')
    if (!rows.length || rows.length > 1000)
      throw new AdminOperationsError('Statement requires 1 to 1000 rows')
    const seen = new Set<string>()
    const results = []
    for (const [index, row] of rows.entries()) {
      try {
        await this.validateEvidence(this.repo, actor, row)
        if (
          seen.has(row.sourceKey) ||
          (await this.repo.evidenceBySource(row.sourceKey))
        )
          throw new AdminOperationsError('Source key already exists', 409)
        seen.add(row.sourceKey)
        results.push({
          row: index + 1,
          sourceKey: row.sourceKey,
          valid: true,
          error: null,
          errorCode: null,
        })
      } catch (error) {
        results.push({
          row: index + 1,
          sourceKey: row.sourceKey,
          valid: false,
          errorCode:
            error instanceof AdminOperationsError
              ? error.code
              : 'ADMIN_OPERATIONS_INVALID',
          error:
            error instanceof Error ? error.message : 'Invalid statement row',
        })
      }
    }
    return {
      rows: results,
      valid: results.every((row) => row.valid),
      settlementEffect: 'NONE',
    }
  }
  async importStatement(actor: AdminActor, rows: EvidenceInput[]) {
    await this.permit(actor, 'finance.reconcile')
    const preview = await this.previewStatement(actor, rows)
    if (!preview.valid)
      throw new AdminOperationsError('Statement has invalid rows', 409)
    return this.transaction(actor, 'finance.reconcile', async (repo) => {
      const ids = []
      for (const row of rows) {
        const normalized = await this.validateEvidence(repo, actor, row)
        const { reason, ...fields } = row
        const result = await repo.createEvidence({
          ...fields,
          ...normalized,
          note: reason,
          createdById: actor.id,
        })
        await repo.audit(actor, 'finance-evidence', result.id, reason, {
          sourceKey: result.sourceKey,
          amount: result.amount.toString(),
          currency: result.currency,
        })
        ids.push(result.id)
      }
      return { ids, imported: ids.length, settlementEffect: 'NONE' }
    })
  }
  async previewStatementFile(
    actor: AdminActor,
    input: Parameters<typeof parseStatementFile>[0],
  ) {
    await this.permit(actor, 'finance.reconcile')
    const parsed = parseStatementFile(input)
    return {
      ...(await this.previewStatement(actor, parsed.rows)),
      fingerprint: parsed.fingerprint,
    }
  }
  async importStatementFile(
    actor: AdminActor,
    input: Parameters<typeof parseStatementFile>[0] & {
      expectedFingerprint: string
    },
  ) {
    await this.permit(actor, 'finance.reconcile')
    const parsed = parseStatementFile(input)
    if (parsed.fingerprint !== input.expectedFingerprint)
      throw new AdminOperationsError(
        'Statement preview changed. Preview again',
        409,
        'ADMIN_OPERATIONS_STALE',
      )
    return this.importStatement(actor, parsed.rows)
  }
  async paymentChannels(actor: AdminActor) {
    await this.permit(actor, 'finance.read')
    try {
      const config = getPaymentProviderConfigFromEnv()
      return {
        provider: config.provider,
        mode:
          config.provider === 'disabled'
            ? 'DISABLED'
            : config.provider === 'mock'
              ? 'DEVELOPMENT'
              : 'EXTERNAL_BRIDGE',
        checkoutReady: config.provider !== 'disabled',
        webhookReady: Boolean(process.env.PAYMENT_WEBHOOK_SECRET),
        editable: false,
        settlementSource: 'VERIFIED_WEBHOOK',
        transferCapability: 'MANUAL_EXTERNAL',
      }
    } catch {
      return {
        provider: 'unconfigured',
        mode: 'UNAVAILABLE',
        checkoutReady: false,
        webhookReady: Boolean(process.env.PAYMENT_WEBHOOK_SECRET),
        editable: false,
        settlementSource: 'VERIFIED_WEBHOOK',
        transferCapability: 'MANUAL_EXTERNAL',
      }
    }
  }
  async listCycles(actor: AdminActor, input: ListInput) {
    await this.permit(actor, 'finance.read')
    return this.repo.cycles(this.page(input))
  }
  async prepareCycles(actor: AdminActor) {
    await this.permit(actor, 'payouts.approve')
    if (!this.payouts)
      throw new AdminOperationsError('Payout service is unavailable', 409)
    this.context.logger.info('Preparing due payout cycles', {
      actorId: actor.id,
    })
    return this.payouts.prepareDuePayouts(new Date(), actor)
  }
  async recordPayout(
    actor: AdminActor,
    payoutId: string,
    input: { evidenceId: string; externalReference: string },
  ) {
    await this.permit(actor, 'payouts.complete')
    if (!this.payouts)
      throw new AdminOperationsError('Payout service is unavailable', 409)
    return this.payouts.markAdminPayoutPaid(actor, payoutId, input)
  }
  async evidenceDownload(actor: AdminActor, evidenceId: string) {
    await this.permit(actor, 'finance.read')
    const evidence = await this.repo.evidence(evidenceId)
    if (!evidence?.uploadId || !this.uploads)
      throw new AdminOperationsError('Evidence file not found', 404)
    return { url: await this.uploads.getDownloadUrl(actor, evidence.uploadId) }
  }
}
