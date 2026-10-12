import { t, type Static } from 'elysia'
import { ShopOperationPolicyPlain } from '#generated/prismabox/ShopOperationPolicy.ts'
import { ShippingProviderPlain } from '#generated/prismabox/ShippingProvider.ts'
import { ShippingRateRulePlain } from '#generated/prismabox/ShippingRateRule.ts'
import { MarketingBannerPlain } from '#generated/prismabox/MarketingBanner.ts'
import { ContentPagePlain } from '#generated/prismabox/ContentPage.ts'
import { NotificationTemplatePlain } from '#generated/prismabox/NotificationTemplate.ts'
import { FinanceReconciliationPlain } from '#generated/prismabox/FinanceReconciliation.ts'
import { MinorUnitString } from '#server/lib/money.ts'

export const PageQuery = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 10000 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
  q: t.Optional(t.String({ maxLength: 200 })),
  shopId: t.Optional(t.String({ format: 'uuid' })),
  status: t.Optional(t.String({ maxLength: 30 })),
})
export const MutationContext = t.Object({
  reason: t.String({ minLength: 3, maxLength: 500 }),
})
export const PolicyBody = t.Composite([
  MutationContext,
  t.Omit(
    t.Pick(ShopOperationPolicyPlain, [
      'commissionBps',
      'dispatchSlaHours',
      'deliverySlaHours',
      'shippingRatesEnabled',
      'payoutCadence',
    ]),
    ['payoutCadence'],
  ),
  t.Object({
    expectedVersion: t.Integer({ minimum: 0 }),
    payoutCadence: t.Union([
      t.Literal('MANUAL'),
      t.Literal('DAILY'),
      t.Literal('WEEKLY'),
      t.Literal('MONTHLY'),
    ]),
    payoutMinimum: MinorUnitString,
  }),
])
export const ProviderBody = t.Composite([
  MutationContext,
  t.Pick(ShippingProviderPlain, [
    'shopId',
    'code',
    'name',
    'displayNameTh',
    'displayNameEn',
    'isActive',
    'supportsCod',
    'supportsPickup',
  ]),
  t.Object({
    expectedUpdatedAt: t.Optional(t.String({ format: 'date-time' })),
  }),
])
export const RateBody = t.Composite([
  MutationContext,
  t.Omit(
    t.Pick(ShippingRateRulePlain, [
      'providerId',
      'shopId',
      'name',
      'country',
      'postalPrefixes',
      'regions',
      'minWeightGrams',
      'maxWeightGrams',
      'maxLengthMm',
      'maxWidthMm',
      'maxHeightMm',
      'volumetricDivisor',
      'priority',
      'isActive',
    ]),
    [],
  ),
  t.Object({
    expectedVersion: t.Optional(t.Integer({ minimum: 1 })),
    baseFee: MinorUnitString,
    perKgFee: MinorUnitString,
  }),
])
export const QuoteBody = t.Object({
  shopId: t.String({ format: 'uuid' }),
  country: t.String({ minLength: 2, maxLength: 2 }),
  postalCode: t.String({ maxLength: 20 }),
  region: t.Optional(t.String({ maxLength: 100 })),
  packages: t.Array(
    t.Object({
      weightGrams: t.Integer({ minimum: 1, maximum: 1000000 }),
      lengthMm: t.Integer({ minimum: 1, maximum: 1000000 }),
      widthMm: t.Integer({ minimum: 1, maximum: 1000000 }),
      heightMm: t.Integer({ minimum: 1, maximum: 1000000 }),
    }),
    { minItems: 1, maxItems: 100 },
  ),
})
export const BannerBody = t.Composite([
  MutationContext,
  t.Omit(
    t.Pick(MarketingBannerPlain, [
      'placement',
      'title',
      'subtitle',
      'imageUrl',
      'mobileImageUrl',
      'targetUrl',
      'status',
      'sortOrder',
    ]),
    [],
  ),
  t.Object({
    expectedUpdatedAt: t.Optional(t.String({ format: 'date-time' })),
    startsAt: t.Nullable(t.String({ format: 'date-time' })),
    endsAt: t.Nullable(t.String({ format: 'date-time' })),
    popupFrequency: t.Union([
      t.Literal('SESSION'),
      t.Literal('DAILY'),
      t.Literal('ALWAYS'),
    ]),
    titleTh: t.String({ maxLength: 300 }),
    titleEn: t.String({ maxLength: 300 }),
    bodyTh: t.String({ maxLength: 2000 }),
    bodyEn: t.String({ maxLength: 2000 }),
  }),
])
export const ContentBody = t.Composite([
  MutationContext,
  t.Pick(ContentPagePlain, ['slug', 'locale', 'title', 'draftBody']),
  t.Object({ expectedVersion: t.Optional(t.Integer({ minimum: 1 })) }),
])
export const PublishBody = t.Composite([
  MutationContext,
  t.Object({ expectedVersion: t.Integer({ minimum: 1 }) }),
])
export const TemplateBody = t.Composite([
  MutationContext,
  t.Pick(NotificationTemplatePlain, [
    'key',
    'channel',
    'locale',
    'subject',
    'body',
    'isActive',
  ]),
  t.Object({
    expectedUpdatedAt: t.Optional(t.String({ format: 'date-time' })),
  }),
])
export const PreviewTemplateBody = t.Object({
  subject: t.Optional(t.String({ maxLength: 500 })),
  body: t.String({ maxLength: 10000 }),
  values: t.Object({
    name: t.Optional(t.String({ maxLength: 200 })),
    orderNumber: t.Optional(t.String({ maxLength: 200 })),
    shopName: t.Optional(t.String({ maxLength: 200 })),
    buyerName: t.Optional(t.String({ maxLength: 200 })),
    trackingNumber: t.Optional(t.String({ maxLength: 200 })),
    amount: t.Optional(t.String({ maxLength: 200 })),
    currency: t.Optional(t.String({ maxLength: 200 })),
    supportTicketNumber: t.Optional(t.String({ maxLength: 200 })),
  }),
})
export const EvidenceBody = t.Composite([
  MutationContext,
  t.Pick(FinanceReconciliationPlain, ['sourceKey', 'currency']),
  t.Object({
    kind: t.Union([
      t.Literal('BANK_STATEMENT'),
      t.Literal('PAYMENT_EVIDENCE'),
      t.Literal('PAYOUT_EVIDENCE'),
      t.Literal('REFUND_EVIDENCE'),
      t.Literal('OPERATING_EXPENSE'),
    ]),
    amount: MinorUnitString,
    externalReference: t.String({ minLength: 1, maxLength: 200 }),
    occurredAt: t.Nullable(t.String({ format: 'date-time' })),
    uploadId: t.Optional(t.String({ format: 'uuid' })),
    paymentId: t.Optional(t.String({ format: 'uuid' })),
    payoutId: t.Optional(t.String({ format: 'uuid' })),
    refundId: t.Optional(t.String({ format: 'uuid' })),
    batchKey: t.Optional(t.String({ maxLength: 200 })),
  }),
])
export const MatchBody = t.Composite([
  MutationContext,
  t.Object({
    expectedVersion: t.Integer({ minimum: 1 }),
    paymentId: t.Optional(t.String({ format: 'uuid' })),
    payoutId: t.Optional(t.String({ format: 'uuid' })),
    refundId: t.Optional(t.String({ format: 'uuid' })),
    reject: t.Optional(t.Boolean()),
  }),
])
export const StatementBody = t.Object({
  rows: t.Array(EvidenceBody, { minItems: 1, maxItems: 1000 }),
})
export const StatementFileBody = t.Object({
  fileName: t.String({ minLength: 1, maxLength: 200 }),
  base64: t.String({ minLength: 1, maxLength: 12000000 }),
  reason: t.String({ minLength: 3, maxLength: 500 }),
  batchKey: t.String({ minLength: 1, maxLength: 200 }),
})
export type ListInput = Static<typeof PageQuery>
export type PolicyInput = Static<typeof PolicyBody>
export type ProviderInput = Static<typeof ProviderBody>
export type RateInput = Static<typeof RateBody>
export type BannerInput = Static<typeof BannerBody>
export type ContentInput = Static<typeof ContentBody>
export type TemplateInput = Static<typeof TemplateBody>
export type EvidenceInput = Static<typeof EvidenceBody>
export type MatchInput = Static<typeof MatchBody>
