/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StorefrontCatalog } from './StorefrontCatalog'

const mocks = vi.hoisted(() => ({
  replace: vi.fn(), params: new URLSearchParams(), failPage2: false,
  pages: {
    1: { items: [{ id: 'p1' }, { id: 'p2' }], meta: { page: 1, pageSize: 12, totalCount: 3, hasNextPage: true }, facets: { categories: [] } },
    2: { items: [{ id: 'p2' }, { id: 'p3' }], meta: { page: 2, pageSize: 12, totalCount: 3, hasNextPage: false }, facets: { categories: [] } },
  } as Record<number, any>,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }), usePathname: () => '/en/shops/demo', useSearchParams: () => mocks.params,
}))
vi.mock('@tanstack/react-query', () => ({ useQuery: (options: any) => {
  const page = options.queryKey[1].page
  if (page === 2 && mocks.failPage2) return { data: undefined, isLoading: false, isFetching: false, isError: true, refetch: vi.fn() }
  return { data: mocks.pages[page], isLoading: false, isFetching: false, isError: false, refetch: vi.fn() }
} }))
vi.mock('#/features/product/queries', () => ({
  publicShopProductsQueryOptions: (input: any) => ({ queryKey: ['shop', input] }),
  normalizePublicProductListing: (response: any) => ({ products: response.items, meta: response.meta, facets: { categories: response.facets.categories } }),
}))
vi.mock('#/features/product/components/ProductCard', () => ({ ProductCard: ({ product, showShopIdentity }: any) => <div data-testid="product-card">{product.id}:{String(showShopIdentity)}</div> }))
vi.mock('#/i18n/client', () => ({ useTranslations: () => (key: string) => ({
  'storefront.resultSummary': 'Showing {shown} of {total}', 'storefront.loadMore': 'Load more', 'storefront.nextPageError': 'Next page failed', 'storefront.retry': 'Retry',
}[key] ?? key) }))
vi.mock('#/components/ui/input', () => ({ Input: (props: any) => <input {...props} /> }))
vi.mock('#/components/ui/button', () => ({ Button: ({ children, ...props }: any) => <button {...props}>{children}</button> }))
vi.mock('#/components/ui/select', () => ({ Select: ({ children }: any) => <div>{children}</div>, SelectContent: ({ children }: any) => <div>{children}</div>, SelectItem: ({ children }: any) => <div>{children}</div>, SelectTrigger: ({ children, ...props }: any) => <button {...props}>{children}</button>, SelectValue: () => null }))

beforeEach(() => { cleanup(); vi.useRealTimers(); mocks.replace.mockClear(); mocks.params = new URLSearchParams(); mocks.failPage2 = false })

describe('StorefrontCatalog', () => {
  it('appends pages without duplicate cards and omits shop identity', async () => {
    render(<StorefrontCatalog shopId="shop-1" locale="en" />)
    await waitFor(() => expect(screen.getAllByTestId('product-card')).toHaveLength(2))
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    await waitFor(() => expect(screen.getAllByTestId('product-card')).toHaveLength(3))
    expect(screen.getAllByTestId('product-card').map((node) => node.textContent)).toEqual(['p1:false', 'p2:false', 'p3:false'])
  })

  it('preserves current products and exposes retry when the next page fails', async () => {
    mocks.failPage2 = true
    render(<StorefrontCatalog shopId="shop-1" locale="en" />)
    await waitFor(() => screen.getByRole('button', { name: 'Load more' }))
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    await waitFor(() => expect(screen.getByText('Next page failed')).toBeTruthy())
    expect(screen.getAllByTestId('product-card')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('debounces URL search updates with router replace', async () => {
    vi.useFakeTimers()
    render(<StorefrontCatalog shopId="shop-1" locale="en" />)
    fireEvent.change(screen.getByLabelText('storefront.searchLabel'), { target: { value: 'bags' } })
    await vi.advanceTimersByTimeAsync(350)
    expect(mocks.replace).toHaveBeenCalledWith('/en/shops/demo?q=bags', { scroll: false })
    vi.useRealTimers()
  })
})
