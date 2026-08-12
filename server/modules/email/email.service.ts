import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export type EmailOtpPurpose = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET'

export interface EmailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>
}

export class EmailService {
  constructor(private sender: EmailSender) {}

  sendMessage(message: EmailMessage): Promise<void> {
    return this.sender.send(message)
  }

  sendOtp(input: { to: string; otp: string; purpose: EmailOtpPurpose; expiresInMinutes: number }): Promise<void> {
    const verification = input.purpose === 'EMAIL_VERIFICATION'
    const subject = verification ? 'Verify your marketplace email' : 'Reset your marketplace password'
    const action = verification ? 'verify your email address' : 'reset your password'
    const text = `Use code ${input.otp} to ${action}. It expires in ${input.expiresInMinutes} minutes.`
    return this.sender.send({
      to: input.to,
      subject,
      text,
      html: `<p>Use this code to ${action}:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${input.otp}</p><p>This code expires in ${input.expiresInMinutes} minutes.</p>`,
    })
  }
}

export function createEmailService(appContext: AppContext, env: NodeJS.ProcessEnv = process.env): EmailService {
  const provider = env['EMAIL_PROVIDER']?.trim().toLowerCase() || 'console'
  if (provider === 'resend') {
    const apiKey = env['RESEND_API_KEY']?.trim()
    const from = env['EMAIL_FROM']?.trim()
    if (!apiKey || !from) throw new Error('RESEND_API_KEY and EMAIL_FROM are required for the Resend provider')
    return new EmailService(new ResendEmailSender(apiKey, from))
  }
  if (provider === 'console' && appContext.config.environment !== 'production') {
    return new EmailService(new DevelopmentEmailSender(appContext.logger))
  }
  throw new Error(`Unsupported email provider: ${provider}`)
}

class ResendEmailSender implements EmailSender {
  constructor(private apiKey: string, private from: string) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from: this.from, ...message }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      throw new Error(`Email provider rejected request with status ${response.status}`)
    }
  }
}

class DevelopmentEmailSender implements EmailSender {
  constructor(private logger: ILogger) {}

  async send(message: EmailMessage): Promise<void> {
    this.logger.warn('Development email delivery', {
      to: message.to,
      subject: message.subject,
      body: message.text,
    })
  }
}
