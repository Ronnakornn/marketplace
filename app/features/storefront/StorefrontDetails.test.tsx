/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StorefrontDetails } from './StorefrontDetails'

const mocks = vi.hoisted(() => ({ session: null as any, push: vi.fn(), refresh: vi.fn(), follow: vi.fn(), chat: vi.fn(), track: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }))
vi.mock('#/i18n/client', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('#/i18n/navigation', () => ({ useLocalePath: () => (path: string) => `/en${path}` }))
vi.mock('#/lib/auth-client', () => ({ useSession: () => ({ data: mocks.session }) }))
vi.mock('#/features/buyer/api', () => ({ fetchShopFollowStatus: vi.fn(async () => false), followShop: mocks.follow, unfollowShop: vi.fn() }))
vi.mock('#/features/chat', () => ({ createChatRoom: mocks.chat }))
vi.mock('#/features/tracking', () => ({ trackDiscoveryEvent: mocks.track }))

const shop = { id: 'shop-1', name: 'Shop', slug: 'demo-shop', description: null, logoUrl: null, coverUrl: null, ratingAverage: 5, ratingCount: 4, followerCount: 2, productCount: 1, chatEnabled: true, shippingPolicy: '<b>Plain shipping</b>', returnPolicy: null, updatedAt: new Date(), viewer: { isOwner: false } }

function renderDetails(value = shop) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><StorefrontDetails shop={value} locale="en" /></QueryClientProvider>)
}

beforeEach(() => {
  cleanup(); vi.clearAllMocks(); mocks.session = null; mocks.follow.mockResolvedValue(undefined); mocks.chat.mockResolvedValue({ roomId: 'room-1' })
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [{ id: 'r1', userName: 'Buyer', rating: 5, comment: 'Great', createdAt: '2026-08-08T00:00:00.000Z' }], meta: { page: 1, pageSize: 10, totalCount: 1, hasNextPage: false } }), { status: 200 })))
})

describe('StorefrontDetails', () => {
  it('shows published reviews and renders policy text without interpreting HTML', async () => {
    renderDetails()
    expect(await screen.findByText('Great')).toBeTruthy()
    expect(screen.getByText('<b>Plain shipping</b>')).toBeTruthy()
    expect(document.querySelector('b')).toBeNull()
  })

  it('redirects anonymous follow and chat to localized login return', () => {
    renderDetails()
    fireEvent.click(screen.getByRole('button', { name: 'storefront.follow' }))
    fireEvent.click(screen.getByRole('button', { name: 'storefront.chat' }))
    expect(mocks.push).toHaveBeenCalledTimes(2)
    expect(mocks.push).toHaveBeenCalledWith('/en/login?next=%2Fshops%2Fdemo-shop')
  })

  it('navigates an authenticated buyer directly to the resolved room', async () => {
    mocks.session = { user: { id: 'buyer-1' } }
    renderDetails()
    fireEvent.click(screen.getByRole('button', { name: 'storefront.chat' }))
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/en/chat/room-1'))
    expect(mocks.track).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'shop_chat_opened' }))
  })

  it('refreshes authoritative follow state after an idempotent follow', async () => {
    mocks.session = { user: { id: 'buyer-1' } }
    renderDetails()
    fireEvent.click(screen.getByRole('button', { name: 'storefront.follow' }))
    await waitFor(() => expect(mocks.follow).toHaveBeenCalledWith('shop-1'))
    expect(mocks.refresh).toHaveBeenCalled()
    expect(mocks.track).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'shop_followed' }))
  })

  it('hides buyer actions in owner mode', () => {
    renderDetails({ ...shop, viewer: { isOwner: true } })
    expect(screen.queryByRole('button', { name: 'storefront.follow' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'storefront.chat' })).toBeNull()
  })
})
