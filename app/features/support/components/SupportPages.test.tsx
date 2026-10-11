/** @vitest-environment jsdom */
import { type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '#/i18n/client'
import en from '../../../../messages/en.json'
import { SupportCreateForm } from './SupportCreatePage'
import { SupportDetailPage } from './SupportDetailPage'

const mocks = vi.hoisted(() => ({ createSupport: vi.fn(), createAppeal: vi.fn(), getSupport: vi.fn(), replySupport: vi.fn(), updateSupportStatus: vi.fn(), decideSupport: vi.fn(), push: vi.fn() }))
vi.mock('../api', () => mocks)
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }), useSearchParams: () => new URLSearchParams() }))
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a> }))
vi.mock('#/i18n/navigation', () => ({ useLocalePath: () => (path: string) => `/en${path}` }))
vi.mock('#/components/BuyerShell', () => ({ BuyerTopBar: ({ title }: { title: string }) => <header>{title}</header> }))

function renderPage(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<I18nProvider locale="en" messages={en} fallbackMessages={en}><QueryClientProvider client={client}>{children}</QueryClientProvider></I18nProvider>)
}
function detail(status = 'OPEN', disputeStatus?: string) {
  return { ticket: { id: 'ticket', userId: 'buyer', orderId: 'order', shopId: 'shop', subject: 'Damaged parcel', status, shop: { id: 'shop', name: 'Shop' }, createdAt: new Date(), updatedAt: new Date(), closedAt: null, priority: 'NORMAL', category: null, disputes: disputeStatus ? [{ id: 'dispute', returnRequestId: 'return', status: disputeStatus, reason: 'Text evidence', decision: null, resolvedAt: null, createdAt: new Date() }] : [] }, messages: { items: [{ id: 'message', senderId: 'buyer', senderType: 'BUYER', body: 'The parcel is damaged', isInternal: false, createdAt: new Date() }], total: 1, page: 1, limit: 20 } }
}

beforeEach(() => { vi.clearAllMocks(); mocks.getSupport.mockResolvedValue(detail()); mocks.replySupport.mockResolvedValue({ id: 'reply' }) })
afterEach(cleanup)

describe('support forms and participant controls', () => {
  it('guards immediate duplicate submissions and navigates to the created ticket', async () => {
    let finish = (value: { id: string }) => { void value }
    mocks.createSupport.mockImplementation(() => new Promise<{ id: string }>((resolve) => { finish = resolve }))
    renderPage(<SupportCreateForm context={{ kind: 'ticket', orderId: 'order', shopId: 'shop' }} />)
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Damaged parcel' } })
    fireEvent.change(screen.getByLabelText('Text evidence'), { target: { value: 'The box was open' } })
    const form = screen.getByRole('button', { name: 'Create ticket' }).closest('form')
    if (!form) throw new Error('Support form missing')
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(mocks.createSupport).toHaveBeenCalledTimes(1))
    expect(mocks.createSupport).toHaveBeenCalledWith({ subject: 'Damaged parcel', body: 'The box was open', orderId: 'order', shopId: 'shop' })
    expect(screen.getByRole('button', { name: 'Saving…' }).hasAttribute('disabled')).toBe(true)
    finish({ id: 'ticket-created' })
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/en/support/ticket-created'))
  })

  it('preserves evidence after failure and allows a retry', async () => {
    mocks.createSupport.mockRejectedValueOnce(new Error('Failed')).mockResolvedValueOnce({ id: 'retry-ticket' })
    renderPage(<SupportCreateForm context={{ kind: 'ticket' }} />)
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Help' } })
    fireEvent.change(screen.getByLabelText('Text evidence'), { target: { value: 'Saved evidence' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create ticket' }))
    await screen.findByRole('alert')
    expect(screen.getByDisplayValue('Saved evidence')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Create ticket' }))
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/en/support/retry-ticket'))
  })

  it('submits an appeal using the selected return identity', async () => {
    mocks.createAppeal.mockResolvedValue({ id: 'appeal-ticket' })
    renderPage(<SupportCreateForm context={{ kind: 'appeal', returnRequestId: 'rejected-return', orderId: 'order' }} />)
    fireEvent.change(screen.getByLabelText('Text evidence'), { target: { value: 'The seller rejected without checking the damage' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit appeal' }))
    await waitFor(() => expect(mocks.createAppeal).toHaveBeenCalledWith({ returnRequestId: 'rejected-return', subject: 'Return appeal', body: 'The seller rejected without checking the damage' }))
    expect(mocks.createSupport).not.toHaveBeenCalled()
  })

  it('does not expose administrator controls to a buyer and disables terminal public replies', async () => {
    mocks.getSupport.mockResolvedValue(detail('RESOLVED', 'RESOLVED_BUYER'))
    renderPage(<SupportDetailPage role="buyer" ticketId="ticket" />)
    await screen.findByRole('heading', { name: 'Damaged parcel' })
    expect(screen.queryByLabelText('Private note')).toBeNull()
    expect(screen.queryByLabelText('Decision')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Send message' })).toBeNull()
    expect(screen.getByText('This ticket is resolved or closed and no longer accepts public replies.')).toBeTruthy()
  })

  it('lets administrators save private notes separately from public replies', async () => {
    renderPage(<SupportDetailPage role="admin" ticketId="ticket" />)
    await screen.findByLabelText('Private note')
    fireEvent.change(screen.getByLabelText('Private note'), { target: { value: 'Staff investigation only' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add private note' }))
    await waitFor(() => expect(mocks.replySupport).toHaveBeenCalledWith('admin', 'ticket', 'Staff investigation only', true))
    expect(mocks.decideSupport).not.toHaveBeenCalled()
    expect(mocks.updateSupportStatus).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Message')).toBeTruthy()
  })

  it('requires decision text and hides decision editing after resolution', async () => {
    mocks.getSupport.mockResolvedValue(detail('PENDING_ADMIN', 'UNDER_REVIEW'))
    const view = renderPage(<SupportDetailPage role="admin" ticketId="ticket" />)
    await screen.findByLabelText('Decision')
    expect(screen.getByRole('button', { name: 'Save decision' }).hasAttribute('disabled')).toBe(true)
    fireEvent.change(screen.getByLabelText('Decision'), { target: { value: 'Buyer evidence is sufficient' } })
    fireEvent.change(screen.getByLabelText('Dispute status'), { target: { value: 'RESOLVED_BUYER' } })
    mocks.decideSupport.mockResolvedValue({ id: 'ticket' })
    fireEvent.click(screen.getByRole('button', { name: 'Save decision' }))
    await waitFor(() => expect(mocks.decideSupport).toHaveBeenCalledWith('ticket', 'RESOLVED_BUYER', 'Buyer evidence is sufficient'))
    view.unmount()
    mocks.getSupport.mockResolvedValue(detail('RESOLVED', 'RESOLVED_BUYER'))
    renderPage(<SupportDetailPage role="admin" ticketId="ticket" />)
    await screen.findByLabelText('Private note')
    expect(screen.queryByLabelText('Decision')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Send message' })).toBeNull()
  })
})
