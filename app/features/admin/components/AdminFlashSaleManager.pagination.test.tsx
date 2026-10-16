/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { AdminFlashSaleManager } from './AdminFlashSaleManager'

const { getSales } = vi.hoisted(() => ({ getSales: vi.fn() }))
vi.mock('#/lib/eden', () => ({ api: { api: { admin: { 'flash-sales': { get: getSales } } } } }))
vi.mock('../hooks/useAdminOperations', () => ({ useAdminProductsList: () => ({ data: { items: [] } }) }))
vi.mock('#/i18n/client', () => ({ useTranslations: () => (key: string) => key, useFormatters: () => ({ date: (value: string) => value }) }))
vi.mock('./AdminDataShell', () => ({ AdminDataShell: ({ children, search, onSearchChange }: { children: ReactNode; search: string; onSearchChange: (value: string) => void }) => <><input aria-label="Search sales" value={search} onChange={event => onSearchChange(event.target.value)} />{children}</> }))
afterEach(cleanup)
describe('admin Flash Sale remote history', () => {
  it('requests older pages and resets to the first page when searching the complete history', async () => {
    getSales.mockImplementation(async ({ query }: { query: { page: number; q?: string } }) => ({ data: {
      data: [{ id: `sale-${query.page}`, title: query.q ? 'Matched older sale' : `Sale page ${query.page}`, startsAt: '2020-01-01', endsAt: '2020-01-02', status: 'ENDED', items: [] }],
      meta: { page: query.page, limit: 10, totalCount: 61, totalPages: 7, hasNextPage: query.page < 7, hasPreviousPage: query.page > 1 },
    }, error: null }))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><AdminFlashSaleManager /></QueryClientProvider>)
    await screen.findByText('Sale page 1')
    fireEvent.click(screen.getByRole('button', { name: 'common.next' }))
    await screen.findByText('Sale page 2')
    expect(getSales).toHaveBeenLastCalledWith({ query: { page: 2, limit: 10, q: undefined } })
    fireEvent.change(screen.getByLabelText('Search sales'), { target: { value: 'older' } })
    await screen.findByText('Matched older sale')
    await waitFor(() => expect(getSales).toHaveBeenLastCalledWith({ query: { page: 1, limit: 10, q: 'older' } }))
  })
})
