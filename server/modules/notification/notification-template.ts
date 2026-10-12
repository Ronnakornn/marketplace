export const notificationTemplateVariables = [
  'name',
  'buyerName',
  'orderNumber',
  'shopName',
  'trackingNumber',
  'amount',
  'currency',
  'supportTicketNumber',
] as const
export type NotificationTemplateVariable =
  (typeof notificationTemplateVariables)[number]

export function parseTemplateVariables(text: string) {
  const variables = [...text.matchAll(/{{\s*([^{}]+?)\s*}}/g)].map(
    (match) => match[1]!,
  )
  if (
    variables.some(
      (variable) =>
        !notificationTemplateVariables.some((known) => known === variable),
    )
  )
    throw new Error('Unsupported template variable')
  const remainder = text.replace(/{{\s*([^{}]+?)\s*}}/g, '')
  if (remainder.includes('{{') || remainder.includes('}}'))
    throw new Error('Invalid template variable syntax')
  return [...new Set(variables)]
}
