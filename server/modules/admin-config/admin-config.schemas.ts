import { t, type Static } from 'elysia'
import { FeatureToggle } from '#generated/prismabox/FeatureToggle.ts'
import { NotificationTemplate } from '#generated/prismabox/NotificationTemplate.ts'

export const featureKeys = [
  'maintenance_mode',
  'checkout',
  'chat',
  'reviews',
  'promotions',
] as const
export const FeatureKeySchema = t.Union(
  featureKeys.map((key) => t.Literal(key)),
)
export type FeatureKey = (typeof featureKeys)[number]
export const ToggleWriteSchema = t.Composite([
  t.Pick(FeatureToggle, ['scope', 'isEnabled']),
  t.Object({
    scopeId: t.Nullable(t.String({ format: 'uuid' })),
    expectedVersion: t.Nullable(t.String({ format: 'date-time' })),
  }),
])
export type ToggleWrite = Static<typeof ToggleWriteSchema>
const DeliverySchema = t.Object(
  {
    inApp: t.Boolean(),
    email: t.Boolean(),
    push: t.Boolean(),
    sms: t.Literal(false),
  },
  { additionalProperties: false },
)
const ChannelsSchema = t.Object(
  { card: t.Boolean(), promptpay: t.Boolean(), bankTransfer: t.Literal(false) },
  { additionalProperties: false },
)
const DefaultsSchema = t.Object(
  {
    locale: t.Union([t.Literal('th'), t.Literal('en')]),
    currency: t.Literal('THB'),
  },
  { additionalProperties: false },
)
export const SettingWriteSchema = t.Union([
  t.Object(
    {
      key: t.Literal('catalog.approvalRequired'),
      value: t.Boolean(),
      expectedVersion: t.Nullable(t.String({ format: 'date-time' })),
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      key: t.Literal('payment.channels'),
      value: ChannelsSchema,
      expectedVersion: t.Nullable(t.String({ format: 'date-time' })),
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      key: t.Literal('notifications.delivery'),
      value: DeliverySchema,
      expectedVersion: t.Nullable(t.String({ format: 'date-time' })),
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      key: t.Literal('platform.defaults'),
      value: DefaultsSchema,
      expectedVersion: t.Nullable(t.String({ format: 'date-time' })),
    },
    { additionalProperties: false },
  ),
])
export type SettingWrite = Static<typeof SettingWriteSchema>
export const TemplateWriteSchema = t.Composite([
  t.Pick(NotificationTemplate, ['channel', 'isActive']),
  t.Object({
    key: t.String({
      minLength: 2,
      maxLength: 100,
      pattern: '^[a-zA-Z0-9_.-]+$',
    }),
    locale: t.Union([t.Literal('th'), t.Literal('en')]),
    subject: t.Nullable(t.String({ maxLength: 200 })),
    body: t.String({ minLength: 1, maxLength: 10000 }),
    expectedVersion: t.Nullable(t.String({ format: 'date-time' })),
  }),
])
export type TemplateWrite = Static<typeof TemplateWriteSchema>
