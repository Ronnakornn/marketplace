import {
  parseTemplateVariables,
  type NotificationTemplateVariable,
} from '#server/modules/notification/notification-template.ts'
import { Value } from '@sinclair/typebox/value'
import { t } from 'elysia'
import type { FeatureToggle, Prisma } from '#generated/client/client.ts'
import type {
  AdminActor,
  AdminAuthorizer,
} from '#server/modules/admin-access/admin-access.contract.ts'
import { AdminAccessError } from '#server/modules/admin-access/admin-access.errors.ts'
import { auditAccess } from '#server/modules/admin-access/admin-access.repository.ts'
import {
  SettingWriteSchema,
  TemplateWriteSchema,
  featureKeys,
  type FeatureKey,
  type SettingWrite,
  type TemplateWrite,
  type ToggleWrite,
} from './admin-config.schemas.ts'
import { AdminConfigRepository } from './admin-config.repository.ts'

const defaults = {
  'catalog.approvalRequired': false,
  'payment.channels': { card: true, promptpay: true, bankTransfer: false },
  'notifications.delivery': {
    inApp: true,
    email: true,
    push: true,
    sms: false,
  },
  'platform.defaults': { locale: 'th', currency: 'THB' },
} satisfies Record<SettingWrite['key'], Prisma.InputJsonValue>

export function validateManagedSetting(
  key: string,
  value: unknown,
  valueType?: string,
) {
  if (!(key in defaults)) return false
  if (
    !Value.Check(SettingWriteSchema, { key, value, expectedVersion: null }) ||
    (valueType &&
      valueType !== 'JSON' &&
      !(key === 'catalog.approvalRequired' && valueType === 'BOOLEAN'))
  )
    throw new AdminAccessError(
      'Unsupported managed configuration',
      400,
      'INVALID_CONFIG',
    )
  return true
}

function checkVersion(
  current: { updatedAt: Date } | null,
  expectedVersion: string | null,
) {
  if ((current?.updatedAt.toISOString() ?? null) !== expectedVersion)
    throw new AdminAccessError(
      'Configuration changed. Reload before saving',
      409,
      'STALE_VERSION',
    )
}

export function evaluateFeature(
  toggles: FeatureToggle[],
  key: FeatureKey,
  context: { userId?: string; shopIds?: string[] } = {},
) {
  const applicable = toggles.filter(
    (toggle) =>
      toggle.key === key &&
      (toggle.scope === 'GLOBAL' ||
        (toggle.scope === 'USER' && toggle.scopeId === context.userId) ||
        (toggle.scope === 'SHOP' &&
          context.shopIds?.includes(toggle.scopeId ?? ''))),
  )
  if (key === 'maintenance_mode')
    return applicable.some((toggle) => toggle.isEnabled)
  const global = applicable.filter((toggle) => toggle.scope === 'GLOBAL')
  if (global.length > 1)
    throw new AdminAccessError(
      'Configuration contains duplicate global switches',
      503,
      'CONFIG_UNAVAILABLE',
    )
  const user = applicable.filter((toggle) => toggle.scope === 'USER')
  if (user.length > 1)
    throw new AdminAccessError(
      'Configuration contains duplicate user switches',
      503,
      'CONFIG_UNAVAILABLE',
    )
  if (user[0]) return user[0].isEnabled
  const shops = context.shopIds ?? []
  return shops.length
    ? shops.every(
        (shopId) =>
          applicable.find(
            (toggle) => toggle.scope === 'SHOP' && toggle.scopeId === shopId,
          )?.isEnabled ??
          global[0]?.isEnabled ??
          true,
      )
    : (global[0]?.isEnabled ?? true)
}

