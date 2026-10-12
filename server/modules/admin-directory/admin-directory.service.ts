import type {
  AdminActor,
  AdminAuthorizer,
} from '#server/modules/admin-access/admin-access.contract.ts'
import { AdminAccessError } from '#server/modules/admin-access/admin-access.errors.ts'
import { AdminDirectoryRepository } from './admin-directory.repository.ts'
import { toMoneyDto } from '#server/lib/money.ts'
import type { SupportTicket, TicketMessage } from '#generated/client/client.ts'

export class AdminDirectoryService {
  constructor(
    private readonly repository: AdminDirectoryRepository,
    private readonly access: AdminAuthorizer,
  ) {}
  private pagination(page: number, limit: number) {
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 10000 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new AdminAccessError(
        'Invalid pagination',
        400,
        'INVALID_PAGINATION',
      )
  }
  async buyer(actor: AdminActor, userId: string, page = 1, limit = 20) {
    await this.access.require(actor, 'users.read')
    this.pagination(page, limit)
    const user = await this.repository.user(userId)
    if (!user)
      throw new AdminAccessError('User not found', 404, 'USER_NOT_FOUND')
    return toMoneyDto({
      user,
      ...(await this.repository.buyerHistory(userId, page, limit)),
    })
  }
  async shop(actor: AdminActor, shopId: string, page = 1, limit = 20) {
    await this.access.require(actor, 'shops.read')
    this.pagination(page, limit)
    const shop = await this.repository.shop(shopId)
    if (!shop)
      throw new AdminAccessError('Shop not found', 404, 'SHOP_NOT_FOUND')
    return toMoneyDto({
      shop,
      ...(await this.repository.shopHistory(shopId, shop.ownerId, page, limit)),
    })
  }
  async notice(
    actor: AdminActor,
    shopId: string,
    input: Pick<SupportTicket, 'subject'> & Pick<TicketMessage, 'body'>,
  ) {
    await this.access.require(actor, 'shops.write')
    const subject = input.subject.trim(),
      body = input.body.trim()
    if (!subject || subject.length > 200 || !body || body.length > 10000)
      throw new AdminAccessError(
        'Subject and message are required',
        400,
        'INVALID_NOTICE',
      )
    return this.repository.notice(actor, shopId, subject, body)
  }
}
