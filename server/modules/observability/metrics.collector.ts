export interface MetricsSnapshot {
  uptime: number
  timestamp: string
  requests: {
    total: number
    errors: number
    averageDurationMs: number
    slow: number
  }
  health: {
    status: 'ok' | 'degraded' | 'down'
  }
  queueJobs: {
    success: number
    failure: number
  }
  paymentWebhooks: {
    success: number
    failure: number
  }
}

export class MetricsCollector {
  private totalRequests = 0
  private errorCount = 0
  private totalDurationMs = 0
  private slowRequestCount = 0
  private healthStatus: MetricsSnapshot['health']['status'] = 'ok'
  private queueJobSuccessCount = 0
  private queueJobFailureCount = 0
  private paymentWebhookSuccessCount = 0
  private paymentWebhookFailureCount = 0

  recordRequest(durationMs: number, statusCode: number, slowRequestMs: number): void {
    this.totalRequests += 1
    this.totalDurationMs += durationMs
    if (statusCode >= 500) this.errorCount += 1
    if (durationMs >= slowRequestMs) this.slowRequestCount += 1
  }

  recordError(): void {
    this.errorCount += 1
  }

  setHealthStatus(status: MetricsSnapshot['health']['status']): void {
    this.healthStatus = status
  }

  recordQueueJobSuccess(): void {
    this.queueJobSuccessCount += 1
  }

  recordQueueJobFailure(): void {
    this.queueJobFailureCount += 1
  }

  recordPaymentWebhookSuccess(): void {
    this.paymentWebhookSuccessCount += 1
  }

  recordPaymentWebhookFailure(): void {
    this.paymentWebhookFailureCount += 1
  }

  snapshot(): MetricsSnapshot {
    return {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      requests: {
        total: this.totalRequests,
        errors: this.errorCount,
        averageDurationMs: this.totalRequests === 0 ? 0 : Number((this.totalDurationMs / this.totalRequests).toFixed(2)),
        slow: this.slowRequestCount,
      },
      health: {
        status: this.healthStatus,
      },
      queueJobs: {
        success: this.queueJobSuccessCount,
        failure: this.queueJobFailureCount,
      },
      paymentWebhooks: {
        success: this.paymentWebhookSuccessCount,
        failure: this.paymentWebhookFailureCount,
      },
    }
  }

  reset(): void {
    this.totalRequests = 0
    this.errorCount = 0
    this.totalDurationMs = 0
    this.slowRequestCount = 0
    this.healthStatus = 'ok'
    this.queueJobSuccessCount = 0
    this.queueJobFailureCount = 0
    this.paymentWebhookSuccessCount = 0
    this.paymentWebhookFailureCount = 0
  }
}
