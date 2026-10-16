import { expect, it, vi } from 'vitest'
import { AdminServiceError } from '#server/modules/admin/admin.errors.ts'
import { TaxPolicyService } from './tax-policy.service.ts'
const actor = { id: 'admin', role: 'ADMIN' as const }
it('reads only the tax key and defaults only when that key is absent', async () => {
  const settings = { getSystemSetting: vi.fn().mockRejectedValue(new AdminServiceError('missing', 404, 'SETTING_NOT_FOUND')), upsertSystemSetting: vi.fn() }
  const service = new TaxPolicyService(settings, true)
  expect(await service.get(actor)).toMatchObject({ settlementEnabled: true })
  expect(settings.getSystemSetting).toHaveBeenCalledExactlyOnceWith(actor, 'checkout.tax')
  settings.getSystemSetting.mockRejectedValue(new AdminServiceError('forbidden', 403, 'FORBIDDEN'))
  await expect(service.get(actor)).rejects.toMatchObject({ status: 403 })
  settings.getSystemSetting.mockRejectedValue(new Error('database unavailable'))
  await expect(service.get(actor)).rejects.toThrow('database unavailable')
})
it('preserves captured settlement capability and rejects malformed stored policies', async () => {
  const settings = { getSystemSetting: vi.fn().mockResolvedValue({ valueType: 'JSON', value: null }), upsertSystemSetting: vi.fn() }
  const service = new TaxPolicyService(settings as never, false)
  await expect(service.get(actor)).rejects.toMatchObject({ code: 'INVALID_TAX_POLICY' })
})
