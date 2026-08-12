import type { PrismaClient, PushSubscription } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import {
  decryptPushSubscriptionValue,
  encryptPushSubscriptionValue,
  hashPushEndpoint,
} from './push-subscription.crypto.ts'

export interface PushSubscriptionInput {
  endpoint: string
  locale: 'th' | 'en'
  expirationTime?: number | null
  keys: {
    p256dh: string
    auth: string
  }
}

export interface StoredPushSubscription extends PushSubscriptionInput {
  id: string
}

export interface IPushRepository {
  upsert(userId: string, input: PushSubscriptionInput): Promise<void>
  deleteOwned(userId: string, endpoint: string): Promise<number>
  findForUser(userId: string): Promise<StoredPushSubscription[]>
  deleteByIds(ids: string[]): Promise<number>
}

export class PrismaPushRepository implements IPushRepository {
  private logger: ILogger

  constructor(appContext: AppContext, private prisma: PrismaClient) {
    this.logger = appContext.logger
  }

  async upsert(userId: string, input: PushSubscriptionInput): Promise<void> {
    const endpointHash = hashPushEndpoint(input.endpoint)
    const encrypted = {
      userId,
      endpointEncrypted: encryptPushSubscriptionValue(input.endpoint),
      p256dhEncrypted: encryptPushSubscriptionValue(input.keys.p256dh),
      authEncrypted: encryptPushSubscriptionValue(input.keys.auth),
      locale: input.locale,
      expirationTime: input.expirationTime ? new Date(input.expirationTime) : null,
    }
    await this.prisma.pushSubscription.upsert({
      where: { endpointHash },
      create: { endpointHash, ...encrypted },
      update: encrypted,
    })
    this.logger.info('PrismaPushRepository.upsert', { userId })
  }

  async deleteOwned(userId: string, endpoint: string): Promise<number> {
    const result = await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpointHash: hashPushEndpoint(endpoint) },
    })
    return result.count
  }

  async findForUser(userId: string): Promise<StoredPushSubscription[]> {
    const rows = await this.prisma.pushSubscription.findMany({ where: { userId } })
    return rows.map((row) => this.toSubscription(row))
  }

  async deleteByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0
    return (await this.prisma.pushSubscription.deleteMany({ where: { id: { in: ids } } })).count
  }

  private toSubscription(row: PushSubscription): StoredPushSubscription {
    return {
      id: row.id,
      endpoint: decryptPushSubscriptionValue(row.endpointEncrypted),
      locale: row.locale === 'en' ? 'en' : 'th',
      expirationTime: row.expirationTime?.getTime() ?? null,
      keys: {
        p256dh: decryptPushSubscriptionValue(row.p256dhEncrypted),
        auth: decryptPushSubscriptionValue(row.authEncrypted),
      },
    }
  }
}
