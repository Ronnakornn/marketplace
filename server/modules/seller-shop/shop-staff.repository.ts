import type { PrismaClient, Shop, ShopStaff, User } from '#generated/client/client.ts'
import type { ShopStaffRoleType, ShopStaffStatus } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'

const staffInclude = { user: { select: { id: true, name: true, email: true, image: true } }, permissions: { select: { permission: true } } } as const
export type ShopStaffRecord = Pick<ShopStaff, 'id' | 'shopId' | 'userId' | 'role' | 'status' | 'invitedById' | 'joinedAt' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  user: Pick<User, 'id' | 'name' | 'email' | 'image'>
  permissions: Array<{ permission: string }>
}

export interface IShopStaffRepository {
  findOwnedActiveShop(ownerId: string, shopId: string): Promise<Pick<Shop, 'id'> | null>
  findUserByEmail(email: string): Promise<Pick<User, 'id' | 'name' | 'email'> | null>
  findStaffByShopAndUser(shopId: string, userId: string): Promise<ShopStaffRecord | null>
  findStaffById(shopId: string, staffId: string): Promise<ShopStaffRecord | null>
  listStaff(shopId: string): Promise<ShopStaffRecord[]>
  listInvitations(userId: string): Promise<ShopStaffRecord[]>
  invite(shopId: string, userId: string, invitedById: string, role: ShopStaffRoleType, permissions: string[]): Promise<ShopStaffRecord>
  update(staffId: string, role: ShopStaffRoleType, status: ShopStaffStatus, permissions: string[], actorId: string): Promise<ShopStaffRecord>
  accept(staffId: string, userId: string): Promise<ShopStaffRecord | null>
  remove(staffId: string, actorId: string): Promise<void>
}

export class PrismaShopStaffRepository implements IShopStaffRepository {
  constructor(_appContext: AppContext, private prisma: PrismaClient) {}

  findOwnedActiveShop(ownerId: string, shopId: string) { return this.prisma.shop.findFirst({ where: { id: shopId, ownerId, status: 'ACTIVE' }, select: { id: true } }) }
  findUserByEmail(email: string) { return this.prisma.user.findFirst({ where: { email }, select: { id: true, name: true, email: true } }) }
  findStaffByShopAndUser(shopId: string, userId: string) { return this.prisma.shopStaff.findUnique({ where: { shopId_userId: { shopId, userId } }, include: staffInclude }) }
  findStaffById(shopId: string, staffId: string) { return this.prisma.shopStaff.findFirst({ where: { id: staffId, shopId }, include: staffInclude }) }
  listStaff(shopId: string) { return this.prisma.shopStaff.findMany({ where: { shopId, deletedAt: null }, include: staffInclude, orderBy: { createdAt: 'asc' } }) }
  listInvitations(userId: string) { return this.prisma.shopStaff.findMany({ where: { userId, status: 'INVITED', deletedAt: null }, include: staffInclude, orderBy: { createdAt: 'desc' } }) }

  async invite(shopId: string, userId: string, invitedById: string, role: ShopStaffRoleType, permissions: string[]) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.shopStaff.findUnique({ where: { shopId_userId: { shopId, userId } } })
      const staff = existing
        ? await tx.shopStaff.update({ where: { id: existing.id }, data: { role, status: 'INVITED', invitedById, joinedAt: null, deletedAt: null, permissions: { deleteMany: {}, createMany: { data: permissions.map((permission) => ({ permission })) } } }, include: staffInclude })
        : await tx.shopStaff.create({ data: { shopId, userId, invitedById, role, permissions: { createMany: { data: permissions.map((permission) => ({ permission })) } } }, include: staffInclude })
      await tx.shopActivityLog.create({ data: { shopId, actorUserId: invitedById, action: 'STAFF_INVITED', entityType: 'shop_staff', entityId: staff.id, after: { role, status: 'INVITED' } } })
      return staff
    })
  }

  async update(staffId: string, role: ShopStaffRoleType, status: ShopStaffStatus, permissions: string[], actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.shopStaff.findUniqueOrThrow({ where: { id: staffId }, select: { shopId: true, role: true, status: true } })
      const staff = await tx.shopStaff.update({ where: { id: staffId }, data: { role, status, permissions: { deleteMany: {}, createMany: { data: permissions.map((permission) => ({ permission })) } } }, include: staffInclude })
      await tx.shopActivityLog.create({ data: { shopId: before.shopId, actorUserId: actorId, action: 'STAFF_UPDATED', entityType: 'shop_staff', entityId: staffId, before: { role: before.role, status: before.status }, after: { role, status } } })
      return staff
    })
  }

  async accept(staffId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const staff = await tx.shopStaff.findFirst({ where: { id: staffId, userId, status: 'INVITED', deletedAt: null }, include: staffInclude })
      if (!staff) return null
      const updated = await tx.shopStaff.update({ where: { id: staff.id }, data: { status: 'ACTIVE', joinedAt: new Date() }, include: staffInclude })
      await tx.shopActivityLog.create({ data: { shopId: staff.shopId, actorUserId: userId, action: 'STAFF_UPDATED', entityType: 'shop_staff', entityId: staff.id, before: { status: 'INVITED' }, after: { status: 'ACTIVE' } } })
      return updated
    })
  }

  async remove(staffId: string, actorId: string) {
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.shopStaff.findUniqueOrThrow({ where: { id: staffId }, select: { shopId: true, role: true, status: true } })
      await tx.shopStaff.update({ where: { id: staffId }, data: { status: 'REMOVED', deletedAt: new Date() } })
      await tx.shopActivityLog.create({ data: { shopId: before.shopId, actorUserId: actorId, action: 'STAFF_REMOVED', entityType: 'shop_staff', entityId: staffId, before: { role: before.role, status: before.status }, after: { status: 'REMOVED' } } })
    })
  }
}
