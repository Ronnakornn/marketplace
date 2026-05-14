import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { SecurityError } from './security.errors.ts'

export interface SecurityEvent {
  type: string
  severity?: 'low' | 'medium' | 'high'
  ipAddress?: string | null
  userAgent?: string | null
  path?: string
  metadata?: Record<string, unknown>
}

export class SecurityService {
  private logger: ILogger

  constructor(appContext: AppContext) {
    this.logger = appContext.logger
  }

  logSuspiciousActivity(event: SecurityEvent): void {
    this.logger.warn('Security event', {
      type: event.type,
      severity: event.severity ?? 'medium',
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      path: event.path,
      metadata: this.redact(event.metadata ?? {}),
    })
  }

  formatError(error: unknown, environment: string): { status: number; body: { error: { code: string; message: string; details?: Record<string, unknown> } } } {
    if (error instanceof SecurityError) {
      return {
        status: error.status,
        body: {
          error: {
            code: error.code,
            message: error.message,
            ...(error.details ? { details: this.redact(error.details) as Record<string, unknown> } : {}),
          },
        },
      }
    }

    return {
      status: 500,
      body: {
        error: {
          code: 'INVALID_REQUEST',
          message: environment === 'production' ? 'Request failed' : this.safeMessage(error),
        },
      },
    }
  }

  private safeMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error)
    return String(this.redactString(message))
  }

  private redact(value: unknown): unknown {
    if (value === null || value === undefined) return value
    if (Array.isArray(value)) return value.map((item) => this.redact(item))
    if (typeof value === 'string') return this.redactString(value)
    if (typeof value !== 'object') return value

    const output: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = /(password|token|secret|authorization|cookie|card|cvv|cvc)/i.test(key)
        ? '[REDACTED]'
        : this.redact(nested)
    }
    return output
  }

  private redactString(value: string): string {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
      .replace(/(password|token|secret|authorization)=([^&\s]+)/gi, '$1=[REDACTED]')
  }
}
