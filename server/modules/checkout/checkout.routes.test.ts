import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { createCheckoutRoutes } from './checkout.routes.ts'

vi.mock('#server/modules/auth/auth.ts', () => ({
  auth: {
    handler: () => new Response(null, { status: 404 }),
  },
}))

vi.mock('#server/modules/auth/auth.context.ts', () => ({
  getAuthContext: vi.fn(),
}))

function createContainer() {
  return {
    adminService: {
      listSystemSettings: vi.fn().mockResolvedValue([]),
      upsertSystemSetting: vi.fn().mockImplementation(async (_actor, _key, input) => ({ value: { ...input.value, revision: 'saved-revision' } })),
    },
    checkoutService: {
      quoteCheckout: vi.fn().mockResolvedValue({
        subtotal: 2400, discountTotal: 0, shippingTotal: 500, taxTotal: 0, grandTotal: 2900,
        currency: 'THB', coupon: null, coinsApplied: 0,
        items: [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', shopId: 'shop-1', unitPrice: 1200, lineTotal: 2400 }],
        shops: [{ shopId: 'shop-1', subtotal: 2400 }],
      }),
      createCheckout: vi.fn().mockResolvedValue({
        orderId: 'order-1',
        orderNo: 'ORD-TEST',
        paymentId: 'payment-1',
        paymentStatus: 'pending',
        paymentUrl: '/th/payment/mock/payment-1',
        totalCents: 2900,
      }),
    },
  } as any
}

function createApp(container = createContainer()) {
  return new Elysia().use(createCheckoutRoutes(container))
}

function mockAuth(role: 'USER' | 'ADMIN' = 'USER') {
  vi.mocked(getAuthContext).mockResolvedValue({
    user: {
      id: `${role.toLowerCase()}-1`,
      email: `${role.toLowerCase()}@example.com`,
      name: role,
      role,
      status: 'ACTIVE',
      emailVerified: true,
    },
  } as any)
}

const validBody = {
  cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  cartItemIds: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
  addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  couponCode: 'SAVE10',
  paymentMethod: 'stripe',
  shippingMethod: 'flat',
}

describe('checkout routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated checkout', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null)

    const response = await createApp().handle(new Request('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    }))

    expect(response.status).toBe(401)
  })

  it('passes valid buyer checkout requests to the service', async () => {
    mockAuth('USER')
    const container = createContainer()

    const response = await createApp(container).handle(new Request('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      paymentUrl: '/th/payment/mock/payment-1',
    })
    expect(container.checkoutService.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', role: 'USER' }),
      validBody,
    )
  })

  it('returns quoted line and shop amounts through the validated API response', async () => {
    mockAuth('USER')
    const response = await createApp().handle(new Request('http://localhost/api/checkout/quote', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cartId: validBody.cartId, cartItemIds: validBody.cartItemIds }),
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      subtotal: '2400', shippingTotal: '500', grandTotal: '2900',
      items: [{ unitPrice: '1200', lineTotal: '2400' }],
      shops: [{ shopId: 'shop-1', subtotal: '2400' }],
    })
  })

  it.each([-1, 1.5, 9007199254740992])('rejects malformed coins %s at the quote API boundary', async (coinsToUse) => {
    mockAuth('USER')
    const container = createContainer()
    const response = await createApp(container).handle(new Request('http://localhost/api/checkout/quote', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cartId: validBody.cartId, cartItemIds: validBody.cartItemIds, coinsToUse }),
    }))
    expect(response.status).toBe(422)
    expect(container.checkoutService.quoteCheckout).not.toHaveBeenCalled()
  })

  it('lets the service reject seller and admin users', async () => {
    mockAuth('ADMIN')
    const container = createContainer()

    await createApp(container).handle(new Request('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    }))

    expect(container.checkoutService.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'ADMIN' }),
      validBody,
    )
  })

  it('protects tax policy reads and writes with the ADMIN macro', async () => {
    mockAuth('USER')
    const container = createContainer()
    const app = createApp(container)
    const read = await app.handle(new Request('http://localhost/api/admin/checkout/tax-policy'))
    const write = await app.handle(new Request('http://localhost/api/admin/checkout/tax-policy', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ratePpm: 0 }) }))
    expect(read.status).toBe(403)
    expect(write.status).toBe(403)
    expect(container.adminService.listSystemSettings).not.toHaveBeenCalled()
    expect(container.adminService.upsertSystemSetting).not.toHaveBeenCalled()
  })

  it('returns the saved revision and rejects incomplete nonzero policies before writing', async () => {
    mockAuth('ADMIN')
    const container = createContainer()
    const app = createApp(container)
    const invalid = await app.handle(new Request('http://localhost/api/admin/checkout/tax-policy', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ratePpm: 70000 }) }))
    expect(invalid.status).toBe(400)
    expect(container.adminService.upsertSystemSetting).not.toHaveBeenCalled()
    const saved = await app.handle(new Request('http://localhost/api/admin/checkout/tax-policy', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ratePpm: 0 }) }))
    expect(saved.status).toBe(200)
    expect(await saved.json()).toMatchObject({ policy: { revision: 'saved-revision', ratePpm: 0, mode: 'EXCLUSIVE' } })
  })

  it('serializes included/added/reported tax exactly with the displayed quote acceptance fields', async () => {
    mockAuth('USER')
    const container = createContainer()
    container.checkoutService.quoteCheckout.mockResolvedValue({ subtotal: 10700, discountTotal: 0, shippingTotal: 0, taxTotal: 0, includedTaxTotal: 700, addedTaxTotal: 0, reportedTaxTotal: 700, grandTotal: 10700,
      currency: 'THB', taxMode: 'INCLUSIVE', taxPolicyRevision: 'policy-v2', quoteFingerprint: 'a'.repeat(64), couponOutcomes: [], coupon: null, coinsApplied: 0, items: [], shops: [] })
    const response = await createApp(container).handle(new Request('http://localhost/api/checkout/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cartId: validBody.cartId, cartItemIds: validBody.cartItemIds }) }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ taxTotal: '0', includedTaxTotal: '700', addedTaxTotal: '0', reportedTaxTotal: '700', grandTotal: '10700', quoteFingerprint: 'a'.repeat(64), taxPolicyRevision: 'policy-v2' })
  })
})
