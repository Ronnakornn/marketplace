import type { AdminActor, AdminService } from '#server/modules/admin/admin.service.ts'
import { parseFrozenTaxPolicy } from './sale-economics.ts'
import { CheckoutServiceError } from './checkout.errors.ts'

export class TaxPolicyService {
  constructor(private settings: Pick<AdminService, 'listSystemSettings' | 'upsertSystemSetting'>) {}

  async get(actor: AdminActor) {
    const settings = await this.settings.listSystemSettings(actor)
    const stored = settings.find((setting) => setting.key === 'checkout.tax')
    if (stored && (stored.valueType !== 'JSON' || stored.value === null)) throw new CheckoutServiceError('Stored tax policy must contain a JSON policy', 400, 'INVALID_TAX_POLICY')
    return { policy: parseFrozenTaxPolicy(stored?.value ?? null), settlementEnabled: process.env['CHECKOUT_V2_SETTLEMENT_ENABLED'] === 'true' }
  }

  async put(actor: AdminActor, value: unknown) {
    if (value === null || value === undefined) throw new CheckoutServiceError('Tax policy is required', 400, 'INVALID_TAX_POLICY')
    const policy = parseFrozenTaxPolicy(value)
    const saved = await this.settings.upsertSystemSetting(actor, 'checkout.tax', { value: policy, valueType: 'JSON', isPublic: false, description: 'Frozen checkout tax policy; nonzero activation requires complete version-two settlement support' })
    return { policy: parseFrozenTaxPolicy(saved.value), settlementEnabled: process.env['CHECKOUT_V2_SETTLEMENT_ENABLED'] === 'true' }
  }
}
