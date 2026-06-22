import { describe, expect, it } from 'vitest'
import {
  assertSellerOperationalReadiness,
  createSellerOperationalReadinessError,
  resolveSellerOperationalReadiness,
  type SellerReadinessState,
} from './seller-readiness.ts'

describe('seller readiness', () => {
  it('allows operational access when user has an active shop', () => {
    const readiness = resolveSellerOperationalReadiness({
      hasActiveShop: true,
      applicationStatus: 'APPROVED',
    })

    expect(readiness).toEqual({
      isReady: true,
      code: null,
      redirectPath: null,
    })
    expect(createSellerOperationalReadinessError(readiness)).toBeNull()
    expect(() => assertSellerOperationalReadiness({
      hasActiveShop: true,
      applicationStatus: 'APPROVED',
    })).not.toThrow()
  })

  it('maps onboarding-required states to register redirect', () => {
    const cases: SellerReadinessState[] = [
      { hasActiveShop: false, applicationStatus: null },
      { hasActiveShop: false, applicationStatus: 'DRAFT' },
      { hasActiveShop: false, applicationStatus: 'REJECTED' },
      { hasActiveShop: false, applicationStatus: 'CANCELLED' },
    ]

    for (const state of cases) {
      const readiness = resolveSellerOperationalReadiness(state)
      expect(readiness).toEqual({
        isReady: false,
        code: 'SELLER_ONBOARDING_REQUIRED',
        redirectPath: '/seller/register',
      })

      const error = createSellerOperationalReadinessError(readiness)
      expect(error).toMatchObject({
        status: 403,
        code: 'SELLER_ONBOARDING_REQUIRED',
        details: { redirectPath: '/seller/register' },
      })
      expect(() => assertSellerOperationalReadiness(state)).toThrowError(expect.objectContaining({
        code: 'SELLER_ONBOARDING_REQUIRED',
      }))
    }
  })

  it('maps submitted and approved-without-shop states to status redirect', () => {
    const cases: SellerReadinessState[] = [
      { hasActiveShop: false, applicationStatus: 'SUBMITTED' },
      { hasActiveShop: false, applicationStatus: 'APPROVED' },
    ]

    for (const state of cases) {
      const readiness = resolveSellerOperationalReadiness(state)
      expect(readiness).toEqual({
        isReady: false,
        code: 'SELLER_SHOP_INACTIVE',
        redirectPath: '/seller/status',
      })

      const error = createSellerOperationalReadinessError(readiness)
      expect(error).toMatchObject({
        status: 403,
        code: 'SELLER_SHOP_INACTIVE',
        details: { redirectPath: '/seller/status' },
      })
      expect(() => assertSellerOperationalReadiness(state)).toThrowError(expect.objectContaining({
        code: 'SELLER_SHOP_INACTIVE',
      }))
    }
  })
})
