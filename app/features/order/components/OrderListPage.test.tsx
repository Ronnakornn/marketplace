/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrderListPage } from './OrderListPage'

const { fetchOrders } = vi.hoisted(() => ({ fetchOrders: vi.fn() }))
vi.mock('../api', () => ({ fetchOrders }))
vi.mock('next/link', () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('#/components/BuyerShell', () => ({ BuyerTopBar: ({ title }: { title: string }) => <h1>{title}</h1> }))
vi.mock('#/i18n/client', () => ({ useTranslations: () => (key: string) => key, useFormatters: () => ({ date: () => '2026-01-01' }) }))
vi.mock('#/i18n/navigation', () => ({ useLocalePath: () => (path: string) => path }))
vi.mock('#/features/buyer/api', () => ({ formatMoney: (value: string) => value }))

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('buyer order server pages', () => {
  it('reaches orders after fifty and sends search and status before paging', async () => {
    fetchOrders.mockImplementation(async (query) => {
      const rows = Array.from({ length: 65 }, (_, index) => ({ id: `order-${index}`, orderNo: `ORD-${index}`, status: 'PAID', paymentStatus: 'SUCCEEDED', createdAt: new Date('2026-01-01'), totals: { grandTotal: '9007199254740993123', currency: 'THB' }, items: [] }))
      const filtered = query.q ? rows.filter((row) => row.orderNo.includes(query.q)) : rows
      return { data: filtered.slice((query.page - 1) * query.limit, query.page * query.limit), meta: { page: query.page, limit: query.limit, totalCount: filtered.length, totalPages: Math.ceil(filtered.length / query.limit), hasNextPage: query.page * query.limit < filtered.length, hasPreviousPage: query.page > 1 } }
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><OrderListPage /></QueryClientProvider>)
    await screen.findByText('ORD-0')
    for (const page of [2, 3, 4]) {
      fireEvent.click(screen.getByRole('button', { name: 'common.next' }))
      await waitFor(() => expect(fetchOrders).toHaveBeenLastCalledWith({ page, limit: 20, q: undefined, status: undefined }))
      await screen.findByText(`ORD-${(page - 1) * 20}`)
    }
    expect(screen.getByText('ORD-64')).toBeTruthy()
    expect(screen.getAllByText('9007199254740993123')).toHaveLength(5)
    fireEvent.change(screen.getByRole('textbox', { name: 'common.search' }), { target: { value: 'ORD-64' } })
    await waitFor(() => expect(fetchOrders).toHaveBeenLastCalledWith({ page: 1, limit: 20, q: 'ORD-64', status: undefined }))
    await screen.findByText('ORD-64')
    fireEvent.click(screen.getByRole('button', { name: 'order.paid' }))
    await waitFor(() => expect(fetchOrders).toHaveBeenLastCalledWith({ page: 1, limit: 20, q: 'ORD-64', status: 'PAID' }))
    client.clear()
  })
})
