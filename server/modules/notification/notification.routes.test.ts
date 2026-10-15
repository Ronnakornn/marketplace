import { Elysia } from 'elysia'
import { describe, expect, it, vi } from 'vitest'
import type { ServiceContainer } from '#server/context/app-context.ts'
vi.mock('#server/modules/auth', () => ({ authPlugin: new Elysia().macro({ withAuth: { resolve: () => ({ authContext: { user: { id: 'owner', role: 'USER' } } }) } }) }))
import { createNotificationRoutes } from './notification.routes.ts'
function fixture() {
  const listNotifications = vi.fn(async () => ({ items: [], nextCursor: null }))
  const getUnreadCount = vi.fn(async () => ({ unreadCount: 1 }))
  const container = { notificationService: { listNotifications, getUnreadCount } } as unknown as ServiceContainer
  const app = createNotificationRoutes(container)
  return { listNotifications, getUnreadCount, get: (query: string) => app.handle(new Request(`http://localhost/api/notifications${query}`)) }
}
describe('notification route pagination validation', () => {
  it.each(['?limit=0', '?limit=101', '?limit=1.5', '?limit=oops', '?cursor=invalid', '?category=unknown', '?scope=other'])('rejects invalid query %s', async (query) => {
    const f = fixture()
    expect((await f.get(query)).status).toBe(422)
    expect(f.listNotifications).not.toHaveBeenCalled()
  })
  it('passes validated bounded pagination and category to the service', async () => {
    const f = fixture()
    expect((await f.get('?scope=seller&category=chat&limit=2&cursor=11111111-1111-4111-8111-111111111111')).status).toBe(200)
    expect(f.listNotifications).toHaveBeenCalledWith({ id: 'owner', role: 'USER' }, 'seller', { scope: 'seller', category: 'chat', limit: 2, cursor: '11111111-1111-4111-8111-111111111111' })
  })
  it('includes chat by default and parses opt-in exclusion as a boolean', async () => {
    const f = fixture()
    expect((await f.get('/unread-count')).status).toBe(200)
    expect(f.getUnreadCount).toHaveBeenLastCalledWith({ id: 'owner', role: 'USER' }, 'all', false)
    expect((await f.get('/unread-count?scope=seller&excludeChat=true')).status).toBe(200)
    expect(f.getUnreadCount).toHaveBeenLastCalledWith({ id: 'owner', role: 'USER' }, 'seller', true)
    expect((await f.get('/unread-count?excludeChat=invalid')).status).toBe(422)
  })
})
