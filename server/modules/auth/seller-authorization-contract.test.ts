import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sellerRouteFiles = [
  'server/modules/seller-onboarding/seller-onboarding.routes.ts',
  'server/modules/order/order.routes.ts',
  'server/modules/catalog/catalog.routes.ts',
  'server/modules/promotion/promotion.routes.ts',
  'server/modules/return/return.routes.ts',
  'server/modules/seller/seller-dashboard.routes.ts',
  'server/modules/shipment/shipment.routes.ts',
  'server/modules/payout/payout.routes.ts',
  'server/modules/wallet/wallet.routes.ts',
]

describe('seller authorization contract', () => {
  it('does not gate seller APIs with the removed SELLER role', () => {
    const workspace = process.cwd()
    const routeSources = sellerRouteFiles.map((file) => readFileSync(join(workspace, file), 'utf8')).join('\n')

    expect(routeSources).not.toContain("withRole: 'SELLER'")
    expect(routeSources).not.toContain('withRole: "SELLER"')
    expect(routeSources).toContain('withAuth: true')
  })
})
