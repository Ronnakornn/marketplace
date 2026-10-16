/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useSellerCoupons } from './useSellerManage'

const { getCoupons } = vi.hoisted(() => ({ getCoupons: vi.fn() }))
vi.mock('#/lib/eden', () => ({ api: { api: { seller: { coupons: { get: getCoupons } } } } }))
afterEach(cleanup)
describe('seller coupon remote paging', () => {
  it('keys the complete filtered page and preserves server totals beyond fifty', async () => {
    getCoupons.mockImplementation(async ({ query }: { query: { page: number } }) => ({ data: { data: [{ id: `coupon-${query.page}` }], meta: { page: query.page, limit: 10, totalCount: 61, totalPages: 7 } }, error: null }))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const initial = { page: 6, limit: 10, q: 'SAVE', isActive: false }
    const { result, rerender } = renderHook(input => useSellerCoupons(input), { initialProps: initial, wrapper })
    await waitFor(() => expect(result.current.data?.data[0]?.id).toBe('coupon-6'))
    expect(result.current.data?.meta.totalCount).toBe(61)
    expect(getCoupons).toHaveBeenLastCalledWith({ query: initial })
    rerender({ ...initial, page: 7 })
    await waitFor(() => expect(result.current.data?.data[0]?.id).toBe('coupon-7'))
    expect(client.getQueryData(['seller', 'coupons', initial])).toMatchObject({ data: [{ id: 'coupon-6' }], meta: { totalCount: 61 } })
  })
})
