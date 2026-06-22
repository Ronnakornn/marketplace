import type { SellerApplicationStatus } from '#generated/client/enums.ts'
import { SecurityError } from './security.errors.ts'

export type SellerReadinessCode = 'SELLER_ONBOARDING_REQUIRED' | 'SELLER_SHOP_INACTIVE'
export type SellerRedirectPath = '/seller/register' | '/seller/status'

export interface SellerReadinessState {
  hasActiveShop: boolean
  applicationStatus: SellerApplicationStatus | null
}

export interface SellerOperationalReadiness {
  isReady: boolean
  code: SellerReadinessCode | null
  redirectPath: SellerRedirectPath | null
}

export function resolveSellerOperationalReadiness(state: SellerReadinessState): SellerOperationalReadiness {
  if (state.hasActiveShop) {
    return {
      isReady: true,
      code: null,
      redirectPath: null,
    }
  }

  switch (state.applicationStatus) {
    case 'SUBMITTED':
    case 'APPROVED':
      return {
        isReady: false,
        code: 'SELLER_SHOP_INACTIVE',
        redirectPath: '/seller/status',
      }

    case null:
    case 'DRAFT':
    case 'REJECTED':
    case 'CANCELLED':
    default:
      return {
        isReady: false,
        code: 'SELLER_ONBOARDING_REQUIRED',
        redirectPath: '/seller/register',
      }
  }
}

export function createSellerOperationalReadinessError(readiness: SellerOperationalReadiness): SecurityError | null {
  if (readiness.isReady || !readiness.code || !readiness.redirectPath) {
    return null
  }

  const message = readiness.code === 'SELLER_SHOP_INACTIVE'
    ? 'Seller shop is not active yet'
    : 'Seller onboarding is required before accessing seller operations'

  return new SecurityError(message, 403, readiness.code, {
    redirectPath: readiness.redirectPath,
  })
}

export function assertSellerOperationalReadiness(state: SellerReadinessState): void {
  const readiness = resolveSellerOperationalReadiness(state)
  const error = createSellerOperationalReadinessError(readiness)
  if (error) {
    throw error
  }
}
