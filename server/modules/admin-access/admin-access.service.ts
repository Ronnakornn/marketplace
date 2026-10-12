import type { AdminTeamMember, Prisma } from '#generated/client/client.ts'
import {
  adminPermissions,
  type AdminActor,
  type AdminAuthorizer,
  type AdminPermission,
} from './admin-access.contract.ts'
import { AdminAccessError } from './admin-access.errors.ts'
import {
  AdminAccessRepository,
  auditAccess,
} from './admin-access.repository.ts'
import { normalizeCidr, matchesCidr } from './request-identity.ts'
import type {
  AccessAction,
  RuleWrite,
  TeamWrite,
} from './admin-access.schemas.ts'

export type MemberWithUser = NonNullable<
  Awaited<ReturnType<AdminAccessRepository['member']>>
>

export function requireMember(
  member: MemberWithUser | null,
  actor: AdminActor,
  permission?: AdminPermission,
) {
  if (
    actor.role !== 'ADMIN' ||
    !member ||
    !member.isActive ||
    member.user.role !== 'ADMIN' ||
    member.user.status !== 'ACTIVE' ||
    !member.user.emailVerified
  ) {
    throw new AdminAccessError(
      'Administrator access is unavailable',
      403,
      'ADMIN_ACCESS_DENIED',
    )
  }
  if (permission && !member.isOwner && !member.permissions.includes(permission))
    throw new AdminAccessError(
      'Permission is required',
      403,
      'ADMIN_PERMISSION_DENIED',
    )
  return member
}

function memberAudit(member: AdminTeamMember | null): Prisma.InputJsonValue {
  return member
    ? {
        userId: member.userId,
        label: member.label,
        permissions: member.permissions,
        isOwner: member.isOwner,
        isActive: member.isActive,
        version: member.version,
      }
    : {}
}

export function validateTeamChange(
  actor: MemberWithUser,
  current: AdminTeamMember | null,
  userId: string,
  input: TeamWrite,
  ownerCount: number,
) {
  if (
    input.permissions.some(
      (permission) => !adminPermissions.includes(permission),
    )
  )
    throw new AdminAccessError('Unknown permission', 400, 'UNKNOWN_PERMISSION')
  if (!input.label.trim() || input.label.length > 100)
    throw new AdminAccessError(
      'Team label is required',
      400,
      'INVALID_TEAM_LABEL',
    )
  if ((current?.version ?? 0) !== input.expectedVersion)
    throw new AdminAccessError(
      'Team membership changed. Reload before saving',
      409,
      'STALE_VERSION',
    )
  if (
    actor.userId === userId &&
    ((!current?.isOwner && input.isOwner) ||
      input.permissions.some(
        (permission) =>
          !current?.permissions.includes(permission) && !current?.isOwner,
      ))
  )
    throw new AdminAccessError(
      'You cannot increase your own access',
      403,
      'SELF_ESCALATION',
    )
  if (
    !actor.isOwner &&
    (input.isOwner ||
      current?.isOwner ||
      input.permissions.some(
        (permission) => !actor.permissions.includes(permission),
      ))
  )
    throw new AdminAccessError(
      'Only an owner can assign owner or wider access',
      403,
      'OWNER_REQUIRED',
    )
  if (
    current?.isOwner &&
    current.isActive &&
    (!input.isOwner || !input.isActive) &&
    ownerCount <= 1
  )
    throw new AdminAccessError(
      'At least one active owner is required',
      409,
      'LAST_OWNER',
    )
}

