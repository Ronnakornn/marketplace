import { AdminOperationsError } from './operations.errors.ts'

export { notificationTemplateVariables as templateVariables } from '#server/modules/notification/notification-template.ts'
import { notificationTemplateVariables as templateVariables, parseTemplateVariables } from '#server/modules/notification/notification-template.ts'

export function assertSafeLink(value: string | null | undefined) {
  if (!value) return
  if (
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !/[\\\x00-\x20]/.test(value)
  )
    return
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new AdminOperationsError(
      'Link must use an absolute HTTPS URL or local path',
    )
  }
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new AdminOperationsError('Link must use HTTPS without credentials')
}

export function assertTimeWindow(startsAt: Date | null, endsAt: Date | null) {
  if (
    (startsAt && !Number.isFinite(startsAt.getTime())) ||
    (endsAt && !Number.isFinite(endsAt.getTime())) ||
    (startsAt && endsAt && startsAt >= endsAt)
  )
    throw new AdminOperationsError('Schedule end must follow its start')
}

export function isBannerActive(
  banner: { status: string; startsAt: Date | null; endsAt: Date | null },
  now: Date,
) {
  return (
    ['PUBLISHED', 'SCHEDULED'].includes(banner.status) &&
    (!banner.startsAt || banner.startsAt <= now) &&
    (!banner.endsAt || banner.endsAt > now)
  )
}

export function validateTemplate(text: string) {
  try { return parseTemplateVariables(text) }
  catch (error) { throw new AdminOperationsError(error instanceof Error ? error.message : 'Invalid template') }
}

export function previewTemplate(
  text: string,
  values: Partial<Record<(typeof templateVariables)[number], string>>,
) {
  validateTemplate(text)
  return text.replace(/{{\s*([^{}]+?)\s*}}/g, (_match, variable: string) => {
    const value =
      Object.entries(values).find(([key]) => key === variable)?.[1] ??
      `[${variable}]`
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
  })
}
