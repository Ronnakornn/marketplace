import type { ShopOperationPolicy, Shop } from '#generated/client/client.ts'
export type PayoutCyclePolicy = ShopOperationPolicy & {
  shop: Pick<Shop, 'id' | 'ownerId' | 'status'>
}

export function payoutCycleKey(cadence: string, now: Date): string | null {
  const thaiDate = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const day = thaiDate.toISOString().slice(0, 10)
  if (cadence === 'DAILY') return `daily:${day}`
  if (cadence === 'MONTHLY') return `monthly:${day.slice(0, 7)}`
  if (cadence === 'WEEKLY') {
    const monday = new Date(
      Date.UTC(
        thaiDate.getUTCFullYear(),
        thaiDate.getUTCMonth(),
        thaiDate.getUTCDate(),
      ),
    )
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
    return `weekly:${monday.toISOString().slice(0, 10)}`
  }
  return null
}
