import type {
  ShippingProvider,
  ShippingRateRule,
} from '#generated/client/client.ts'
import { AdminOperationsError } from './operations.errors.ts'

export type ShippingPackage = {
  weightGrams: number
  lengthMm: number
  widthMm: number
  heightMm: number
}
export type ShippingQuoteInput = {
  shopId: string
  enabled: boolean
  flatFee: bigint
  country: string
  postalCode: string
  region?: string
  packages: ShippingPackage[]
}
export type ShippingQuoteRule = ShippingRateRule & {
  provider: Pick<ShippingProvider, 'id' | 'shopId' | 'name' | 'isActive'>
}

export function quoteShipping(
  input: ShippingQuoteInput,
  rules: readonly ShippingQuoteRule[],
) {
  if (!input.enabled)
    return {
      fee: input.flatFee,
      ruleId: null,
      ruleVersion: null,
      providerId: null,
      providerName: null,
      chargeableWeightGrams: 0,
      mode: 'FLAT',
    }
  if (!input.packages.length || input.packages.length > 100)
    throw new AdminOperationsError('Shipping requires 1 to 100 packages')
  for (const pkg of input.packages) {
    if (
      Object.values(pkg).some(
        (value) =>
          !Number.isSafeInteger(value) || value < 0 || value > 1_000_000,
      )
    )
      throw new AdminOperationsError(
        'Package measurements must be integer grams and millimetres',
      )
    if (!pkg.weightGrams || !pkg.lengthMm || !pkg.widthMm || !pkg.heightMm)
      throw new AdminOperationsError(
        'Package measurements are required for shipping rates',
      )
  }
  const candidates = rules
    .filter(
      (rule) =>
        rule.isActive &&
        rule.provider.isActive &&
        (!rule.shopId || rule.shopId === input.shopId) &&
        (!rule.provider.shopId || rule.provider.shopId === input.shopId) &&
        rule.country === input.country.toUpperCase(),
    )
    .filter(
      (rule) =>
        !rule.postalPrefixes.length ||
        rule.postalPrefixes.some((prefix) =>
          input.postalCode.startsWith(prefix),
        ),
    )
    .filter(
      (rule) =>
        !rule.regions.length || rule.regions.includes(input.region ?? ''),
    )
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
  for (const rule of candidates) {
    if (
      !Number.isSafeInteger(rule.volumetricDivisor) ||
      rule.volumetricDivisor <= 0
    )
      continue
    if (
      input.packages.some(
        (pkg) =>
          (rule.maxLengthMm !== null && pkg.lengthMm > rule.maxLengthMm) ||
          (rule.maxWidthMm !== null && pkg.widthMm > rule.maxWidthMm) ||
          (rule.maxHeightMm !== null && pkg.heightMm > rule.maxHeightMm),
      )
    )
      continue
    const grams = input.packages.reduce((sum, pkg) => {
      const volume =
        BigInt(pkg.lengthMm) * BigInt(pkg.widthMm) * BigInt(pkg.heightMm)
      const divisor = BigInt(rule.volumetricDivisor)
      const volumetric = (volume + divisor - 1n) / divisor
      return (
        sum +
        (BigInt(pkg.weightGrams) > volumetric
          ? BigInt(pkg.weightGrams)
          : volumetric)
      )
    }, 0n)
    if (grams > BigInt(Number.MAX_SAFE_INTEGER)) continue
    if (
      grams < BigInt(rule.minWeightGrams) ||
      (rule.maxWeightGrams !== null && grams > BigInt(rule.maxWeightGrams))
    )
      continue
    return {
      fee: rule.baseFee + ((grams + 999n) / 1000n) * rule.perKgFee,
      ruleId: rule.id,
      ruleVersion: rule.version,
      providerId: rule.provider.id,
      providerName: rule.provider.name,
      chargeableWeightGrams: Number(grams),
      mode: 'RATE',
    }
  }
  throw new AdminOperationsError(
    'No shipping rate covers this destination and package',
    409,
    'SHIPPING_RATE_UNAVAILABLE',
  )
}
