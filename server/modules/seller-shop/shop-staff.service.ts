import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import { SellerShopServiceError } from './seller-shop.errors.ts'
import { isAssignableStaffRole, permissionsForStaffRole, type AssignableStaffRole } from './shop-staff.permissions.ts'
import type { IShopStaffRepository, ShopStaffRecord } from './shop-staff.repository.ts'

export interface ShopStaffActor { id: string; role: Role }
export interface ShopStaffResponse { id: string; user: { id: string; name: string; email: string; image: string | null }; role: AssignableStaffRole; status: string; permissions: string[]; invitedById: string | null; joinedAt: Date | null; createdAt: Date }

export class ShopStaffService {
  constructor(_appContext: AppContext, private repo: IShopStaffRepository) {}

  async list(actor: ShopStaffActor, shopId: string) { await this.requireOwner(actor.id, shopId); return (await this.repo.listStaff(shopId)).map((staff) => this.toResponse(staff)) }
  async listInvitations(actor: ShopStaffActor) { return (await this.repo.listInvitations(actor.id)).map((staff) => this.toResponse(staff)) }
  async invite(actor: ShopStaffActor, shopId: string, email: string, role: string) {
    await this.requireOwner(actor.id, shopId)
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) throw new SellerShopServiceError('Staff email is required', 400, 'SHOP_STAFF_INVALID')
    if (!isAssignableStaffRole(role)) throw new SellerShopServiceError('Staff role is invalid', 400, 'SHOP_STAFF_INVALID')
    const user = await this.repo.findUserByEmail(normalizedEmail)
    if (!user) throw new SellerShopServiceError('Platform user not found', 404, 'SHOP_STAFF_USER_NOT_FOUND')
    if (user.id === actor.id) throw new SellerShopServiceError('Owner cannot be invited as staff', 400, 'SHOP_STAFF_INVALID')
    const existing = await this.repo.findStaffByShopAndUser(shopId, user.id)
    if (existing && existing.status !== 'REMOVED') throw new SellerShopServiceError('User already has shop staff access', 409, 'SHOP_STAFF_EXISTS')
    return this.toResponse(await this.repo.invite(shopId, user.id, actor.id, role, permissionsForStaffRole(role)))
  }
  async update(actor: ShopStaffActor, shopId: string, staffId: string, input: { role?: string; status?: string }) {
    await this.requireOwner(actor.id, shopId)
    const staff = await this.repo.findStaffById(shopId, staffId)
    if (!staff || staff.deletedAt) throw new SellerShopServiceError('Staff member not found', 404, 'SHOP_STAFF_NOT_FOUND')
    const role = input.role ?? staff.role
    const status = input.status ?? staff.status
    if (!isAssignableStaffRole(role) || !['INVITED', 'ACTIVE', 'SUSPENDED'].includes(status)) throw new SellerShopServiceError('Staff update is invalid', 400, 'SHOP_STAFF_INVALID')
    return this.toResponse(await this.repo.update(staffId, role, status as 'INVITED' | 'ACTIVE' | 'SUSPENDED', permissionsForStaffRole(role), actor.id))
  }
  async remove(actor: ShopStaffActor, shopId: string, staffId: string) { await this.requireOwner(actor.id, shopId); const staff = await this.repo.findStaffById(shopId, staffId); if (!staff || staff.deletedAt) throw new SellerShopServiceError('Staff member not found', 404, 'SHOP_STAFF_NOT_FOUND'); await this.repo.remove(staffId, actor.id); return { id: staffId } }
  async accept(actor: ShopStaffActor, staffId: string) { const staff = await this.repo.accept(staffId, actor.id); if (!staff) throw new SellerShopServiceError('Staff invitation not found', 404, 'SHOP_STAFF_NOT_FOUND'); return this.toResponse(staff) }
  private async requireOwner(ownerId: string, shopId: string) { if (!await this.repo.findOwnedActiveShop(ownerId, shopId)) throw new SellerShopServiceError('Shop access is forbidden', 403, 'SHOP_FORBIDDEN') }
  private toResponse(staff: ShopStaffRecord): ShopStaffResponse { return { id: staff.id, user: staff.user, role: staff.role as AssignableStaffRole, status: staff.status, permissions: staff.permissions.map(({ permission }) => permission), invitedById: staff.invitedById, joinedAt: staff.joinedAt, createdAt: staff.createdAt } }
}
