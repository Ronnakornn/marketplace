import IORedis from 'ioredis'
import type { PrismaClient } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export interface IHealthCheckRepository {
  checkDatabase(timeoutMs: number): Promise<boolean>
  checkDatabaseSchema(timeoutMs: number): Promise<boolean>
  checkRedis(redisUrl: string, timeoutMs: number): Promise<boolean>
}

export class PrismaHealthCheckRepository implements IHealthCheckRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  async checkDatabaseSchema(timeoutMs: number): Promise<boolean> {
    this.logger.debug('PrismaHealthCheckRepository.checkDatabaseSchema')
    try {
      const rows = await withTimeout(this.prisma.$queryRaw<Array<{ schemaReady: boolean; migrationsReady: boolean }>>`
        SELECT (
          to_regclass('"PushSubscription"') IS NOT NULL
          AND to_regclass('"CouponRedemption"') IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'CouponRedemption'
              AND column_name = 'status'
          )
        ) AS "schemaReady",
        (to_regclass('"_prisma_migrations"') IS NOT NULL) AS "migrationsReady"
      `, timeoutMs)
      if (!rows[0]?.schemaReady || !rows[0]?.migrationsReady) return false
      const migrations = await withTimeout(this.prisma.$queryRaw<Array<{ ready: boolean }>>`
        SELECT EXISTS (
          SELECT 1
          FROM "_prisma_migrations"
          WHERE migration_name = '20260813013000_coupon_redemption_lifecycle'
            AND finished_at IS NOT NULL
            AND rolled_back_at IS NULL
        ) AS ready
      `, timeoutMs)
      return migrations[0]?.ready === true
    } catch (error) {
      this.logger.error('Database schema readiness check failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  async checkDatabase(timeoutMs: number): Promise<boolean> {
    this.logger.debug('PrismaHealthCheckRepository.checkDatabase')
    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`, timeoutMs)
      return true
    } catch (error) {
      this.logger.error('Database health check failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  async checkRedis(redisUrl: string, timeoutMs: number): Promise<boolean> {
    const redis = new IORedis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
    })
    try {
      await withTimeout(redis.connect(), timeoutMs)
      await withTimeout(redis.ping(), timeoutMs)
      return true
    } catch (error) {
      this.logger.error('Redis health check failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    } finally {
      redis.disconnect()
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Health check timed out')), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}
