export type PopupFrequency = 'SESSION' | 'DAILY' | 'ALWAYS'
export function normalizePopupFrequency(value: unknown): PopupFrequency {
  return value === 'DAILY' || value === 'ALWAYS' ? value : 'SESSION'
}
export function popupIsActive(
  banner: { startsAt: string | null; endsAt: string | null },
  now: Date,
) {
  const start =
    banner.startsAt === null ? -Infinity : Date.parse(banner.startsAt)
  const end = banner.endsAt === null ? Infinity : Date.parse(banner.endsAt)
  return start <= now.getTime() && now.getTime() < end
}
export function safePopupUrl(value: string | null): string | null {
  if (!value || /[\\\x00-\x20]/.test(value)) return null
  if (value.startsWith('/') && !value.startsWith('//')) return value
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
      ? value
      : null
  } catch {
    return null
  }
}
export function popupStorageValue(
  frequency: PopupFrequency,
  now: Date,
): string | null {
  if (frequency === 'ALWAYS') return null
  if (frequency === 'SESSION') return 'seen'
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10)
}
export function popupSeen(
  storage: Pick<Storage, 'getItem'>,
  id: string,
  frequency: PopupFrequency,
  now: Date,
) {
  const value = popupStorageValue(frequency, now)
  if (value === null) return false
  try {
    return storage.getItem(`marketplace:popup:${id}:${frequency}`) === value
  } catch {
    return false
  }
}
export function markPopupSeen(
  storage: Pick<Storage, 'setItem'>,
  id: string,
  frequency: PopupFrequency,
  now: Date,
) {
  const value = popupStorageValue(frequency, now)
  if (value !== null)
    try {
      storage.setItem(`marketplace:popup:${id}:${frequency}`, value)
    } catch {
      /* Storage restrictions do not prevent dismissal. */
    }
}
