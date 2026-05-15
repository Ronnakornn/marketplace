export const supportedLocales = ['th', 'en'] as const

export type ContentLocale = typeof supportedLocales[number]

export const defaultContentLocale: ContentLocale = 'th'
export const fallbackContentLocale: ContentLocale = 'en'

export function resolveContentLocale(value: unknown): ContentLocale {
  return value === 'en' || value === 'th' ? value : defaultContentLocale
}

export function localizedText(
  locale: ContentLocale,
  values: {
    th?: string | null
    en?: string | null
    fallback?: string | null
  },
): string | null {
  const primary = locale === 'th' ? values.th : values.en
  const secondary = locale === 'th' ? values.en : values.th
  return normalizeText(primary) ?? normalizeText(secondary) ?? normalizeText(values.fallback) ?? null
}

function normalizeText(value?: string | null): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}
