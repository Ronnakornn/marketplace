import { describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import type { IShopStaffRepository, ShopStaffRecord } from './shop-staff.repository.ts'
import { ShopStaffService } from './shop-staff.service.ts'

const appContext: AppContext = { logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }
const staff = (shopId = 'shop-1'): ShopStaffRecord => ({ id: 'staff-1', shopId, userId: 'user-2', role: 'WAREHOUSE', status: 'ACTIVE', invitedById: 'owner-1', joinedAt: new Date(), createdAt: new Date(), updatedAt: new Date(), deletedAt: null, user: { id: 'user-2', name: 'Worker', email: 'worker@example.com', image: null }, permissions: [{ permission: 'inventory' }, { permission: 'shipments' }] })

function repo(): IShopStaffRepository {
  return {
    findOwnedActiveShop: vi.fn(async (ownerId, shopId) => ownerId === 'owner-1' && shopId === 'shop-1' ? { id: shopId } : null),
    findUserByEmail: vi.fn(async () => ({ id: 'user-2', name: 'Worker', email: 'worker@example.com' })),
    findStaffByShopAndUser: vi.fn(async () => null),
    findStaffById: vi.fn(async (shopId) => staff(shopId)),
    listStaff: vi.fn(async (shopId) => [staff(shopId)]),
    listInvitations: vi.fn(async () => [staff()]),
    invite: vi.fn(async (shopId) => staff(shopId)),
    update: vi.fn(async () => staff()),
    accept: vi.fn(async () => staff()),
    remove: vi.fn(async () => undefined),
  }
}

describe('ShopStaffService', () => {
  it('owner invites existing user with preset permissions', async () => {
    const store = repo(); const service = new ShopStaffService(appContext, store)
    await service.invite({ id: 'owner-1', role: 'USER' }, 'shop-1', 'worker@example.com', 'WAREHOUSE')
    expect(store.invite).toHaveBeenCalledWith('shop-1', 'user-2', 'owner-1', 'WAREHOUSE', ['inventory', 'shipments'])
  })

  it('blocks cross-shop staff changes', async () => {
    const store = repo(); const service = new ShopStaffService(appContext, store)
    await expect(service.remove({ id: 'owner-1', role: 'USER' }, 'shop-2', 'staff-1')).rejects.toMatchObject({ code: 'SHOP_FORBIDDEN' })
    expect(store.remove).not.toHaveBeenCalled()
  })

  it('keeps one membership per shop-user', async () => {
    const store = repo(); vi.mocked(store.findStaffByShopAndUser).mockResolvedValue(staff())
    await expect(new ShopStaffService(appContext, store).invite({ id: 'owner-1', role: 'USER' }, 'shop-1', 'worker@example.com', 'SUPPORT')).rejects.toMatchObject({ code: 'SHOP_STAFF_EXISTS' })
  })
})