export class AdminConfigService {
  constructor(
    private readonly repository: AdminConfigRepository,
    private readonly access: AdminAuthorizer,
  ) {}
  async requestShopIds(path: string, body: unknown) {
    const uuid = '[a-fA-F0-9-]{36}'
    const shopId = path.match(
      new RegExp(`^/api/(?:seller/)?shops/(${uuid})(?:/|$)`),
    )?.[1]
    const productId = path.match(
      new RegExp(`^/api/products/(${uuid})(?:/|$)`),
    )?.[1]
    const threadId = path.match(new RegExp(`^/api/chats/(${uuid})(?:/|$)`))?.[1]
    const reviewId = path.match(
      new RegExp(`^/api/reviews/(${uuid})(?:/|$)`),
    )?.[1]
    const shopRatingId = path.match(
      new RegExp(`^/api/shop-reviews/(${uuid})(?:/|$)`),
    )?.[1]
    const fields = t.Object(
      {
        productId: t.Optional(t.String({ pattern: `^${uuid}$` })),
        orderItemId: t.Optional(t.String({ pattern: `^${uuid}$` })),
        shopOrderId: t.Optional(t.String({ pattern: `^${uuid}$` })),
        shopRatingId: t.Optional(t.String({ pattern: `^${uuid}$` })),
        reviewId: t.Optional(t.String({ pattern: `^${uuid}$` })),
        shopId: t.Optional(t.String({ pattern: `^${uuid}$` })),
      },
      { additionalProperties: true },
    )
    const values = Value.Check(fields, body) ? body : {}
    const resolved = await this.repository.resourceShop({
      productId:
        productId ?? ('productId' in values ? values.productId : undefined),
      threadId,
      reviewId:
        reviewId ??
        (path === '/api/review-reports' && 'reviewId' in values
          ? values.reviewId
          : undefined),
      shopRatingId:
        shopRatingId ??
        (path === '/api/review-reports' && 'shopRatingId' in values
          ? values.shopRatingId
          : undefined),
      shopOrderId:
        path === '/api/shop-reviews' && 'shopOrderId' in values
          ? values.shopOrderId
          : undefined,
      orderItemId: 'orderItemId' in values ? values.orderItemId : undefined,
      shopId:
        shopId ??
        (path === '/api/chats' && 'shopId' in values
          ? values.shopId
          : undefined),
    })
    return resolved ? [resolved] : []
  }
  async listToggles(actor: AdminActor) {
    await this.access.require(actor, 'settings.read')
    const items = await this.repository.toggles()
    return {
      items: items.filter((item) =>
        featureKeys.some((key) => key === item.key),
      ),
      keys: [...featureKeys],
    }
  }
  async saveToggle(actor: AdminActor, key: FeatureKey, input: ToggleWrite) {
    await this.access.require(actor, 'settings.write')
    if (
      input.scope === 'GLOBAL' ? input.scopeId !== null : input.scopeId === null
    )
      throw new AdminAccessError(
        'Scope identity is invalid',
        400,
        'INVALID_TOGGLE_SCOPE',
      )
    return this.repository.transaction(async (tx) => {
      await this.access.require(actor, 'settings.write')
      if (
        input.scope === 'SHOP' &&
        !(await tx.shop.findUnique({ where: { id: input.scopeId ?? '' } }))
      )
        throw new AdminAccessError('Shop was not found', 404, 'SCOPE_NOT_FOUND')
      if (
        input.scope === 'USER' &&
        !(await tx.user.findUnique({ where: { id: input.scopeId ?? '' } }))
      )
        throw new AdminAccessError('User was not found', 404, 'SCOPE_NOT_FOUND')
      const current = await tx.featureToggle.findFirst({
        where: { key, scope: input.scope, scopeId: input.scopeId },
      })
      checkVersion(current, input.expectedVersion)
      const data = {
        key,
        scope: input.scope,
        scopeId: input.scopeId,
        isEnabled: input.isEnabled,
      }
      const saved = current
        ? await tx.featureToggle.update({
            where: { id: current.id, updatedAt: current.updatedAt },
            data,
          })
        : await tx.featureToggle.create({ data })
      await auditAccess(
        tx,
        actor,
        'FeatureToggle',
        saved.id,
        current
          ? {
              key: current.key,
              scope: current.scope,
              scopeId: current.scopeId,
              isEnabled: current.isEnabled,
              version: current.updatedAt.toISOString(),
            }
          : {},
        { ...data, version: saved.updatedAt.toISOString() },
      )
      return saved
    })
  }
  private async typedSettings() {
    const rows = await this.repository.settings()
    return Object.entries(defaults).map(([key, fallback]) => {
      const row = rows.find((row) => row.key === key)
      const parsed = {
        key,
        value: row?.value ?? fallback,
        expectedVersion: row?.updatedAt.toISOString() ?? null,
      }
      if (!Value.Check(SettingWriteSchema, parsed))
        throw new AdminAccessError(
          'Configuration could not be validated',
          503,
          'CONFIG_UNAVAILABLE',
        )
      return parsed
    })
  }
  async listSettings(actor: AdminActor) {
    await this.access.require(actor, 'settings.read')
    return this.typedSettings()
  }
  async saveSetting(actor: AdminActor, input: SettingWrite) {
    await this.access.require(actor, 'settings.write')
    if (!Value.Check(SettingWriteSchema, input))
      throw new AdminAccessError(
        'Unsupported configuration',
        400,
        'INVALID_CONFIG',
      )
    return this.repository.transaction(async (tx) => {
      await this.access.require(actor, 'settings.write')
      const current = await tx.systemSetting.findUnique({
        where: { key: input.key },
      })
      checkVersion(current, input.expectedVersion)
      const data = {
        key: input.key,
        value: input.value,
        valueType: 'JSON' as const,
        isPublic: false,
        updatedById: actor.id,
      }
      const saved = current
        ? await tx.systemSetting.update({
            where: { id: current.id, updatedAt: current.updatedAt },
            data,
          })
        : await tx.systemSetting.create({ data })
      await auditAccess(
        tx,
        actor,
        'SystemSetting',
        saved.id,
        current
          ? {
              key: current.key,
              value: current.value,
              version: current.updatedAt.toISOString(),
            }
          : {},
        {
          key: saved.key,
          value: saved.value,
          version: saved.updatedAt.toISOString(),
        },
      )
      return {
        key: saved.key,
        value: input.value,
        expectedVersion: saved.updatedAt.toISOString(),
      }
    })
  }
  async publicationApprovalRequired() {
    return (
      (await this.typedSettings()).find(
        (setting) => setting.key === 'catalog.approvalRequired',
      )?.value === true
    )
  }
  async requirePaymentChannel(channel: 'card' | 'promptpay' | 'bankTransfer') {
    const setting = (await this.typedSettings()).find(
      (setting) => setting.key === 'payment.channels',
    )
    if (
      !setting ||
      setting.key !== 'payment.channels' ||
      !setting.value[channel]
    )
      throw new AdminAccessError(
        'Payment channel is disabled',
        503,
        'PAYMENT_CHANNEL_DISABLED',
      )
  }
  async deliveryConfig() {
    const setting = (await this.typedSettings()).find(
      (setting) => setting.key === 'notifications.delivery',
    )
    if (!setting || setting.key !== 'notifications.delivery')
      throw new AdminAccessError(
        'Delivery configuration is unavailable',
        503,
        'CONFIG_UNAVAILABLE',
      )
    return setting.value
  }
  async renderNotification(input: {
    key: string
    channel: 'EMAIL' | 'PUSH' | 'IN_APP'
    locale?: 'th' | 'en'
    values: Partial<Record<NotificationTemplateVariable, string>>
  }) {
    const settings = await this.typedSettings()
    const defaults = settings.find(
      (setting) => setting.key === 'platform.defaults',
    )
    const locale =
      input.locale ??
      (defaults?.key === 'platform.defaults' ? defaults.value.locale : 'th')
    const template = await this.repository.template(
      input.key,
      input.channel,
      locale,
    )
    if (!template?.isActive) return null
    const render = (value: string) =>
      value.replace(/{{\s*([\w.]+)\s*}}/g, (_match, key: string) => {
        const variable = Object.entries(input.values).find(
          ([name]) => name === key,
        )?.[1]
        if (variable === undefined)
          throw new AdminAccessError(
            'Template variable is missing',
            503,
            'TEMPLATE_DATA_MISSING',
          )
        return variable
      })
    return {
      subject: template.subject ? render(template.subject) : null,
      body: render(template.body),
    }
  }
  async requireFeature(
    key: FeatureKey,
    context: { userId?: string; shopIds?: string[] } = {},
  ) {
    const toggles = await this.repository.toggles()
    if (toggles.length > 1000)
      throw new AdminAccessError(
        'Configuration switch limit exceeded',
        503,
        'CONFIG_UNAVAILABLE',
      )
    if (
      evaluateFeature(toggles, 'maintenance_mode', context) ||
      !evaluateFeature(toggles, key, context)
    )
      throw new AdminAccessError(
        'This operation is temporarily unavailable',
        503,
        'FEATURE_DISABLED',
      )
  }
  async requireAdmission(
    context: { userId?: string; shopIds?: string[] } = {},
  ) {
    const toggles = await this.repository.toggles()
    if (toggles.length > 1000)
      throw new AdminAccessError(
        'Configuration switch limit exceeded',
        503,
        'CONFIG_UNAVAILABLE',
      )
    if (evaluateFeature(toggles, 'maintenance_mode', context))
      throw new AdminAccessError(
        'Marketplace maintenance is active',
        503,
        'MAINTENANCE_MODE',
      )
  }
  async listTemplates(actor: AdminActor, page = 1, limit = 20) {
    await this.access.require(actor, 'settings.read')
    return this.repository.templates(page, limit)
  }
  async saveTemplate(
    actor: AdminActor,
    id: string | null,
    input: TemplateWrite,
  ) {
    await this.access.require(actor, 'settings.write')
    if (!Value.Check(TemplateWriteSchema, input))
      throw new AdminAccessError('Template is invalid', 400, 'INVALID_TEMPLATE')
    let variables: string[]
    try {
      variables = parseTemplateVariables(`${input.subject ?? ''} ${input.body}`)
    } catch (error) {
      throw new AdminAccessError(
        error instanceof Error ? error.message : 'Invalid template',
        400,
        'INVALID_TEMPLATE_VARIABLE',
      )
    }
    return this.repository.transaction(async (tx) => {
      await this.access.require(actor, 'settings.write')
      const current = id
        ? await tx.notificationTemplate.findUnique({ where: { id } })
        : await tx.notificationTemplate.findUnique({
            where: {
              key_channel_locale: {
                key: input.key,
                channel: input.channel,
                locale: input.locale,
              },
            },
          })
      if (id && !current)
        throw new AdminAccessError(
          'Template was not found',
          404,
          'TEMPLATE_NOT_FOUND',
        )
      checkVersion(current, input.expectedVersion)
      const data = {
        key: input.key,
        channel: input.channel,
        locale: input.locale,
        subject: input.subject,
        body: input.body,
        isActive: input.isActive,
        variables: [...new Set(variables)],
      }
      const saved = current
        ? await tx.notificationTemplate.update({
            where: { id: current.id, updatedAt: current.updatedAt },
            data,
          })
        : await tx.notificationTemplate.create({ data })
      await auditAccess(
        tx,
        actor,
        'NotificationTemplate',
        saved.id,
        current
          ? {
              key: current.key,
              channel: current.channel,
              locale: current.locale,
              body: current.body,
              subject: current.subject,
              isActive: current.isActive,
            }
          : {},
        data,
      )
      return saved
    })
  }
}
