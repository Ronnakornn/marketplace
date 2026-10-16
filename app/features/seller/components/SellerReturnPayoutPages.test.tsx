/** @vitest-environment jsdom */
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SellerFinancePage, SellerReturnsPage } from './SellerManagePages'

const transport = vi.hoisted(() => ({ returns: vi.fn(), payouts: vi.fn(), wallet: vi.fn(), transactions: vi.fn() }))
vi.mock('#/lib/eden', () => ({ api: { api: { seller: {
  returns: { get: transport.returns }, payouts: { get: transport.payouts },
  wallet: { get: transport.wallet, transactions: { get: transport.transactions } },
} } } }))
vi.mock('#/i18n/client', () => ({
  useTranslations: () => (key: string) => key,
  useFormatters: () => ({ date: () => '16 Oct 2026', currency: (amount: string | number) => String(amount) }),
}))
vi.mock('./SellerShell', () => ({ SellerPageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }))

type Query = { page?: number; limit?: number; q?: string; status?: string }
const clients: QueryClient[] = []
function page(query: Query, data: unknown[]) {
  const totalCount = query.q || query.status ? 1 : 61
  return { data, meta: { page: query.page ?? 1, limit: query.limit ?? 20, totalCount, totalPages: Math.ceil(totalCount / (query.limit ?? 20)), hasNextPage: (query.page ?? 1) < 4, hasPreviousPage: (query.page ?? 1) > 1 } }
}
function renderPage(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  clients.push(client)
  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>)
}
beforeEach(() => {
  vi.clearAllMocks()
  HTMLElement.prototype.scrollIntoView = vi.fn()
  transport.wallet.mockResolvedValue({ data: null, error: null })
  transport.transactions.mockResolvedValue({ data: { items: [] }, error: null })
  transport.returns.mockImplementation(async ({ query }: { query: Query }) => ({ data: page(query, [{
    id: `return-${query.page}`, reason: `Return page ${query.page}`, status: 'requested',
    createdAt: '2026-10-16T00:00:00Z', items: [{ productTitle: query.q || 'Cotton Tee', quantity: 1 }],
  }]), error: null }))
  transport.payouts.mockImplementation(async ({ query }: { query: Query }) => ({ data: page(query, [{
    id: `payout-${query.page}`, amount: String(9007199254740991n + BigInt(query.page ?? 1)), currency: 'THB', status: 'requested', requestedAt: '2026-10-16T00:00:00Z',
  }]), error: null }))
})
afterEach(() => { cleanup(); for (const client of clients.splice(0)) client.clear() })

describe('seller return and payout server paging', () => {
  it('can reach the final return page and resets the server page when searching', async () => {
    renderPage(<SellerReturnsPage />)
    await screen.findByText('Return page 1')
    fireEvent.click(screen.getByRole('button', { name: 'seller.ui.table.lastPage' }))
    await screen.findByText('Return page 4')
    expect(transport.returns).toHaveBeenLastCalledWith({ query: { page: 4, limit: 20, q: undefined, status: undefined } })
    fireEvent.change(screen.getByRole('textbox', { name: 'seller.manage.pages.returns.search' }), { target: { value: 'Needle' } })
    await screen.findByText('Needle x1')
    expect(transport.returns).toHaveBeenLastCalledWith({ query: { page: 1, limit: 20, q: 'Needle', status: undefined } })
  })

  it('sends return status filtering to the server and disables page-only sorting', async () => {
    renderPage(<SellerReturnsPage />)
    await screen.findByText('Return page 1')
    fireEvent.click(screen.getByRole('combobox', { name: 'seller.manage.pages.returns.filterStatus' }))
    fireEvent.click(screen.getByRole('option', { name: 'seller.manage.status.completed' }))
    await waitFor(() => expect(transport.returns).toHaveBeenLastCalledWith({ query: { page: 1, limit: 20, q: undefined, status: 'completed' } }))
    expect(screen.queryByRole('button', { name: /seller.ui.table.sortBy/ })).toBeNull()
  })

  it('pages payout history beyond fifty records with its own server search and status', async () => {
    renderPage(<SellerFinancePage />)
    await screen.findByText('9007199254740992')
    const table = screen.getByText('seller.manage.pages.finance.payoutHistory').closest<HTMLElement>('[data-slot="card"]')
    expect(table).not.toBeNull()
    const payoutTable = within(table!)
    fireEvent.click(payoutTable.getByRole('button', { name: 'seller.ui.table.lastPage' }))
    await screen.findByText('9007199254740995')
    expect(transport.payouts).toHaveBeenLastCalledWith({ query: { page: 4, limit: 20, q: undefined, status: undefined } })
    fireEvent.change(payoutTable.getByRole('textbox', { name: 'seller.ui.table.search' }), { target: { value: 'BANK-42' } })
    await waitFor(() => expect(transport.payouts).toHaveBeenLastCalledWith({ query: { page: 1, limit: 20, q: 'BANK-42', status: undefined } }))
    fireEvent.click(payoutTable.getByRole('combobox', { name: 'seller.manage.pages.returns.filterStatus' }))
    fireEvent.click(screen.getByRole('option', { name: 'seller.manage.status.paid' }))
    await waitFor(() => expect(transport.payouts).toHaveBeenLastCalledWith({ query: { page: 1, limit: 20, q: 'BANK-42', status: 'paid' } }))
  })
})