export class AdminAccessService implements AdminAuthorizer {
  constructor(private readonly repository: AdminAccessRepository) {}
  async require(actor: AdminActor, permission: AdminPermission) {
    requireMember(await this.repository.member(actor.id), actor, permission)
  }
  async access(actor: AdminActor) {
    const member = requireMember(await this.repository.member(actor.id), actor)
    return {
      userId: actor.id,
      label: member.label,
      isOwner: member.isOwner,
      version: member.version,
      permissions: member.isOwner
        ? [...adminPermissions]
        : member.permissions.filter((permission) =>
            adminPermissions.some((known) => known === permission),
          ),
      registry: [...adminPermissions],
    }
  }
  async list(actor: AdminActor, page = 1, limit = 20) {
    await this.require(actor, 'team.manage')
    return this.repository.list(page, limit)
  }
  async saveMember(actor: AdminActor, userId: string, input: TeamWrite) {
    return this.repository.locked(async (tx) => {
      const acting = requireMember(
        await tx.adminTeamMember.findUnique({
          where: { userId: actor.id },
          include: { user: true },
        }),
        actor,
        'team.manage',
      )
      const user = await tx.user.findUnique({ where: { id: userId } })
      if (
        !user ||
        user.role !== 'ADMIN' ||
        user.status !== 'ACTIVE' ||
        !user.emailVerified
      )
        throw new AdminAccessError(
          'Member must be an active verified administrator',
          400,
          'INVALID_ADMIN_MEMBER',
        )
      const current = await tx.adminTeamMember.findUnique({
        where: { userId },
      })
      const owners = await tx.adminTeamMember.count({
        where: {
          isOwner: true,
          isActive: true,
          user: { role: 'ADMIN', status: 'ACTIVE', emailVerified: true },
        },
      })
      validateTeamChange(acting, current, userId, input, owners)
      const data = {
        label: input.label.trim(),
        permissions: input.isOwner ? [] : [...new Set(input.permissions)],
        isOwner: input.isOwner,
        isActive: input.isActive,
      }
      const saved = current
        ? await tx.adminTeamMember.update({
            where: { id: current.id, version: input.expectedVersion },
            data: { ...data, version: { increment: 1 } },
          })
        : await tx.adminTeamMember.create({ data: { userId, ...data } })
      await auditAccess(
        tx,
        actor,
        'AdminTeamMember',
        saved.id,
        memberAudit(current),
        memberAudit(saved),
      )
      return saved
    })
  }
  async listRules(actor: AdminActor, page = 1, limit = 20) {
    await this.require(actor, 'security.read')
    return this.repository.rules(page, limit)
  }
  async saveRule(actor: AdminActor, id: string | null, input: RuleWrite) {
    return this.repository.locked(async (tx) => {
      requireMember(
        await tx.adminTeamMember.findUnique({
          where: { userId: actor.id },
          include: { user: true },
        }),
        actor,
        'security.write',
      )
      const current = id
        ? await tx.adminAccessRule.findUnique({ where: { id } })
        : null
      if (id && !current)
        throw new AdminAccessError('Rule was not found', 404, 'RULE_NOT_FOUND')
      if ((current?.version ?? 0) !== input.expectedVersion)
        throw new AdminAccessError(
          'Rule changed. Reload before saving',
          409,
          'STALE_VERSION',
        )
      const subjectValue =
        input.subjectType === 'IP_CIDR'
          ? normalizeCidr(input.subjectValue)
          : input.subjectValue.trim().toLowerCase()
      if (
        input.subjectType === 'DEVICE' &&
        !/^[a-f0-9]{64}$/.test(subjectValue)
      )
        throw new AdminAccessError(
          'Device identity must be a signed device hash',
          400,
          'INVALID_DEVICE_IDENTITY',
        )
      if (
        input.subjectType === 'ACCOUNT' &&
        !(await tx.user.findUnique({ where: { id: subjectValue } }))
      )
        throw new AdminAccessError(
          'Account was not found',
          400,
          'INVALID_ACCOUNT',
        )
      const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null
      if (
        expiresAt &&
        (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date())
      )
        throw new AdminAccessError(
          'Expiry must be in the future',
          400,
          'INVALID_EXPIRY',
        )
      const data = {
        subjectType: input.subjectType,
        subjectValue,
        effect: input.effect,
        actions: input.actions,
        priority: input.priority,
        reason: input.reason,
        expiresAt,
        isActive: input.isActive,
      }
      const saved = current
        ? await tx.adminAccessRule.update({
            where: { id: current.id, version: input.expectedVersion },
            data: { ...data, version: { increment: 1 } },
          })
        : await tx.adminAccessRule.create({
            data: { ...data, createdById: actor.id },
          })
      await auditAccess(
        tx,
        actor,
        'AdminAccessRule',
        saved.id,
        current
          ? {
              ...current,
              createdAt: current.createdAt.toISOString(),
              updatedAt: current.updatedAt.toISOString(),
              expiresAt: current.expiresAt?.toISOString() ?? null,
            }
          : {},
        {
          ...saved,
          createdAt: saved.createdAt.toISOString(),
          updatedAt: saved.updatedAt.toISOString(),
          expiresAt: saved.expiresAt?.toISOString() ?? null,
        },
      )
      return saved
    })
  }
  async evaluate(identity: {
    userId?: string
    ip?: string
    deviceHash?: string
    action: AccessAction
  }) {
    const rules = await this.repository.activeRules(new Date())
    if (rules.length > 1000)
      throw new AdminAccessError(
        'Access rule limit exceeded',
        503,
        'ACCESS_POLICY_UNAVAILABLE',
      )
    const matching = rules
      .filter(
        (rule) =>
          (rule.actions.includes('ALL') ||
            rule.actions.includes(identity.action)) &&
          (rule.subjectType === 'ACCOUNT'
            ? rule.subjectValue === identity.userId
            : rule.subjectType === 'DEVICE'
              ? rule.subjectValue === identity.deviceHash
              : rule.subjectType === 'IP_CIDR'
                ? Boolean(
                    identity.ip && matchesCidr(identity.ip, rule.subjectValue),
                  )
                : false),
      )
      .sort(
        (a, b) =>
          b.priority - a.priority ||
          Number(b.effect === 'DENY') - Number(a.effect === 'DENY') ||
          a.id.localeCompare(b.id),
      )
    const decision = matching[0]
    if (decision && decision.effect !== 'ALLOW')
      throw new AdminAccessError(
        'Request denied by access policy',
        403,
        'ACCESS_RULE_DENIED',
      )
  }
}
