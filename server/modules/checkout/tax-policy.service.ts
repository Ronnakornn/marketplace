import { AdminServiceError } from '#server/modules/admin/admin.errors.ts'
import type { AdminActor, AdminService } from '#server/modules/admin/admin.service.ts'
import { parseFrozenTaxPolicy } from './sale-economics.ts'
import { CheckoutServiceError } from './checkout.errors.ts'

export class TaxPolicyService {
  constructor(
    private settings: Pick<AdminService, 'getSystemSetting' | 'upsertSystemSetting'>,
    private readonly v2Supported = process.env['CHECKOUT_V2_SETTLEMENT_ENABLED'] === 'true',
  ) {}

  async get(actor: AdminActor) {
    const stored = await this.settings.getSystemSetting(actor, 'checkout.tax').catch((error: unknown) => {
      if (error instanceof AdminServiceError && error.code === 'SETTING_NOT_FOUND') return null
      throw error
    })
    if (stored && (stored.valueType !== 'JSON' || stored.value === null)) throw new CheckoutServiceError('Stored tax policy must contain a JSON policy', 400, 'INVALID_TAX_POLICY')
    return { policy: parseFrozenTaxPolicy(stored?.value ?? null), settlementEnabled: this.v2Supported }
  }

  async put(actor: AdminActor, value: unknown) {
    if (value === null || value === undefined) throw new CheckoutServiceError('Tax policy is required', 400, 'INVALID_TAX_POLICY')
    const policy = parseFrozenTaxPolicy(value)
    const saved = await this.settings.upsertSystemSetting(actor, 'checkout.tax', { value: policy, valueType: 'JSON', isPublic: false, description: 'Frozen checkout tax policy; nonzero activation requires complete version-two settlement support' })
    return { policy: parseFrozenTaxPolicy(saved.value), settlementEnabled: this.v2Supported }
  }
}
