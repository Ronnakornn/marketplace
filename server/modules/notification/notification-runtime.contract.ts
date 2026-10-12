import type { NotificationTemplateVariable } from './notification-template.ts'
import type { EmailService } from '#server/modules/email'
export interface NotificationRuntimeConfig {
  deliveryConfig(): Promise<{ inApp: boolean; push: boolean; email: boolean }>
  renderNotification(input: {
    key: string
    channel: 'EMAIL' | 'PUSH' | 'IN_APP'
    locale?: 'th' | 'en'
    values: Partial<Record<NotificationTemplateVariable, string>>
  }): Promise<{ subject: string | null; body: string } | null>
}
export type NotificationEmailSender = Pick<EmailService, 'sendMessage'>
