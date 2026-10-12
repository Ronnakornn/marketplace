import { Elysia } from 'elysia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FeatureToggle } from '#generated/client/client.ts'
import { prisma } from '#server/lib/prisma.ts'
import { createAdminConfigGuard, isConfigExempt } from './admin-config.guard.ts'
import { AdminConfigRepository } from './admin-config.repository.ts'
import {
  AdminConfigService,
  evaluateFeature,
  validateManagedSetting,
} from './admin-config.service.ts'

vi.mock('#server/modules/auth/auth.context.ts', () => ({
  getAuthContext: vi.fn(async () => null),
}))

const toggle: FeatureToggle = {
  id: 'toggle',
  key: 'checkout',
  scope: 'GLOBAL',
  scopeId: null,
  isEnabled: false,
  config: null,
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}
afterEach(() => vi.restoreAllMocks())

describe('platform configuration admission', () => {
  it('defaults new marketplace features to enabled and maintenance to disabled', () => {
    expect(evaluateFeature([], 'checkout')).toBe(true)
    expect(evaluateFeature([], 'maintenance_mode')).toBe(false)
  })
  it('resolves user, shop and global switches, requiring every checkout shop', () => {
    const rows = [
      toggle,
      {
        ...toggle,
        id: 'shop',
        scope: 'SHOP' as const,
        scopeId: 'shop',
        isEnabled: true,
      },
    ]
    expect(evaluateFeature(rows, 'checkout', { shopIds: ['shop'] })).toBe(true)
    expect(
      evaluateFeature(rows, 'checkout', { shopIds: ['shop', 'other'] }),
    ).toBe(false)
    expect(
      evaluateFeature(
        [
          ...rows,
          {
            ...toggle,
            id: 'user',
            scope: 'USER',
            scopeId: 'user',
            isEnabled: true,
          },
        ],
        'checkout',
        { userId: 'user', shopIds: ['other'] },
      ),
    ).toBe(true)
  })
  it('does not let scoped maintenance false bypass global maintenance', () => {
    expect(
      evaluateFeature(
        [
          { ...toggle, key: 'maintenance_mode', isEnabled: true },
          {
            ...toggle,
            id: 'user',
            key: 'maintenance_mode',
            scope: 'USER',
            scopeId: 'user',
          },
        ],
        'maintenance_mode',
        { userId: 'user' },
      ),
    ).toBe(true)
    expect(() => evaluateFeature([toggle, toggle], 'checkout')).toThrow(
      'duplicate global',
    )
  })
  it('exempts health, auth, admin, verified webhook entrypoints and settlement', () => {
    for (const path of [
      '/api/health',
      '/api/health/live',
      '/api/health/ready',
      '/api/auth/sign-in/email',
      '/api/admin/config/toggles',
      '/api/users',
      '/api/orders/order/cancel',
      '/api/seller/payouts',
    ])
      expect(isConfigExempt(path, 'POST')).toBe(true)
    expect(isConfigExempt('/api/payment/webhook', 'POST')).toBe(true)
    expect(isConfigExempt('/api/payments/webhook', 'POST')).toBe(true)
    expect(isConfigExempt('/api/payment/webhook', 'GET')).toBe(false)
    expect(isConfigExempt('/api/checkout', 'POST')).toBe(false)
  })
  it('consumes disabled switches before request handlers and keeps webhook reachable', async () => {
    const repo = new AdminConfigRepository(prisma)
    vi.spyOn(repo, 'toggles').mockResolvedValue([toggle])
    const service = new AdminConfigService(repo, {
      require: async () => undefined,
    })
    const handler = vi.fn(() => ({ ok: true }))
    const app = new Elysia()
      .use(createAdminConfigGuard(service))
      .post('/api/checkout', handler)
      .post('/api/payment/webhook', handler)
    expect(
      (
        await app.handle(
          new Request('http://localhost/api/checkout', { method: 'POST' }),
        )
      ).status,
    ).toBe(503)
    expect(
      (
        await app.handle(
          new Request('http://localhost/api/payment/webhook', {
            method: 'POST',
          }),
        )
      ).status,
    ).toBe(200)
    expect(handler).toHaveBeenCalledTimes(1)
  })
  it('validates the reserved setting contract and rejects arbitrary secret fields', () => {
    expect(
      validateManagedSetting('catalog.approvalRequired', true, 'BOOLEAN'),
    ).toBe(true)
    expect(validateManagedSetting('custom.display', 'value')).toBe(false)
    expect(() =>
      validateManagedSetting('payment.channels', {
        card: true,
        promptpay: true,
        bankTransfer: false,
        secret: 'credential',
      }),
    ).toThrow('Unsupported')
    expect(() =>
      validateManagedSetting('payment.channels', {
        card: true,
        promptpay: true,
        bankTransfer: true,
      }),
    ).toThrow('Unsupported')
    expect(() =>
      validateManagedSetting('catalog.approvalRequired', 'true'),
    ).toThrow('Unsupported')
  })
  it('rejects a stale save without writing the switch or audit', async () => {
    const repo = new AdminConfigRepository(prisma)
    vi.spyOn(repo, 'transaction').mockImplementation((operation) =>
      operation(prisma),
    )
    vi.spyOn(prisma.featureToggle, 'findFirst').mockResolvedValue(toggle)
    const update = vi
      .spyOn(prisma.featureToggle, 'update')
      .mockResolvedValue(toggle)
    const audit = vi.spyOn(prisma.auditLog, 'create')
    const service = new AdminConfigService(repo, {
      require: async () => undefined,
    })
    await expect(
      service.saveToggle({ id: 'admin', role: 'ADMIN' }, 'checkout', {
        scope: 'GLOBAL',
        scopeId: null,
        isEnabled: true,
        expectedVersion: null,
      }),
    ).rejects.toMatchObject({ code: 'STALE_VERSION' })
    expect(update).not.toHaveBeenCalled()
    expect(audit).not.toHaveBeenCalled()
  })
})
