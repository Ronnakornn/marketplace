import type { PrismaClient } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export interface RealtimeChatRoomAccess {
  id: string
  buyerId: string
  shop: {
    id: string
    ownerId: string
    status: string
  }
}

export interface IRealtimeRepository {
  findChatRoomAccess(roomId: string): Promise<RealtimeChatRoomAccess | null>
  findShopOwnerId(shopId: string): Promise<string | null>
}

export class PrismaRealtimeRepository implements IRealtimeRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  async findChatRoomAccess(roomId: string): Promise<RealtimeChatRoomAccess | null> {
    this.logger.debug('PrismaRealtimeRepository.findChatRoomAccess', { roomId })
    return this.prisma.chatThread.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        buyerId: true,
        shop: {
          select: {
            id: true,
            ownerId: true,
            status: true,
          },
        },
      },
    })
  }

  async findShopOwnerId(shopId: string): Promise<string | null> {
    this.logger.debug('PrismaRealtimeRepository.findShopOwnerId', { shopId })
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { ownerId: true, status: true },
    })
    return shop?.status === 'ACTIVE' ? shop.ownerId : null
  }
}
