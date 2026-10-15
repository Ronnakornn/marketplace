import { beforeEach, describe, expect, it, vi } from 'vitest'
const { requestApi } = vi.hoisted(() => ({ requestApi: vi.fn() }))
vi.mock('#/lib/api-client', () => ({ requestApi }))
import { fetchNotifications, fetchNotificationUnreadCount } from '#/features/buyer/api'

describe('notification API consumers', () => {
  beforeEach(() => requestApi.mockReset())
  it('sends server pagination and category filters and retains the next cursor', async () => {
    requestApi.mockResolvedValue({ items: [{ id: 'notice', type: 'chat_message', title: 'New message', createdAt: '2026-10-15T00:00:00.000Z' }], nextCursor: 'cursor' })
    const page = await fetchNotifications('seller', { cursor: 'previous', limit: 30, category: 'chat' })
    expect(requestApi).toHaveBeenCalledWith('/api/notifications?scope=seller&cursor=previous&limit=30&category=chat', expect.any(Object))
    expect(page.items[0]?.id).toBe('notice')
    expect(page.nextCursor).toBe('cursor')
  })
  it('returns a null cursor for the final page', async () => {
    requestApi.mockResolvedValue({ items: [], nextCursor: null })
    expect(await fetchNotifications()).toEqual({ items: [], nextCursor: null })
  })
  it('requests non-chat unread count only when the caller opts in', async () => {
    requestApi.mockResolvedValue({ unreadCount: 4 })
    expect(await fetchNotificationUnreadCount()).toEqual({ unreadCount: 4 })
    expect(requestApi).toHaveBeenLastCalledWith('/api/notifications/unread-count?scope=all')
    await fetchNotificationUnreadCount('seller', { excludeChat: true })
    expect(requestApi).toHaveBeenLastCalledWith('/api/notifications/unread-count?scope=seller&excludeChat=true')
  })
})
