import type { PaymentStatus } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { CacheInvalidation } from '#server/modules/cache'
import type { EventPublisherService } from '#server/modules/event-bus'
import type { QueueProducer } from '#server/modules/queue'
import { JobServiceError } from './job.errors.ts'
import type { ExpiredPaymentRecord, IJobRepository, ReleaseReservationInput } from './job.repository.ts'
import type {
  AnyJobPayload,
  CleanupAbandonedCartsJobPayload,
  JobName,
  JobPayloadByName,
  ReleaseExpiredPaymentStockJobPayload,
  SendEmailPlaceholderJobPayload,
  SendNotificationJobPayload,
  SyncOrderStatusJobPayload,
} from './job.types.ts'

const defaultPaymentTimeoutMinutes = 30
const defaultAbandonedCartMinutes = 60 * 24 * 14
const retryableJobNames = new Set<JobName>(['send_notification', 'send_email_placeholder'])
const terminalPaymentStatuses: PaymentStatus[] = ['SUCCEEDED', 'FAILED', 'CANCELED', 'REFUNDED']

export interface JobProcessResult {
  ok: true
  code: string
  processedCount?: number
}

export class JobService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IJobRepository,
    private queueProducer: QueueProducer,
    private cacheInvalidation?: CacheInvalidation,
    private eventPublisher?: EventPublisherService,
  ) {
    this.logger = appContext.logger
  }

  async enqueue<TName extends JobName>(
    jobName: TName,
    payload: JobPayloadByName[TName],
  ): Promise<{ id?: string }> {
    this.validatePayload(jobName, payload)
    return this.queueProducer.enqueue(jobName, payload)
  }

  async process(jobName: JobName, payload: AnyJobPayload): Promise<JobProcessResult> {
    this.logger.info('JobService.process.start', { jobName })
    try {
      this.validatePayload(jobName, payload)
      const result = await this.dispatch(jobName, payload)
      this.logger.info('JobService.process.success', { jobName, result })
      return result
    } catch (error) {
      this.logger.error('JobService.process.failure', {
        jobName,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error instanceof JobServiceError
        ? error
        : new JobServiceError('Job failed', 'JOB_FAILED', { jobName })
    }
  }

  canRetry(jobName: JobName): boolean {
    return retryableJobNames.has(jobName)
  }

  private dispatch(jobName: JobName, payload: AnyJobPayload): Promise<JobProcessResult> {
    switch (jobName) {
      case 'send_notification':
        return this.sendNotification(payload as SendNotificationJobPayload)
      case 'send_email_placeholder':
        return this.sendEmailPlaceholder(payload as SendEmailPlaceholderJobPayload)
      case 'release_expired_payment_stock':
        return this.releaseExpiredPaymentStock(payload as ReleaseExpiredPaymentStockJobPayload)
      case 'cleanup_abandoned_carts':
        return this.cleanupAbandonedCarts(payload as CleanupAbandonedCartsJobPayload)
      case 'sync_order_status':
        return this.syncOrderStatus(payload as SyncOrderStatusJobPayload)
    }
  }

  private async sendNotification(payload: SendNotificationJobPayload): Promise<JobProcessResult> {
    await this.repo.createNotification({
      userId: payload.userId,
      type: payload.type,
      title: payload.title.trim(),
      body: payload.body?.trim() || null,
      data: payload.data ?? null,
    })
    return { ok: true, code: 'NOTIFICATION_SENT', processedCount: 1 }
  }

  private async sendEmailPlaceholder(payload: SendEmailPlaceholderJobPayload): Promise<JobProcessResult> {
    this.logger.info('JobService.sendEmailPlaceholder', {
      to: payload.to,
      subject: payload.subject,
    })
    return { ok: true, code: 'EMAIL_PLACEHOLDER_SKIPPED', processedCount: 1 }
  }

  private async releaseExpiredPaymentStock(
    payload: ReleaseExpiredPaymentStockJobPayload,
  ): Promise<JobProcessResult> {
    const now = this.parseOptionalDate(payload.now) ?? new Date()
    const timeoutMinutes = payload.paymentTimeoutMinutes ?? this.getPaymentTimeoutMinutes()
    const cutoff = new Date(now.getTime() - timeoutMinutes * 60_000)
    const candidates = await this.repo.findExpiredPendingPayments(cutoff)
    let processedCount = 0

    for (const candidate of candidates) {
      const expired = await this.expirePayment(candidate.id)
      if (expired) {
        processedCount += 1
        await this.publishCancellationBestEffort(expired.orderId, expired.paymentId)
      }
    }

    return { ok: true, code: 'EXPIRED_PAYMENTS_RELEASED', processedCount }
  }

  private async expirePayment(paymentId: string): Promise<{ orderId: string; paymentId: string } | null> {
    return this.repo.transaction(async (txRepo) => {
      const payment = await txRepo.findPaymentForExpiry(paymentId)
      if (!payment || terminalPaymentStatuses.includes(payment.status)) return null
      if (payment.status !== 'PENDING' && payment.status !== 'REQUIRES_ACTION') return null

      await txRepo.releaseReservations(this.getActiveReservations(payment))
      await txRepo.markPaymentExpired(payment.id)
      await txRepo.markOrderCanceled(payment.orderId)
      await txRepo.markCheckoutExpired(payment.order.checkoutId)
      await this.cacheInvalidation?.invalidateInventory()
      return { orderId: payment.orderId, paymentId: payment.id }
    })
  }

  private async publishCancellationBestEffort(orderId: string, paymentId: string): Promise<void> {
    try {
      await this.eventPublisher?.publish({
        eventName: 'order.cancelled',
        aggregateType: 'order',
        aggregateId: orderId,
        data: { orderId, paymentId, cause: 'payment_expired' },
      })
    } catch (error) {
      this.logger.warn('JobService event publish failed', {
        eventName: 'order.cancelled',
        orderId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private async cleanupAbandonedCarts(payload: CleanupAbandonedCartsJobPayload): Promise<JobProcessResult> {
    const now = this.parseOptionalDate(payload.now) ?? new Date()
    const olderThanMinutes = payload.olderThanMinutes ?? defaultAbandonedCartMinutes
    const cutoff = new Date(now.getTime() - olderThanMinutes * 60_000)
    const processedCount = await this.repo.cleanupAbandonedCarts(cutoff)
    return { ok: true, code: 'ABANDONED_CARTS_CLEANED', processedCount }
  }

  private async syncOrderStatus(payload: SyncOrderStatusJobPayload): Promise<JobProcessResult> {
    this.logger.info('JobService.syncOrderStatus.placeholder', { orderId: payload.orderId })
    return { ok: true, code: 'ORDER_STATUS_SYNC_SKIPPED', processedCount: 0 }
  }

  private getActiveReservations(payment: ExpiredPaymentRecord): ReleaseReservationInput[] {
    return payment.order.checkout.inventoryReservations
      .filter((reservation) => reservation.status === 'ACTIVE')
      .map((reservation) => ({
        reservationId: reservation.id,
        inventoryId: reservation.inventoryId,
        quantity: reservation.quantity,
      }))
  }

  private validatePayload(jobName: JobName, payload: unknown): void {
    if (!payload || typeof payload !== 'object') {
      throw new JobServiceError('Invalid job payload', 'INVALID_JOB_PAYLOAD', { jobName })
    }

    if (jobName === 'send_notification') {
      const input = payload as SendNotificationJobPayload
      if (!this.nonEmptyString(input.userId) || !this.nonEmptyString(input.type) || !this.nonEmptyString(input.title)) {
        throw new JobServiceError('Invalid notification job payload', 'INVALID_JOB_PAYLOAD', { jobName })
      }
      return
    }

    if (jobName === 'send_email_placeholder') {
      const input = payload as SendEmailPlaceholderJobPayload
      if (!this.nonEmptyString(input.to) || !this.nonEmptyString(input.subject)) {
        throw new JobServiceError('Invalid email job payload', 'INVALID_JOB_PAYLOAD', { jobName })
      }
      return
    }

    if (jobName === 'sync_order_status') {
      const input = payload as SyncOrderStatusJobPayload
      if (!this.nonEmptyString(input.orderId)) {
        throw new JobServiceError('Invalid order sync job payload', 'INVALID_JOB_PAYLOAD', { jobName })
      }
      return
    }

    if (jobName === 'release_expired_payment_stock') {
      const input = payload as ReleaseExpiredPaymentStockJobPayload
      this.validateOptionalTimestamp(jobName, input.now)
      if (input.paymentTimeoutMinutes !== undefined && (!Number.isInteger(input.paymentTimeoutMinutes) || input.paymentTimeoutMinutes <= 0)) {
        throw new JobServiceError('Invalid scheduled job payload', 'INVALID_JOB_PAYLOAD', { jobName })
      }
      return
    }

    if (jobName === 'cleanup_abandoned_carts') {
      const input = payload as CleanupAbandonedCartsJobPayload
      this.validateOptionalTimestamp(jobName, input.now)
      if (input.olderThanMinutes !== undefined && (!Number.isInteger(input.olderThanMinutes) || input.olderThanMinutes <= 0)) {
        throw new JobServiceError('Invalid scheduled job payload', 'INVALID_JOB_PAYLOAD', { jobName })
      }
    }
  }

  private validateOptionalTimestamp(jobName: JobName, value: string | undefined): void {
    if (value !== undefined && !this.parseOptionalDate(value)) {
      throw new JobServiceError('Invalid scheduled job timestamp', 'INVALID_JOB_PAYLOAD', { jobName })
    }
  }

  private parseOptionalDate(value: string | undefined): Date | null {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  private nonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0
  }

  private getPaymentTimeoutMinutes(): number {
    const configured = Number(process.env['PAYMENT_TIMEOUT_MINUTES'])
    return Number.isInteger(configured) && configured > 0 ? configured : defaultPaymentTimeoutMinutes
  }
}
