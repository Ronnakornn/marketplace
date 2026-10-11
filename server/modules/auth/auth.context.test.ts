import { beforeEach, describe, expect, it, vi } from 'vitest'
import { auth } from './auth.ts'
import { getAuthContext } from './auth.context.ts'

vi.mock('./auth.ts', () => ({ auth: { api: { getSession: vi.fn() } } }))

describe('getAuthContext', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null without an authenticated session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    await expect(getAuthContext(new Headers())).resolves.toBeNull()
  })

  it('carries only the authenticated session ID, without the session token', async () => {
    const user = { id: 'user-1', name: 'User', email: 'user@example.test', role: 'USER', status: 'ACTIVE', emailVerified: true }
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user,
      session: { id: 'trusted-session', token: 'secret-cookie-token', userId: 'user-1', expiresAt: new Date() },
    } as never)
    const headers = new Headers({ 'x-session-id': 'attacker-session' })

    const context = await getAuthContext(headers)

    expect(context).toEqual({ user, session: { id: 'trusted-session' } })
    expect(JSON.stringify(context)).not.toContain('secret-cookie-token')
    expect(auth.api.getSession).toHaveBeenCalledWith({ headers })
  })
})
