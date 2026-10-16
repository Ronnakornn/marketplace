/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAdminCatalogProducts } from './useCatalog'
const { getProducts } = vi.hoisted(() => ({ getProducts: vi.fn() }))
vi.mock('#/lib/eden', () => ({ api: { api: { admin: { catalog: { products: { get: getProducts } } } } } }))
afterEach(() => { cleanup(); vi.clearAllMocks() })
describe('admin catalog remote pages', () => {
  it('keeps whole-scope summary and paging metadata and requests page six/search globally', async () => {
    getProducts.mockImplementation(async ({ query }: { query: { page: number; q?: string } }) => ({
      data: { data: [{ id: query.q ? 'matched-75' : `product-${(query.page - 1) * 10 + 1}` }], meta: { page: query.page, pageSize: 10, totalCount: query.q ? 1 : 75, hasNextPage: query.page < 8 }, summary: { active: 75, draft: 3, archived: 2 } }, error: null,
    }))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const view = renderHook(({ page, q }) => useAdminCatalogProducts({ page, limit: 10, q, sort: 'title_asc' }), { wrapper, initialProps: { page: 1, q: '' } })
    await waitFor(() => expect(view.result.current.data?.meta.totalCount).toBe(75))
    act(() => view.rerender({ page: 6, q: '' }))
    await waitFor(() => expect(view.result.current.data?.data[0]?.id).toBe('product-51'))
    expect(view.result.current.data?.summary).toEqual({ active: 75, draft: 3, archived: 2 })
    expect(getProducts).toHaveBeenLastCalledWith({ query: { page: 6, limit: 10, sort: 'title_asc' } })
    act(() => view.rerender({ page: 1, q: 'needle' }))
    await waitFor(() => expect(view.result.current.data?.data[0]?.id).toBe('matched-75'))
    expect(getProducts).toHaveBeenLastCalledWith({ query: { page: 1, limit: 10, q: 'needle', sort: 'title_asc' } })
    client.clear()
  })
})
