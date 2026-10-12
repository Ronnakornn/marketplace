import { Elysia } from 'elysia'
import { Value } from '@sinclair/typebox/value'
import { readdirSync, readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '#server/lib/prisma.ts'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { AdminAccessRepository } from './admin-access.repository.ts'
import {
  AdminAccessService,
  requireMember,
  validateTeamChange,
  type MemberWithUser,
} from './admin-access.service.ts'
import { resolveAdminRoutePermission } from './admin-route-permissions.ts'
import { fullAdminRoutePermissions } from './full-admin-route-permissions.ts'
import { adminOperationsPermissions } from '#server/modules/admin-operations/operations.routes.ts'
import { createAdminAccessGuard } from './admin-access.guard.ts'
import {
  matchesCidr,
  normalizeCidr,
  signedDeviceIdentity,
  trustedRequestIp,
} from './request-identity.ts'
import { PermissionSchema, type TeamWrite } from './admin-access.schemas.ts'
import { adminPermissions } from './admin-access.contract.ts'

vi.mock('#server/modules/auth/auth.context.ts', () => ({
  getAuthContext: vi.fn(),
}))

const member: MemberWithUser = {
  id: 'membership',
  userId: 'admin',
  label: 'Owner',
  permissions: [],
  isOwner: true,
  isActive: true,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: {
    id: 'admin',
    name: 'Admin',
    email: 'admin@example.test',
    role: 'ADMIN',
    status: 'ACTIVE',
    emailVerified: true,
  },
}
const actor = { id: 'admin', role: 'ADMIN' } as const
const input: TeamWrite = {
  label: 'Owner',
  permissions: [],
  isOwner: true,
  isActive: true,
  expectedVersion: 1,
}
const repository = new AdminAccessRepository(prisma)
const service = new AdminAccessService(repository)

beforeEach(() => {
  vi.restoreAllMocks()
  vi.mocked(getAuthContext).mockResolvedValue({
    user: member.user,
    session: { id: 'session' },
  })
  vi.spyOn(repository, 'member').mockResolvedValue(member)
  vi.spyOn(repository, 'activeRules').mockResolvedValue([])
})

describe('administrative permissions', () => {
  it('accepts the complete closed permission registry and rejects invented grants', () => {
    for (const permission of adminPermissions)
      expect(Value.Check(PermissionSchema, permission)).toBe(true)
    expect(Value.Check(PermissionSchema, 'everything')).toBe(false)
    expect(PermissionSchema.anyOf).toHaveLength(adminPermissions.length)
  })
  it('denies absent, inactive, suspended, unverified and nonadmin membership', () => {
    for (const candidate of [
      null,
      { ...member, isActive: false },
      { ...member, user: { ...member.user, status: 'SUSPENDED' as const } },
      { ...member, user: { ...member.user, emailVerified: false } },
      { ...member, user: { ...member.user, role: 'USER' as const } },
    ])
      expect(() => requireMember(candidate, actor)).toThrow(
        'Administrator access',
      )
  })
  it('requires a grant for each operation and reloads revoked membership', async () => {
    vi.mocked(repository.member)
      .mockResolvedValueOnce({
        ...member,
        isOwner: false,
        permissions: ['orders.read'],
      })
      .mockResolvedValueOnce({ ...member, isActive: false })
    await service.require(actor, 'orders.read')
    await expect(service.require(actor, 'orders.read')).rejects.toMatchObject({
      code: 'ADMIN_ACCESS_DENIED',
    })
    expect(() =>
      requireMember(
        { ...member, isOwner: false, permissions: ['orders.read'] },
        actor,
        'payouts.complete',
      ),
    ).toThrow('Permission is required')
  })
  it('protects the final active owner and stale membership version', () => {
    expect(() =>
      validateTeamChange(
        member,
        member,
        member.userId,
        { ...input, isActive: false },
        1,
      ),
    ).toThrow('At least one active owner')
    expect(() =>
      validateTeamChange(
        member,
        member,
        member.userId,
        { ...input, expectedVersion: 0 },
        2,
      ),
    ).toThrow('Reload')
    expect(() =>
      validateTeamChange(
        member,
        member,
        member.userId,
        { ...input, isActive: false },
        2,
      ),
    ).not.toThrow()
  })
  it('rejects self escalation and granting beyond the actor permissions', () => {
    const limited = { ...member, isOwner: false, permissions: ['team.manage'] }
    expect(() =>
      validateTeamChange(
        limited,
        limited,
        limited.userId,
        {
          ...input,
          isOwner: false,
          permissions: ['team.manage', 'payouts.complete'],
        },
        2,
      ),
    ).toThrow('own access')
    expect(() =>
      validateTeamChange(
        limited,
        null,
        'another-admin',
        { ...input, expectedVersion: 0 },
        2,
      ),
    ).toThrow('Only an owner')
  })
  it('maps all current administrative endpoints including aliases and rejects unknown methods', () => {
    const legacyModules = [
      'admin',
      'admin-access',
      'admin-config',
      'admin-directory',
      'admin-reporting',
      'catalog-import',
      'admin-operations',
      'affiliate',
      'audit-log',
      'catalog',
      'checkout',
      'content-moderation',
      'fraud',
      'payout',
      'promotion',
      'refund',
      'seller-onboarding',
      'shipment',
      'shop-review',
      'support',
      'user',
    ]
    for (const file of readdirSync('server/modules', {
      recursive: true,
    }).filter(
      (file) =>
        typeof file === 'string' &&
        file.endsWith('.routes.ts') &&
        legacyModules.includes(file.split(/[\\/]/)[0] ?? ''),
    )) {
      const source = readFileSync(`server/modules/${file}`, 'utf8')
      for (const match of source.matchAll(
        /\.(get|post|patch|put|delete)\(\s*['"]([^'"]+)['"]/g,
      )) {
        const [, method, path] = match
        if (
          path &&
          method &&
          (path.startsWith('/api/admin/') || /^\/api\/users(?:\/|$)/.test(path))
        )
          expect(
            resolveAdminRoutePermission(method.toUpperCase(), path, [
              ...fullAdminRoutePermissions,
              ...adminOperationsPermissions,
            ]),
            `${method} ${path}`,
          ).toBeDefined()
      }
    }
    expect(
      resolveAdminRoutePermission('GET', '/api/admin/unmapped'),
    ).toBeUndefined()
    expect(
      resolveAdminRoutePermission('DELETE', '/api/admin/dashboard'),
    ).toBeUndefined()
    expect(resolveAdminRoutePermission('GET', '/api/users')).toBe('users.read')
  })
  it('consumes the global guard before legacy handlers', async () => {
    vi.mocked(repository.member).mockResolvedValue({
      ...member,
      isOwner: false,
      permissions: [],
    })
    const legacy = vi.fn(() => ({ ok: true }))
    const app = new Elysia()
      .use(createAdminAccessGuard(service))
      .get('/api/admin/orders', legacy)
      .get('/api/admin/unknown', legacy)
      .get('/api/users', legacy)
    for (const path of [
      '/api/admin/orders',
      '/api/admin/unknown',
      '/api/users',
    ])
      expect(
        (await app.handle(new Request(`http://localhost${path}`))).status,
      ).toBe(403)
    expect(legacy).not.toHaveBeenCalled()
  })
  it('evaluates account rules with priority and deny winning tied priority', async () => {
    const rule = {
      id: 'rule',
      subjectType: 'ACCOUNT',
      subjectValue: 'admin',
      effect: 'DENY',
      actions: ['ADMIN'],
      priority: 10,
      reason: 'Blocked account',
      expiresAt: null,
      isActive: true,
      createdById: 'admin',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    vi.mocked(repository.activeRules).mockResolvedValue([rule])
    await expect(
      service.evaluate({ action: 'ADMIN', userId: 'admin' }),
    ).rejects.toMatchObject({ code: 'ACCESS_RULE_DENIED' })
    await expect(
      service.evaluate({ action: 'CHAT', userId: 'admin' }),
    ).resolves.toBeUndefined()
    vi.mocked(repository.activeRules).mockResolvedValue([
      rule,
      { ...rule, id: 'allow', effect: 'ALLOW', priority: 11 },
    ])
    await expect(
      service.evaluate({ action: 'ADMIN', userId: 'admin' }),
    ).resolves.toBeUndefined()
    vi.mocked(repository.activeRules).mockResolvedValue([
      rule,
      { ...rule, id: 'allow', effect: 'ALLOW' },
    ])
    await expect(
      service.evaluate({ action: 'ADMIN', userId: 'admin' }),
    ).rejects.toMatchObject({ code: 'ACCESS_RULE_DENIED' })
  })
})

describe('trusted request identities', () => {
  it('normalizes IPv4 and IPv6 CIDRs and excludes other networks', () => {
    expect(normalizeCidr('192.0.2.99/24')).toBe('192.0.2.0/24')
    expect(matchesCidr('192.0.2.8', '192.0.2.0/24')).toBe(true)
    expect(matchesCidr('192.0.3.8', '192.0.2.0/24')).toBe(false)
    expect(matchesCidr('2001:db8::5', '2001:db8::/32')).toBe(true)
    expect(matchesCidr('2001:db9::5', '2001:db8::/32')).toBe(false)
  })
  it('ignores spoofed forwarded addresses and strips only trusted proxy hops', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 203.0.113.8, 10.0.0.2' },
    })
    expect(trustedRequestIp(request, '203.0.113.9', ['10.0.0.0/8'])).toBe(
      '203.0.113.9',
    )
    expect(trustedRequestIp(request, '10.0.0.1', ['10.0.0.0/8'])).toBe(
      '203.0.113.8',
    )
    expect(trustedRequestIp(request, undefined, ['10.0.0.0/8'])).toBeUndefined()
  })
  it('accepts only server signed device cookies and detects tampering', () => {
    const secret = 'a'.repeat(32)
    const identity = signedDeviceIdentity(
      new Request('https://localhost', {
        headers: { 'x-device-id': 'spoofed' },
      }),
      secret,
    )
    expect(identity.deviceHash).toBeUndefined()
    expect(identity.setCookie).toContain('HttpOnly')
    const cookie = identity.setCookie?.split(';')[0] ?? ''
    expect(
      signedDeviceIdentity(
        new Request('https://localhost', { headers: { cookie } }),
        secret,
      ).deviceHash,
    ).toMatch(/^[a-f0-9]{64}$/)
    expect(
      signedDeviceIdentity(
        new Request('https://localhost', { headers: { cookie: `${cookie}f` } }),
        secret,
      ).deviceHash,
    ).toBeUndefined()
  })
})
