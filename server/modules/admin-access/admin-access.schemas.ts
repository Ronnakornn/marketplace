import { t, type Static } from 'elysia'
import { AdminTeamMember } from '#generated/prismabox/AdminTeamMember.ts'
import { AdminAccessRule } from '#generated/prismabox/AdminAccessRule.ts'
import { adminPermissions } from './admin-access.contract.ts'

export const PermissionSchema = t.Union([
  t.Literal('dashboard.read'),
  t.Literal('users.read'),
  t.Literal('users.write'),
  t.Literal('shops.read'),
  t.Literal('shops.write'),
  t.Literal('catalog.read'),
  t.Literal('catalog.write'),
  t.Literal('orders.read'),
  t.Literal('orders.write'),
  t.Literal('finance.read'),
  t.Literal('finance.reconcile'),
  t.Literal('refunds.process'),
  t.Literal('refunds.complete'),
  t.Literal('payouts.approve'),
  t.Literal('payouts.complete'),
  t.Literal('marketing.read'),
  t.Literal('marketing.write'),
  t.Literal('content.read'),
  t.Literal('content.write'),
  t.Literal('support.read'),
  t.Literal('support.write'),
  t.Literal('reports.read'),
  t.Literal('reports.export'),
  t.Literal('settings.read'),
  t.Literal('settings.write'),
  t.Literal('security.read'),
  t.Literal('security.write'),
  t.Literal('team.manage'),
])
export const TeamWriteSchema = t.Composite([
  t.Pick(AdminTeamMember, ['label', 'isOwner', 'isActive']),
  t.Object({
    permissions: t.Array(PermissionSchema, {
      maxItems: adminPermissions.length,
      uniqueItems: true,
    }),
    expectedVersion: t.Integer({ minimum: 0 }),
  }),
])
export const RuleWriteSchema = t.Composite([
  t.Pick(AdminAccessRule, ['isActive']),
  t.Object({
    subjectType: t.Union([
      t.Literal('ACCOUNT'),
      t.Literal('IP_CIDR'),
      t.Literal('DEVICE'),
    ]),
    subjectValue: t.String({ minLength: 1, maxLength: 128 }),
    effect: t.Union([t.Literal('ALLOW'), t.Literal('DENY')]),
    actions: t.Array(
      t.Union([
        t.Literal('ALL'),
        t.Literal('ADMIN'),
        t.Literal('CHECKOUT'),
        t.Literal('CHAT'),
        t.Literal('REVIEW'),
        t.Literal('PROMOTION'),
      ]),
      { minItems: 1, maxItems: 6, uniqueItems: true },
    ),
    priority: t.Integer({ minimum: 0, maximum: 1000 }),
    reason: t.String({ minLength: 3, maxLength: 500 }),
    expiresAt: t.Optional(t.Nullable(t.String({ format: 'date-time' }))),
    expectedVersion: t.Integer({ minimum: 0 }),
  }),
])
export type TeamWrite = Static<typeof TeamWriteSchema>
export type RuleWrite = Static<typeof RuleWriteSchema>
export type AccessAction = RuleWrite['actions'][number]
